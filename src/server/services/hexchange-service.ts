import path from "node:path";
import type {
  EngineStatus,
  HealthPayload,
  LiveReadinessReport,
  PortfolioSnapshot,
  RiskSettings,
  StrategySummary,
  SystemStatus,
  TradeSummary,
  ValidationCampaignSummary,
} from "../../shared/contracts";
import type { EventSummary } from "../../shared/contracts";
import type { NormalizedOrder, OrderIntent } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type { StrategyState } from "../domain/strategy";
import type { EventLogRecord, TradeLogEntry } from "../domain/trade-log";
import { transitionStrategyState } from "../domain/strategy";
import { EventStore } from "../audit/event-store";
import { buildOrderNarrative, buildSignalNarrative } from "../audit/explanation-builder";
import { AlpacaPaperBroker } from "../brokers/alpaca/alpaca-paper-broker";
import { createEngineAdapter } from "../engine/engine-adapter";
import type { BacktestResult, PaperSession } from "../engine/types";
import type { KrakenTicker } from "../market/kraken-public-market-data";
import { KrakenPublicMarketData } from "../market/kraken-public-market-data";
import { MarketDataService } from "../market/market-data-service";
import { LiveTradingController } from "../live/live-trading-controller";
import { buildLiveEvidenceProgress } from "../live/live-armament-policy";
import { buildLiveReadinessReport } from "../live/live-readiness-report";
import { KillSwitch } from "../risk/kill-switch";
import { RiskEngine } from "../risk/risk-engine";
import { RuntimeStateStore } from "../state/runtime-state-store";
import { buildValidationReport } from "../strategies/validation-report";
import { buildReferenceStrategies } from "../strategies/strategy-registry";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readNumericEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class HexchangeService {
  private readonly marketDataService = new MarketDataService();
  private readonly killSwitch = new KillSwitch();
  private readonly riskSettings: RiskSettings = {
    maxPositionNotionalUsd: 100000,
    maxDailyLossPct: 8,
    liveRolloutCapUsd: 500,
  };
  private readonly riskEngine = new RiskEngine(
    this.riskSettings,
    this.killSwitch,
    this.marketDataService,
  );
  private readonly liveTradingController = new LiveTradingController();
  private readonly engineAdapter = createEngineAdapter();
  private readonly broker = AlpacaPaperBroker.fromEnv();
  private readonly eventStore: EventStore;
  private readonly runtimeStateStore: RuntimeStateStore;
  private readonly krakenTicker: KrakenTicker;
  private readonly validationCampaignTargets = {
    observedHours: readNumericEnv("HEXCHANGE_VALIDATION_TARGET_HOURS", 24),
    completedCycles: readNumericEnv("HEXCHANGE_VALIDATION_TARGET_CYCLES", 10),
  };
  private readonly validationCampaignStaleHours = readNumericEnv(
    "HEXCHANGE_VALIDATION_STALE_HOURS",
    2,
  );
  private strategies: StrategyState[] = buildReferenceStrategies(this.marketDataService);
  private orders: NormalizedOrder[] = [];
  private positions: PositionSnapshot[] = [];
  private trades: TradeLogEntry[] = [];
  private backtests: BacktestResult[] = [];
  private managedSessions = new Map<string, PaperSession>();
  private runtimeHeartbeat: NodeJS.Timeout | null = null;
  private runtimeHeartbeatRunning = false;
  private runtimeHeartbeatTask: Promise<void> | null = null;
  private validationCampaignStarted = false;
  private validationCampaignReady = false;
  private validationCampaignStatus: ValidationCampaignSummary["status"] = "idle";

  constructor(
    appDir = process.env.HEXCHANGE_APP_DIR ?? ".hexchange",
    options: {
      krakenTicker?: KrakenTicker;
    } = {},
  ) {
    this.eventStore = new EventStore(path.join(appDir, "events.json"));
    this.runtimeStateStore = new RuntimeStateStore(path.join(appDir, "state.json"));
    this.krakenTicker = options.krakenTicker ?? new KrakenPublicMarketData();
  }

  async initialize(): Promise<void> {
    await this.eventStore.ensureReady();
    await this.loadPersistedState();
    const campaign = this.getValidationCampaignSummary();
    this.validationCampaignStarted = Boolean(campaign.firstObservedCycleAt);
    this.validationCampaignReady = campaign.campaignReady;
    this.validationCampaignStatus = campaign.status;
    await this.recordEvent({
      kind: "system",
      title: "Hexchange observatory online",
      body: "The local operator console is ready. Nautilus will stay in seeded simulation until the local runtime and Interactive Brokers plus Kraken credentials are configured.",
      severity: "info",
    });
  }

  async getHealth(): Promise<HealthPayload> {
    return {
      ok: true,
      mode: this.getMode(),
      timestamp: new Date().toISOString(),
    };
  }

  getSystemStatus(): SystemStatus {
    const totalProfitUsd = this.trades.reduce((sum, trade) => sum + trade.realizedPnlUsd, 0);
    const grossExposureUsd = this.positions.reduce(
      (sum, position) => sum + Math.abs(position.quantity * position.markPrice),
      0,
    );
    const validationCampaign = this.getValidationCampaignSummary();
    const activeWarnings = this.killSwitch.getState().engaged ? [this.killSwitch.getState().reason] : [];
    if (validationCampaign.status === "stalled") {
      activeWarnings.push(validationCampaign.summary);
    }

    return {
      mode: this.getMode(),
      currentActivity: this.describeActivity(),
      totalProfitUsd,
      totalProfitPct: Number((totalProfitUsd / 10000).toFixed(2)),
      dailyDrawdownPct: 1.4,
      grossExposureUsd,
      activeWarnings,
      paperStrategies: this.strategies.filter((strategy) => strategy.stage === "paper" || strategy.stage === "candidate_live").length,
      liveStrategies: this.strategies.filter((strategy) => strategy.stage === "live").length,
      killSwitchEngaged: this.killSwitch.getState().engaged,
      dataFreshness: this.positions.some((position) => !this.marketDataService.isFresh(position.symbol)) ? "stale" : "fresh",
    };
  }

  listStrategies(): StrategySummary[] {
    return this.strategies.map((strategy) => {
      const simulationOnly = strategy.market === "stock";
      const paperValidationStats = this.buildPaperValidationStats(strategy.id);
      const validation = buildValidationReport(strategy, paperValidationStats);
      const lastPaperCycle = this.buildLastPaperCycleSummary(strategy.id);
      const paperCycleHistory = this.buildPaperCycleHistory(strategy.id);
      const lastBacktest = this.backtests.find((item) => item.strategyId === strategy.id) ?? null;
      const liveEvidenceProgress = buildLiveEvidenceProgress(strategy, lastBacktest, paperValidationStats);

      return {
        id: strategy.id,
        name: strategy.name,
        market: strategy.market,
        symbol: strategy.symbol,
        stage: strategy.stage,
        currentActivity:
          strategy.stage === "live"
            ? "autonomous live execution armed"
            : strategy.paperSessionActive
              ? strategy.market === "crypto"
                ? "kraken paper validation active"
                : "simulation session active"
              : "awaiting operator action",
        signal: strategy.signal,
        validation: strategy.validation,
        paperSessionActive: strategy.paperSessionActive,
        paperSession: this.managedSessions.get(strategy.id) ?? null,
        autoPaperValidationEnabled: strategy.autoPaperValidationEnabled ?? false,
        deploymentMode: simulationOnly ? "simulation_only" : "kraken_live_candidate",
        operatorWarning: simulationOnly
          ? "Simulation only: stock execution is disabled until a real stock broker is added."
          : "Kraken is the only venue that can progress from paper validation to live trading right now.",
        liveEligible: !simulationOnly && validation.passed,
        validationReport: validation.reasons,
        paperValidationStats,
        liveEvidenceProgress,
        lastPaperCycle,
        paperCycleHistory,
        lastBacktest,
      };
    });
  }

  getPortfolioSnapshot(): PortfolioSnapshot {
    return {
      positions: this.positions,
      openOrders: this.orders
        .filter((order) => order.status === "accepted" || order.status === "pending")
        .map((order) => ({
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          status: order.status,
        })),
    };
  }

  listTrades(): TradeSummary[] {
    return this.trades;
  }

  getManagedSession(strategyId: string): PaperSession | null {
    return this.managedSessions.get(strategyId) ?? null;
  }

  startRuntimeHeartbeat(intervalMs = 1000): void {
    if (this.runtimeHeartbeat) {
      return;
    }

    this.runtimeHeartbeat = setInterval(() => {
      if (this.runtimeHeartbeatRunning) {
        return;
      }

      this.runtimeHeartbeatRunning = true;
      this.runtimeHeartbeatTask = this.refreshRuntimeTelemetry().finally(() => {
        this.runtimeHeartbeatRunning = false;
        this.runtimeHeartbeatTask = null;
      });
    }, intervalMs);

    this.runtimeHeartbeat.unref?.();
  }

  async stopRuntimeHeartbeat(): Promise<void> {
    if (!this.runtimeHeartbeat) {
      if (this.runtimeHeartbeatTask) {
        await this.runtimeHeartbeatTask;
      }
      return;
    }

    clearInterval(this.runtimeHeartbeat);
    this.runtimeHeartbeat = null;
    if (this.runtimeHeartbeatTask) {
      await this.runtimeHeartbeatTask;
    } else {
      this.runtimeHeartbeatRunning = false;
    }
  }

  async listEvents(): Promise<EventSummary[]> {
    return this.eventStore.list();
  }

  getRiskSettings(): RiskSettings {
    return { ...this.riskSettings };
  }

  async getEngineStatus(): Promise<EngineStatus> {
    const status = await this.engineAdapter.getEngineStatus();
    return {
      ...status,
      latestBacktests: this.backtests.length > 0 ? this.backtests : status.latestBacktests,
    };
  }

  async refreshRuntimeTelemetry(): Promise<void> {
    let stateChanged = false;

    for (const [strategyId] of this.managedSessions.entries()) {
      const strategy = this.findStrategy(strategyId);
      const [orders, positions, trades] = await Promise.all([
        this.engineAdapter.getOrders(strategyId),
        this.engineAdapter.getPositions(strategyId),
        this.engineAdapter.getTrades(strategyId),
      ]);

      if (orders.length > 0) {
        this.orders = [...orders, ...this.orders.filter((item) => item.strategyId !== strategyId)];
        stateChanged = true;
      } else if (trades.length > 0) {
        this.orders = this.orders.filter((item) => item.strategyId !== strategyId);
        stateChanged = true;
      }

      if (positions.length > 0 || trades.length > 0) {
        const hydratedPositions =
          strategy.market === "crypto"
            ? await this.overlayKrakenPublicPrice(positions)
            : positions;
        this.positions = [...hydratedPositions, ...this.positions.filter((item) => item.symbol !== strategy.symbol)];
        stateChanged = true;
      }

      if (trades.length > 0) {
        this.trades = this.mergeTradeHistory(this.trades, trades);
        this.syncEnginePortfolioState(strategyId);
        stateChanged = true;
      }

      if (strategy.market === "crypto" && trades.length > 0 && positions.length === 0) {
        this.managedSessions.delete(strategyId);
        const updatedValidation = this.updateValidationFromPaperCycle(strategy, trades);
        const updatedStrategy = {
          ...this.findStrategy(strategyId),
          validation: updatedValidation,
          paperSessionActive: false,
        };
        this.updateStrategy(updatedStrategy);
        await this.recordEvent({
          kind: "paper_session",
          title: `${strategy.name} paper cycle completed`,
          body: `Paper validation on ${strategy.symbol} completed. Updated paper drift to ${updatedValidation.paperDriftPct.toFixed(2)}%.`,
          severity: "info",
        });
        if (
          updatedStrategy.autoPaperValidationEnabled &&
          !this.killSwitch.getState().engaged &&
          updatedStrategy.stage !== "live" &&
          updatedStrategy.stage !== "halted" &&
          updatedStrategy.stage !== "retired"
        ) {
          await this.startPaperSession(strategyId);
        }
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await this.persistState();
      await this.syncValidationCampaignMilestones();
    }
  }

  async getLiveReadinessReport(): Promise<LiveReadinessReport> {
    const engineStatus = await this.getEngineStatus();
    const paperValidationStatsByStrategy = new Map(
      this.strategies.map((strategy) => [strategy.id, this.buildPaperValidationStats(strategy.id)] as const),
    );
    const lastPaperCycleByStrategy = new Map(
      this.strategies.map((strategy) => [strategy.id, this.buildLastPaperCycleSummary(strategy.id)] as const),
    );
    return buildLiveReadinessReport({
      engineStatus,
      strategies: this.strategies,
      backtests: this.backtests,
      managedSessions: this.managedSessions,
      paperValidationStatsByStrategy,
      lastPaperCycleByStrategy,
      riskSettings: this.getRiskSettings(),
      killSwitchEngaged: this.killSwitch.getState().engaged,
    });
  }

  getValidationCampaignSummary(): ValidationCampaignSummary {
    const strategies = this.listStrategies();
    const cryptoStrategies = strategies.filter((strategy) => strategy.market === "crypto");
    const completedCycles = strategies.reduce(
      (sum, strategy) => sum + strategy.paperValidationStats.completedCycles,
      0,
    );
    const firstObservedCycleAt = cryptoStrategies
      .flatMap((strategy) => strategy.paperCycleHistory.map((cycle) => cycle.startedAt))
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;
    const lastCompletedCycleAt =
      cryptoStrategies
        .flatMap((strategy) => strategy.paperCycleHistory.map((cycle) => cycle.completedAt))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null;
    const observedHours =
      firstObservedCycleAt && lastCompletedCycleAt
        ? Number(
            (
              (new Date(lastCompletedCycleAt).getTime() - new Date(firstObservedCycleAt).getTime()) /
              (1000 * 60 * 60)
            ).toFixed(1),
          )
        : 0;
    const readyCryptoStrategies = cryptoStrategies.filter((strategy) => strategy.liveEvidenceProgress.ready).length;
    const unresolvedCryptoEvidenceChecks = cryptoStrategies.reduce(
      (sum, strategy) =>
        sum + strategy.liveEvidenceProgress.items.filter((item) => item.status !== "pass").length,
      0,
    );
    const campaignReady =
      observedHours >= this.validationCampaignTargets.observedHours &&
      completedCycles >= this.validationCampaignTargets.completedCycles;
    const hoursSinceLastCompletedCycle =
      lastCompletedCycleAt
        ? (Date.now() - new Date(lastCompletedCycleAt).getTime()) / (1000 * 60 * 60)
        : null;
    const hasActiveCryptoPaperSession = this.strategies.some(
      (strategy) => strategy.market === "crypto" && strategy.paperSessionActive,
    );
    const stalled =
      !campaignReady &&
      !hasActiveCryptoPaperSession &&
      completedCycles > 0 &&
      hoursSinceLastCompletedCycle !== null &&
      hoursSinceLastCompletedCycle >= this.validationCampaignStaleHours;
    const status: ValidationCampaignSummary["status"] = campaignReady
      ? "ready"
      : !firstObservedCycleAt
        ? "idle"
        : stalled
          ? "stalled"
          : "collecting";
    const summary =
      status === "ready"
        ? "Forward validation target reached."
        : status === "idle"
          ? "Kraken paper validation has not started yet."
          : status === "stalled"
            ? "Kraken paper validation looks stale. Restart or inspect the paper runtime."
            : "Kraken paper validation is actively collecting forward evidence.";

    return {
      status,
      summary,
      observedHoursTarget: this.validationCampaignTargets.observedHours,
      completedCyclesTarget: this.validationCampaignTargets.completedCycles,
      observedHours,
      completedCycles,
      firstObservedCycleAt,
      lastCompletedCycleAt,
      readyCryptoStrategies,
      unresolvedCryptoEvidenceChecks,
      campaignReady,
    };
  }

  private async syncValidationCampaignMilestones(): Promise<void> {
    const campaign = this.getValidationCampaignSummary();
    const startedTransition = !this.validationCampaignStarted && Boolean(campaign.firstObservedCycleAt);
    const readyTransition = !this.validationCampaignReady && campaign.campaignReady;
    const stalledTransition = this.validationCampaignStatus !== "stalled" && campaign.status === "stalled";
    const resumedTransition = this.validationCampaignStatus === "stalled" && campaign.status !== "stalled";

    if (startedTransition) {
      await this.recordEvent({
        kind: "system",
        title: "Forward validation started",
        body: `Kraken paper evidence collection started at ${campaign.firstObservedCycleAt}. Campaign target is ${campaign.observedHoursTarget} observed hours and ${campaign.completedCyclesTarget} completed cycles.`,
        severity: "info",
      });
    }

    if (stalledTransition) {
      await this.recordEvent({
        kind: "system",
        title: "Forward validation stalled",
        body: campaign.summary,
        severity: "warning",
      });
    }

    if (resumedTransition) {
      await this.recordEvent({
        kind: "system",
        title: "Forward validation resumed",
        body: campaign.summary,
        severity: "info",
      });
    }

    if (readyTransition) {
      await this.recordEvent({
        kind: "system",
        title: "Forward validation target reached",
        body: `The MVP validation campaign reached ${campaign.observedHours.toFixed(1)} observed hours and ${campaign.completedCycles} completed cycles.`,
        severity: "info",
      });
    }

    this.validationCampaignStarted = Boolean(campaign.firstObservedCycleAt);
    this.validationCampaignReady = campaign.campaignReady;
    this.validationCampaignStatus = campaign.status;
  }

  async updateRiskSettings(nextSettings: Partial<RiskSettings>): Promise<RiskSettings> {
    if (typeof nextSettings.maxPositionNotionalUsd === "number") {
      this.riskSettings.maxPositionNotionalUsd = nextSettings.maxPositionNotionalUsd;
    }
    if (typeof nextSettings.maxDailyLossPct === "number") {
      this.riskSettings.maxDailyLossPct = nextSettings.maxDailyLossPct;
    }
    if (typeof nextSettings.liveRolloutCapUsd === "number") {
      this.riskSettings.liveRolloutCapUsd = nextSettings.liveRolloutCapUsd;
    }

    await this.persistState();
    await this.recordEvent({
      kind: "system",
      title: "Risk settings updated",
      body: `Max notional ${this.riskSettings.maxPositionNotionalUsd}, daily loss ${this.riskSettings.maxDailyLossPct}%, live rollout ${this.riskSettings.liveRolloutCapUsd}.`,
      severity: "info",
    });

    return this.getRiskSettings();
  }

  async runStrategyBacktest(strategyId: string): Promise<BacktestResult> {
    const strategy = this.findStrategy(strategyId);
    const result = await this.engineAdapter.runBacktest({
      strategyId,
      symbol: strategy.symbol,
      market: strategy.market,
    });

    this.backtests = [result, ...this.backtests.filter((item) => item.strategyId !== strategyId)].slice(0, 10);
    this.updateStrategy({
      ...strategy,
      validation: {
        ...strategy.validation,
        feeAdjustedReturnPct: result.feeAdjustedReturnPct,
        maxDrawdownPct: result.maxDrawdownPct,
      },
    });
    await this.recordEvent({
      kind: "system",
      title: `${strategy.name} backtest completed`,
      body: `Backtest return ${result.feeAdjustedReturnPct.toFixed(2)}% with drawdown ${result.maxDrawdownPct.toFixed(2)}% via ${result.runtimeSource}.`,
      severity: "info",
    });
    await this.persistState();
    return result;
  }

  async updatePaperAutomation(strategyId: string, enabled: boolean): Promise<StrategySummary> {
    const strategy = this.findStrategy(strategyId);
    if (strategy.market !== "crypto") {
      throw new Error("Continuous paper validation is only available for crypto strategies.");
    }

    this.updateStrategy({
      ...strategy,
      autoPaperValidationEnabled: enabled,
    });

    await this.recordEvent({
      kind: "system",
      title: `${strategy.name} paper automation ${enabled ? "enabled" : "disabled"}`,
      body: enabled
        ? `Continuous Kraken paper validation will restart automatically after each completed cycle for ${strategy.symbol}.`
        : `Continuous Kraken paper validation was turned off for ${strategy.symbol}.`,
      severity: "info",
    });
    await this.persistState();

    return this.listStrategies().find((item) => item.id === strategyId)!;
  }

  async startPaperSession(strategyId: string): Promise<StrategySummary> {
    const strategy = this.findStrategy(strategyId);
    const existingSession = this.managedSessions.get(strategyId) ?? null;

    if (strategy.paperSessionActive && existingSession) {
      const [existingOrders, existingPositions, existingTrades] = await Promise.all([
        this.engineAdapter.getOrders(strategyId),
        this.engineAdapter.getPositions(strategyId),
        this.engineAdapter.getTrades(strategyId),
      ]);
      const hasRuntimeTelemetry =
        existingOrders.length > 0 || existingPositions.length > 0 || existingTrades.length > 0;

      if (existingSession.runtimeSource === "nautilus_trader" && !hasRuntimeTelemetry) {
        await this.stopManagedSession(existingSession.sessionId);
      } else {
        await this.refreshRuntimeTelemetry();
        return this.listStrategies().find((item) => item.id === strategyId)!;
      }
    }

    const freshStrategy = this.findStrategy(strategyId);
    const session = await this.engineAdapter.startPaperSession(strategyId);
    this.managedSessions.set(strategyId, session);
    this.updateStrategy({
      ...(freshStrategy.stage === "paper"
        ? { ...freshStrategy, paperSessionActive: true }
        : transitionStrategyState(freshStrategy, "paper")),
      paperSessionActive: true,
    });

    await this.recordEvent({
      kind: "paper_session",
      title: `${freshStrategy.name} entered paper mode`,
      body: `Session ${session.sessionId} started for ${freshStrategy.symbol}.`,
      severity: "info",
    });

    if (freshStrategy.signal && !(freshStrategy.market === "crypto" && session.runtimeSource === "nautilus_trader")) {
      const intent: OrderIntent = {
        id: createId("order"),
        strategyId: freshStrategy.id,
        symbol: freshStrategy.symbol,
        market: freshStrategy.market,
        side: "buy",
        quantity: freshStrategy.market === "stock" ? 5 : 0.05,
        submittedAt: new Date().toISOString(),
        rationale: buildSignalNarrative(freshStrategy.name, freshStrategy.signal),
      };

      const riskCheck = this.riskEngine.evaluateOrder(intent, this.positions, this.getSystemStatus().dailyDrawdownPct);
      if (!riskCheck.approved) {
        await this.recordEvent({
          kind: "risk",
          title: `${freshStrategy.name} order blocked`,
          body: riskCheck.reason,
          severity: "warning",
        });
      } else {
        const order = await this.executePaperOrder(intent);
        this.orders.unshift(order);
        await this.recordEvent({
          kind: "order",
          title: `${freshStrategy.name} placed a paper order`,
          body: buildOrderNarrative(intent),
          severity: "info",
        });
      }
    }

    await this.refreshRuntimeTelemetry();

    await this.persistState();

    return this.listStrategies().find((item) => item.id === strategyId)!;
  }

  async stopPaperSession(strategyId: string): Promise<StrategySummary> {
    const session = this.managedSessions.get(strategyId);
    if (session) {
      await this.stopManagedSession(session.sessionId);
    }

    return this.listStrategies().find((item) => item.id === strategyId)!;
  }

  async stopManagedSession(sessionId: string): Promise<void> {
    await this.engineAdapter.stopSession(sessionId);

    const entry = [...this.managedSessions.entries()].find(([, session]) => session.sessionId === sessionId);
    if (!entry) {
      return;
    }

    const [strategyId] = entry;
    this.managedSessions.delete(strategyId);
    const strategy = this.findStrategy(strategyId);
    this.updateStrategy({
      ...strategy,
      paperSessionActive: false,
    });

    await this.recordEvent({
      kind: "paper_session",
      title: `${strategy.name} paper session stopped`,
      body: `Session ${sessionId} was stopped and detached from ${strategy.symbol}.`,
      severity: "info",
    });
    await this.persistState();
  }

  async armLiveStrategy(strategyId: string): Promise<StrategySummary> {
    const strategy = this.findStrategy(strategyId);
    const latestBacktest = this.backtests.find((item) => item.strategyId === strategyId) ?? null;
    const armed = this.liveTradingController.armStrategy(
      strategy,
      latestBacktest,
      this.buildLastPaperCycleSummary(strategyId),
      this.buildPaperValidationStats(strategyId),
    );
    this.updateStrategy(armed);

    await this.recordEvent({
      kind: "live_arm",
      title: `${strategy.name} armed for live trading`,
      body: "Live trading was enabled with a tiny rollout cap after passing promotion gates.",
      severity: "warning",
    });

    await this.persistState();

    return this.listStrategies().find((item) => item.id === strategyId)!;
  }

  async engageKillSwitch(reason: string): Promise<SystemStatus> {
    const managedSessionIds = [...this.managedSessions.values()].map((session) => session.sessionId);
    for (const sessionId of managedSessionIds) {
      await this.stopManagedSession(sessionId);
    }

    this.killSwitch.engage(reason);
    this.strategies = this.strategies.map((strategy) =>
      strategy.stage === "live" || strategy.stage === "candidate_live" || strategy.stage === "paper"
        ? { ...strategy, stage: "halted", paperSessionActive: false }
        : strategy,
    );

    await this.recordEvent({
      kind: "kill_switch",
      title: "Kill switch engaged",
      body: reason,
      severity: "critical",
    });

    await this.persistState();

    return this.getSystemStatus();
  }

  async resetKillSwitch(): Promise<SystemStatus> {
    this.killSwitch.disengage();
    await this.recordEvent({
      kind: "kill_switch",
      title: "Kill switch reset",
      body: "The operator reset the kill switch. Halted strategies remain halted until re-armed manually.",
      severity: "info",
    });
    await this.persistState();
    return this.getSystemStatus();
  }

  private async executePaperOrder(intent: OrderIntent): Promise<NormalizedOrder> {
    if (this.broker.enabled) {
      return this.broker.submitPaperOrder(intent);
    }

    const latestPrice = this.marketDataService.getLatestPrice(intent.symbol);
    const fillPrice = Number((latestPrice * 1.001).toFixed(2));
    const order: NormalizedOrder = {
      ...intent,
      status: "filled",
      averageFillPrice: fillPrice,
    };

    const position: PositionSnapshot = {
      symbol: intent.symbol,
      market: intent.market,
      quantity: intent.quantity,
      averageEntryPrice: fillPrice,
      markPrice: latestPrice,
      unrealizedPnlUsd: Number(((latestPrice - fillPrice) * intent.quantity).toFixed(2)),
      realizedPnlUsd: 0,
    };
    this.positions = [position, ...this.positions.filter((item) => item.symbol !== intent.symbol)];

    const trade: TradeLogEntry = {
      id: createId("trade"),
      strategyId: intent.strategyId,
      symbol: intent.symbol,
      market: intent.market,
      venue: this.broker.enabled ? "alpaca" : "simulation",
      executionMode: "simulation",
      runtimeSource: this.broker.enabled ? "alpaca_paper" : "hexchange_local",
      sessionId: this.managedSessions.get(intent.strategyId)?.sessionId ?? null,
      side: intent.side,
      quantity: intent.quantity,
      price: fillPrice,
      feeUsd: Number((fillPrice * intent.quantity * 0.001).toFixed(2)),
      realizedPnlUsd: Number((fillPrice * intent.quantity * 0.012).toFixed(2)),
      expectedEdgeBps: this.findStrategy(intent.strategyId).signal?.expectedEdgeBps ?? 0,
      explanation: intent.rationale,
      createdAt: new Date().toISOString(),
    };
    this.trades.unshift(trade);

    await this.recordEvent({
      kind: "fill",
      title: `${intent.symbol} paper fill recorded`,
      body: `${intent.quantity} units filled at ${fillPrice.toFixed(2)}.`,
      severity: "info",
    });

    this.syncEnginePortfolioState(intent.strategyId);

    await this.persistState();

    return order;
  }

  private getMode(): HealthPayload["mode"] {
    if (this.killSwitch.getState().engaged) {
      return "halted";
    }
    if (this.strategies.some((strategy) => strategy.stage === "live")) {
      return "live";
    }
    if (this.strategies.some((strategy) => strategy.paperSessionActive)) {
      return "paper";
    }
    return "research";
  }

  private describeActivity(): string {
    const live = this.strategies.find((strategy) => strategy.stage === "live");
    if (live) {
      return `${live.name} is currently armed for live execution.`;
    }

    const paper = this.strategies.find((strategy) => strategy.paperSessionActive);
    if (paper) {
      return paper.market === "crypto"
        ? `${paper.name} is running Kraken paper validation on ${paper.symbol}.`
        : `${paper.name} is running in stock simulation mode on ${paper.symbol}.`;
    }

    return "Scanning seeded market states and waiting for operator action.";
  }

  private findStrategy(strategyId: string): StrategyState {
    const strategy = this.strategies.find((item) => item.id === strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy ${strategyId}`);
    }
    return strategy;
  }

  private updateStrategy(strategy: StrategyState): void {
    this.strategies = this.strategies.map((item) => (item.id === strategy.id ? strategy : item));
  }

  private async recordEvent(event: Omit<EventLogRecord, "id" | "createdAt">): Promise<void> {
    await this.eventStore.append({
      id: createId("event"),
      createdAt: new Date().toISOString(),
      ...event,
    });
  }

  private async loadPersistedState(): Promise<void> {
    const snapshot = await this.runtimeStateStore.load();
    if (!snapshot) {
      await this.persistState();
      return;
    }

    this.strategies = snapshot.strategies;
    this.orders = snapshot.orders;
    this.positions = snapshot.positions;
    this.trades = snapshot.trades;
    this.backtests = snapshot.backtests ?? [];
    this.managedSessions = new Map((snapshot.managedSessions ?? []).map((session) => [session.strategyId, session]));
    this.riskSettings.maxPositionNotionalUsd = snapshot.riskSettings.maxPositionNotionalUsd;
    this.riskSettings.maxDailyLossPct = snapshot.riskSettings.maxDailyLossPct;
    this.riskSettings.liveRolloutCapUsd = snapshot.riskSettings.liveRolloutCapUsd;
    if (snapshot.killSwitch.engaged) {
      this.killSwitch.engage(snapshot.killSwitch.reason);
    }
    this.seedEngineBacktests();
  }

  private async persistState(): Promise<void> {
    await this.runtimeStateStore.save({
      strategies: this.strategies,
      orders: this.orders,
      positions: this.positions,
      trades: this.trades,
      backtests: this.backtests,
      managedSessions: [...this.managedSessions.values()],
      riskSettings: this.riskSettings,
      killSwitch: this.killSwitch.getState(),
    });
  }

  private syncEnginePortfolioState(strategyId: string): void {
    const syncableAdapter = this.engineAdapter as Partial<{
      setOrders(strategyId: string, orders: NormalizedOrder[]): void;
      setPositions(strategyId: string, positions: PositionSnapshot[]): void;
    }>;

    syncableAdapter.setOrders?.(strategyId, this.orders);
    syncableAdapter.setPositions?.(strategyId, this.positions);
  }

  private seedEngineBacktests(): void {
    const syncableAdapter = this.engineAdapter as Partial<{
      seedBacktests(backtests: BacktestResult[]): void;
    }>;

    syncableAdapter.seedBacktests?.(this.backtests);
  }

  private updateValidationFromPaperCycle(
    strategy: StrategyState,
    trades: TradeLogEntry[],
  ): StrategyState["validation"] {
    const latestBacktest =
      this.backtests.find((backtest) => backtest.strategyId === strategy.id) ?? null;
    const entryTrade = trades.find((trade) => trade.side === "buy") ?? null;
    const exitTrades = trades.filter((trade) => trade.side === "sell");
    const entryNotional = entryTrade ? entryTrade.price * entryTrade.quantity : 0;
    const realizedPnlUsd = exitTrades.reduce((sum, trade) => sum + trade.realizedPnlUsd, 0);
    const paperReturnPct = entryNotional > 0 ? (realizedPnlUsd / entryNotional) * 100 : 0;
    const backtestReturnPct = latestBacktest?.feeAdjustedReturnPct ?? strategy.validation.feeAdjustedReturnPct;
    const observedDriftPct = Math.abs(backtestReturnPct - paperReturnPct);
    const blendedDriftPct = Number(((strategy.validation.paperDriftPct * 0.75) + (observedDriftPct * 0.25)).toFixed(2));

    return {
      ...strategy.validation,
      sampleSize: strategy.validation.sampleSize + 1,
      paperDriftPct: blendedDriftPct,
    };
  }

  private buildLastPaperCycleSummary(strategyId: string): StrategySummary["lastPaperCycle"] {
    const latestCycle = this.buildPaperCycleHistory(strategyId).at(0);
    if (!latestCycle) {
      return null;
    }

    return {
      status: latestCycle.status,
      realizedPnlUsd: latestCycle.realizedPnlUsd,
      entryNotionalUsd: latestCycle.entryNotionalUsd,
      paperReturnPct: latestCycle.paperReturnPct,
      exitCount: latestCycle.exitCount,
      completedAt: latestCycle.completedAt,
    };
  }

  private buildPaperValidationStats(strategyId: string): StrategySummary["paperValidationStats"] {
    const cycleSummaries = this.buildPaperCycleHistory(strategyId);
    const completedCycles = cycleSummaries.filter((cycle) => cycle.status === "completed");
    const cumulativeRealizedPnlUsd = Number(
      completedCycles.reduce((sum, cycle) => sum + cycle.realizedPnlUsd, 0).toFixed(2),
    );
    const averageReturnPct =
      completedCycles.length > 0
        ? Number(
            (
              completedCycles.reduce((sum, cycle) => sum + cycle.paperReturnPct, 0) /
              completedCycles.length
            ).toFixed(2),
          )
        : 0;
    const winRatePct =
      completedCycles.length > 0
        ? Number(
            (
              (completedCycles.filter((cycle) => cycle.realizedPnlUsd > 0).length / completedCycles.length) *
              100
            ).toFixed(2),
          )
        : 0;

    return {
      cycles: cycleSummaries.length,
      completedCycles: completedCycles.length,
      cumulativeRealizedPnlUsd,
      averageReturnPct,
      winRatePct,
    };
  }

  private buildPaperCycleHistory(strategyId: string): StrategySummary["paperCycleHistory"] {
    const strategyTrades = this.trades.filter((trade) => trade.strategyId === strategyId);
    const cycles = new Map<string, TradeLogEntry[]>();

    for (const trade of strategyTrades) {
      const cycleId = trade.sessionId ?? `${trade.strategyId}-legacy`;
      const cycleTrades = cycles.get(cycleId) ?? [];
      cycleTrades.push(trade);
      cycles.set(cycleId, cycleTrades);
    }

    return [...cycles.entries()]
      .map(([cycleId, cycleTrades]) => {
        const orderedTrades = [...cycleTrades].sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
        const entryTrade = orderedTrades.find((trade) => trade.side === "buy") ?? null;
        const exitTrades = orderedTrades.filter((trade) => trade.side === "sell");
        const firstTrade = orderedTrades.at(0) ?? null;
        const latestTrade = orderedTrades.at(-1) ?? null;
        const entryNotionalUsd = entryTrade ? Number((entryTrade.price * entryTrade.quantity).toFixed(2)) : 0;
        const realizedPnlUsd = Number(exitTrades.reduce((sum, trade) => sum + trade.realizedPnlUsd, 0).toFixed(2));
        const paperReturnPct =
          entryNotionalUsd > 0 ? Number(((realizedPnlUsd / entryNotionalUsd) * 100).toFixed(2)) : 0;

        return {
          sessionId: cycleId,
          status: (exitTrades.length > 0 ? "completed" : "running") as "completed" | "running",
          venue: entryTrade?.venue ?? latestTrade?.venue ?? null,
          executionMode: entryTrade?.executionMode ?? latestTrade?.executionMode ?? null,
          runtimeSource: entryTrade?.runtimeSource ?? latestTrade?.runtimeSource ?? null,
          realizedPnlUsd,
          entryNotionalUsd,
          paperReturnPct,
          exitCount: exitTrades.length,
          startedAt: firstTrade?.createdAt ?? null,
          completedAt: exitTrades.length > 0 ? latestTrade?.createdAt ?? null : null,
        };
      })
      .sort((left, right) => {
        const rightTime = new Date(right.completedAt ?? right.startedAt ?? 0).getTime();
        const leftTime = new Date(left.completedAt ?? left.startedAt ?? 0).getTime();
        return rightTime - leftTime;
      });
  }

  private mergeTradeHistory(existingTrades: TradeLogEntry[], incomingTrades: TradeLogEntry[]): TradeLogEntry[] {
    const deduped = new Map(existingTrades.map((trade) => [trade.id, trade] as const));
    for (const trade of incomingTrades) {
      deduped.set(trade.id, trade);
    }

    return [...deduped.values()].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  private async overlayKrakenPublicPrice(positions: PositionSnapshot[]): Promise<PositionSnapshot[]> {
    return Promise.all(
      positions.map(async (position) => {
        const livePrice = await this.krakenTicker.getLatestPrice(position.symbol);
        if (typeof livePrice !== "number") {
          return position;
        }

        return {
          ...position,
          markPrice: livePrice,
          unrealizedPnlUsd: Number(((livePrice - position.averageEntryPrice) * position.quantity).toFixed(2)),
        };
      }),
    );
  }
}

export async function createHexchangeService(appDir?: string): Promise<HexchangeService> {
  const service = new HexchangeService(appDir);
  await service.initialize();
  return service;
}
