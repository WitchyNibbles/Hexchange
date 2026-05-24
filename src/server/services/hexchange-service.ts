import path from "node:path";
import type {
  EngineStatus,
  HealthPayload,
  PortfolioSnapshot,
  RiskSettings,
  StrategySummary,
  SystemStatus,
  TradeSummary,
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
import type { BacktestResult } from "../engine/types";
import { LeanAdapter } from "../engine/lean-adapter";
import { MarketDataService } from "../market/market-data-service";
import { LiveTradingController } from "../live/live-trading-controller";
import { KillSwitch } from "../risk/kill-switch";
import { RiskEngine } from "../risk/risk-engine";
import { RuntimeStateStore } from "../state/runtime-state-store";
import { buildValidationReport } from "../strategies/validation-report";
import { buildReferenceStrategies } from "../strategies/strategy-registry";

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
  private strategies: StrategyState[] = buildReferenceStrategies(this.marketDataService);
  private orders: NormalizedOrder[] = [];
  private positions: PositionSnapshot[] = [];
  private trades: TradeLogEntry[] = [];
  private backtests: BacktestResult[] = [];

  constructor(appDir = process.env.HEXCHANGE_APP_DIR ?? ".hexchange") {
    this.eventStore = new EventStore(path.join(appDir, "events.json"));
    this.runtimeStateStore = new RuntimeStateStore(path.join(appDir, "state.json"));
  }

  async initialize(): Promise<void> {
    await this.eventStore.ensureReady();
    await this.loadPersistedState();
    await this.recordEvent({
      kind: "system",
      title: "Hexchange observatory online",
      body: "The local operator console is ready. Paper mode will use seeded simulation until Alpaca paper credentials are enabled.",
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

    return {
      mode: this.getMode(),
      currentActivity: this.describeActivity(),
      totalProfitUsd,
      totalProfitPct: Number((totalProfitUsd / 10000).toFixed(2)),
      dailyDrawdownPct: 1.4,
      grossExposureUsd,
      activeWarnings: this.killSwitch.getState().engaged ? [this.killSwitch.getState().reason] : [],
      paperStrategies: this.strategies.filter((strategy) => strategy.stage === "paper" || strategy.stage === "candidate_live").length,
      liveStrategies: this.strategies.filter((strategy) => strategy.stage === "live").length,
      killSwitchEngaged: this.killSwitch.getState().engaged,
      dataFreshness: this.positions.some((position) => !this.marketDataService.isFresh(position.symbol)) ? "stale" : "fresh",
    };
  }

  listStrategies(): StrategySummary[] {
    return this.strategies.map((strategy) => ({
      id: strategy.id,
      name: strategy.name,
      market: strategy.market,
      symbol: strategy.symbol,
      stage: strategy.stage,
      currentActivity:
        strategy.stage === "live"
          ? "autonomous live execution armed"
          : strategy.paperSessionActive
            ? "paper session active"
            : "awaiting operator action",
      signal: strategy.signal,
      validation: strategy.validation,
      paperSessionActive: strategy.paperSessionActive,
      liveEligible: buildValidationReport(strategy).passed,
      validationReport: buildValidationReport(strategy).reasons,
      lastBacktest: this.backtests.find((item) => item.strategyId === strategy.id) ?? null,
    }));
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
    await this.recordEvent({
      kind: "system",
      title: `${strategy.name} backtest completed`,
      body: `Backtest return ${result.feeAdjustedReturnPct.toFixed(2)}% with drawdown ${result.maxDrawdownPct.toFixed(2)}%.`,
      severity: "info",
    });
    await this.persistState();
    return result;
  }

  async startPaperSession(strategyId: string): Promise<StrategySummary> {
    const strategy = this.findStrategy(strategyId);
    const session = await this.engineAdapter.startPaperSession(strategyId);
    this.updateStrategy({
      ...transitionStrategyState(strategy, "paper"),
      paperSessionActive: true,
    });

    await this.recordEvent({
      kind: "paper_session",
      title: `${strategy.name} entered paper mode`,
      body: `Session ${session.sessionId} started for ${strategy.symbol}.`,
      severity: "info",
    });

    if (strategy.signal) {
      const intent: OrderIntent = {
        id: createId("order"),
        strategyId: strategy.id,
        symbol: strategy.symbol,
        market: strategy.market,
        side: "buy",
        quantity: strategy.market === "stock" ? 5 : 0.05,
        submittedAt: new Date().toISOString(),
        rationale: buildSignalNarrative(strategy.name, strategy.signal),
      };

      const riskCheck = this.riskEngine.evaluateOrder(intent, this.positions, this.getSystemStatus().dailyDrawdownPct);
      if (!riskCheck.approved) {
        await this.recordEvent({
          kind: "risk",
          title: `${strategy.name} order blocked`,
          body: riskCheck.reason,
          severity: "warning",
        });
      } else {
        const order = await this.executePaperOrder(intent);
        this.orders.unshift(order);
        await this.recordEvent({
          kind: "order",
          title: `${strategy.name} placed a paper order`,
          body: buildOrderNarrative(intent),
          severity: "info",
        });
      }
    }

    await this.persistState();

    return this.listStrategies().find((item) => item.id === strategyId)!;
  }

  async armLiveStrategy(strategyId: string): Promise<StrategySummary> {
    const strategy = this.findStrategy(strategyId);
    const armed = this.liveTradingController.armStrategy(strategy);
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

    if (this.engineAdapter instanceof LeanAdapter) {
      this.engineAdapter.setOrders(intent.strategyId, this.orders);
      this.engineAdapter.setPositions(intent.strategyId, this.positions);
    }

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
      return `${paper.name} is paper trading ${paper.symbol}.`;
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
    this.riskSettings.maxPositionNotionalUsd = snapshot.riskSettings.maxPositionNotionalUsd;
    this.riskSettings.maxDailyLossPct = snapshot.riskSettings.maxDailyLossPct;
    this.riskSettings.liveRolloutCapUsd = snapshot.riskSettings.liveRolloutCapUsd;
    if (snapshot.killSwitch.engaged) {
      this.killSwitch.engage(snapshot.killSwitch.reason);
    }
    if (this.engineAdapter instanceof LeanAdapter) {
      this.engineAdapter.seedBacktests(this.backtests);
    }
  }

  private async persistState(): Promise<void> {
    await this.runtimeStateStore.save({
      strategies: this.strategies,
      orders: this.orders,
      positions: this.positions,
      trades: this.trades,
      backtests: this.backtests,
      riskSettings: this.riskSettings,
      killSwitch: this.killSwitch.getState(),
    });
  }
}

export async function createHexchangeService(appDir?: string): Promise<HexchangeService> {
  const service = new HexchangeService(appDir);
  await service.initialize();
  return service;
}
