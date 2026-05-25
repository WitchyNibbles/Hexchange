import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHexchangeService, HexchangeService } from "../../../src/server/services/hexchange-service";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hexchange-state-"));
  tempDirs.push(dir);
  return dir;
}

async function waitForPaperCycleCompletion(service: HexchangeService, strategyId: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await service.refreshRuntimeTelemetry();
    const positions = service.getPortfolioSnapshot().positions.filter((position) => position.symbol === "BTCUSD");
    if (positions.length === 0 && service.getManagedSession(strategyId) === null) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${strategyId} paper cycle completion`);
}

async function waitForAutoRestart(service: HexchangeService, strategyId: string, timeoutMs = 6000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await service.refreshRuntimeTelemetry();
    const activeSession = service.getManagedSession(strategyId);
    const cycleTrades = service.listTrades().filter((trade) => trade.strategyId === strategyId);
    const completedSessionIds = new Set(
      cycleTrades
        .filter((trade) => trade.side === "sell" && trade.sessionId)
        .map((trade) => trade.sessionId as string),
    );

    if (activeSession && completedSessionIds.size > 0 && !completedSessionIds.has(activeSession.sessionId)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${strategyId} paper automation restart`);
}

async function terminateRuntimeWorkers(rootDir: string): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await readdir(rootDir);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.startsWith("session-") && entry.endsWith(".json"))
      .map(async (entry) => {
        try {
          const parsed = JSON.parse(await readFile(path.join(rootDir, entry), "utf8")) as { processId?: number };
          if (typeof parsed.processId === "number" && parsed.processId > 0) {
            try {
              process.kill(parsed.processId, "SIGKILL");
            } catch {
              // Worker already exited.
            }
          }
        } catch {
          // Ignore malformed artifacts during teardown.
        }
      }),
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => terminateRuntimeWorkers(dir)));
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
  delete process.env.HEXCHANGE_ENGINE_MODE;
  delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
  delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
  delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
  delete process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES;
  delete process.env.HEXCHANGE_VALIDATION_TARGET_HOURS;
  delete process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES;
  delete process.env.HEXCHANGE_VALIDATION_STALE_HOURS;
});

describe("hexchange service persistence", () => {
  it("persists trades, settings, and kill-switch state across restarts", async () => {
    const appDir = await createTempDir();
    const first = await createHexchangeService(appDir);

    await first.startPaperSession("stock-momentum");
    await first.updateRiskSettings({
      maxDailyLossPct: 4.5,
      maxPositionNotionalUsd: 25000,
      liveRolloutCapUsd: 750,
    });
    await first.engageKillSwitch("Persistence test halt");
    expect(first.getManagedSession("stock-momentum")).toBeNull();

    const second = await createHexchangeService(appDir);
    const settings = second.getRiskSettings();
    const status = second.getSystemStatus();
    const trades = second.listTrades();
    const strategies = second.listStrategies();

    expect(settings.maxDailyLossPct).toBe(4.5);
    expect(settings.maxPositionNotionalUsd).toBe(25000);
    expect(settings.liveRolloutCapUsd).toBe(750);
    expect(status.killSwitchEngaged).toBe(true);
    expect(trades.length).toBeGreaterThan(0);
    expect(strategies.some((strategy) => strategy.stage === "halted")).toBe(true);
  });

  it("can reset the kill switch without losing persisted trade history", async () => {
    const appDir = await createTempDir();
    const service = await createHexchangeService(appDir);

    await service.startPaperSession("stock-momentum");
    await service.engageKillSwitch("Manual halt");
    await service.resetKillSwitch();

    expect(service.getSystemStatus().killSwitchEngaged).toBe(false);
    expect(service.listTrades().length).toBeGreaterThan(0);
  });

  it("persists backtest evidence and engine status across restarts", async () => {
    const appDir = await createTempDir();
    const first = await createHexchangeService(appDir);

    const backtest = await first.runStrategyBacktest("stock-momentum");
    expect(backtest.strategyId).toBe("stock-momentum");
    expect(backtest.runtimeSource).toBeTruthy();

    const updatedStrategy = first.listStrategies().find((item) => item.id === "stock-momentum");
    expect(updatedStrategy?.validation.feeAdjustedReturnPct).toBe(backtest.feeAdjustedReturnPct);
    expect(updatedStrategy?.validation.maxDrawdownPct).toBe(backtest.maxDrawdownPct);

    const second = await createHexchangeService(appDir);
    const engineStatus = await second.getEngineStatus();
    const restoredStrategy = second.listStrategies().find((item) => item.id === "stock-momentum");

    expect(engineStatus.latestBacktests.some((item) => item.strategyId === "stock-momentum")).toBe(true);
    expect(restoredStrategy?.validation.feeAdjustedReturnPct).toBe(backtest.feeAdjustedReturnPct);
    expect(restoredStrategy?.validation.maxDrawdownPct).toBe(backtest.maxDrawdownPct);
  });

  it("requires a real backtest before arming live trading", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");

    await expect(service.armLiveStrategy("crypto-breakout")).rejects.toThrow(/real nautilus backtest/i);

    await service.runStrategyBacktest("crypto-breakout");

    await expect(service.armLiveStrategy("crypto-breakout")).rejects.toThrow(/at least 2 Kraken paper cycles/i);

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");
    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const armed = await service.armLiveStrategy("crypto-breakout");
    expect(armed.stage).toBe("live");
  }, 15_000);

  it("hydrates crypto paper telemetry from the Nautilus runtime", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");
    await service.refreshRuntimeTelemetry();

    const portfolio = service.getPortfolioSnapshot();
    const trades = service.listTrades();

    expect(portfolio.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "BTCUSD",
          quantity: 0.021,
          market: "crypto",
        }),
      ]),
    );
    expect(trades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategyId: "crypto-breakout",
          symbol: "BTCUSD",
          quantity: 0.021,
          explanation: "Kraken runtime telemetry executed the active crypto validation leg.",
        }),
      ]),
    );

    await service.stopPaperSession("crypto-breakout");
  }, 15_000);

  it("overlays live Kraken public prices onto crypto runtime telemetry", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const service = new HexchangeService(appDir, {
      krakenTicker: {
        getLatestPrice: async () => 77512,
      },
    });
    await service.initialize();

    await service.startPaperSession("crypto-breakout");
    await service.refreshRuntimeTelemetry();

    const portfolio = service.getPortfolioSnapshot();

    expect(portfolio.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "BTCUSD",
          markPrice: 77512,
        }),
      ]),
    );

    await service.stopPaperSession("crypto-breakout");
  }, 15_000);

  it("advances crypto paper telemetry through partial and final exits", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const service = await createHexchangeService(appDir);

    await service.runStrategyBacktest("crypto-breakout");
    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const portfolio = service.getPortfolioSnapshot();
    const trades = service.listTrades().filter((trade) => trade.strategyId === "crypto-breakout");

    expect(portfolio.positions).toEqual([]);
    expect(trades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          side: "buy",
          quantity: 0.021,
          venue: "kraken",
          executionMode: "paper",
          runtimeSource: "nautilus_trader",
          sessionId: expect.stringMatching(/^paper-crypto-breakout-/),
        }),
        expect.objectContaining({
          side: "sell",
          quantity: 0.0105,
          venue: "kraken",
          executionMode: "paper",
          runtimeSource: "nautilus_trader",
          sessionId: expect.stringMatching(/^paper-crypto-breakout-/),
        }),
        expect.objectContaining({
          side: "sell",
          quantity: 0.0105,
          venue: "kraken",
          executionMode: "paper",
          runtimeSource: "nautilus_trader",
          sessionId: expect.stringMatching(/^paper-crypto-breakout-/),
        }),
      ]),
    );
    expect(trades.some((trade) => trade.realizedPnlUsd > 0)).toBe(true);
    expect(service.getManagedSession("crypto-breakout")).toBeNull();
    const completedStrategy = service.listStrategies().find((strategy) => strategy.id === "crypto-breakout");
    expect(completedStrategy?.paperSessionActive).toBe(false);
    expect(completedStrategy?.validation.paperDriftPct).not.toBe(3.4);
    expect(completedStrategy?.validation.sampleSize).toBeGreaterThan(48);
    expect(completedStrategy?.lastPaperCycle).toEqual(
      expect.objectContaining({
        realizedPnlUsd: expect.any(Number),
        exitCount: 2,
        status: "completed",
      }),
    );
    expect(service.getSystemStatus().mode).toBe("research");
    await expect(service.armLiveStrategy("crypto-breakout")).rejects.toThrow(/at least 2 Kraken paper cycles/i);

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const validatedStrategy = service.listStrategies().find((strategy) => strategy.id === "crypto-breakout");
    expect(validatedStrategy?.liveEvidenceProgress).toEqual(
      expect.objectContaining({
        ready: true,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "real-backtest",
            status: "pass",
          }),
          expect.objectContaining({
            id: "completed-cycles",
            status: "pass",
            summary: "2/2 completed.",
          }),
        ]),
      }),
    );

    const armedAfterCompletion = await service.armLiveStrategy("crypto-breakout");
    expect(armedAfterCompletion.stage).toBe("live");
    expect(service.getSystemStatus().mode).toBe("live");
  }, 20_000);

  it("preserves prior Kraken paper cycles as validation history", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");
    const firstCycleTradeIds = new Set(
      service
        .listTrades()
        .filter((trade) => trade.strategyId === "crypto-breakout")
        .map((trade) => trade.id),
    );
    const firstCycleSessionIds = new Set(
      service
        .listTrades()
        .filter((trade) => trade.strategyId === "crypto-breakout")
        .map((trade) => trade.sessionId),
    );

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const allCycleTrades = service.listTrades().filter((trade) => trade.strategyId === "crypto-breakout");
    const sessionIds = new Set(allCycleTrades.map((trade) => trade.sessionId));

    expect(allCycleTrades).toHaveLength(6);
    expect(sessionIds.size).toBe(2);
    expect([...sessionIds]).toEqual(expect.arrayContaining([...firstCycleSessionIds]));
    expect(allCycleTrades.some((trade) => !firstCycleTradeIds.has(trade.id))).toBe(true);
    const updatedStrategy = service.listStrategies().find((strategy) => strategy.id === "crypto-breakout");
    expect(updatedStrategy?.lastPaperCycle).toEqual(
      expect.objectContaining({
        status: "completed",
        exitCount: 2,
      }),
    );
    expect(updatedStrategy?.paperValidationStats).toEqual(
      expect.objectContaining({
        cycles: 2,
        completedCycles: 2,
        cumulativeRealizedPnlUsd: expect.any(Number),
        averageReturnPct: expect.any(Number),
        winRatePct: 100,
      }),
    );
    expect(updatedStrategy?.liveEvidenceProgress).toEqual(
      expect.objectContaining({
        ready: false,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "real-backtest",
            status: "blocked",
          }),
          expect.objectContaining({
            id: "completed-cycles",
            status: "pass",
            summary: "2/2 completed.",
          }),
          expect.objectContaining({
            id: "net-pnl",
            status: "pass",
          }),
        ]),
      }),
    );
    expect(updatedStrategy?.paperCycleHistory).toHaveLength(2);
    expect(updatedStrategy?.paperCycleHistory[0]).toEqual(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^paper-crypto-breakout-/),
        status: "completed",
        venue: "kraken",
        executionMode: "paper",
        runtimeSource: "nautilus_trader",
        exitCount: 2,
      }),
    );
    expect(updatedStrategy?.paperCycleHistory[1]).toEqual(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^paper-crypto-breakout-/),
        status: "completed",
        venue: "kraken",
      }),
    );
  }, 20_000);

  it("automatically restarts crypto paper validation when automation is enabled", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const service = await createHexchangeService(appDir);

    await service.updatePaperAutomation("crypto-breakout", true);
    await service.startPaperSession("crypto-breakout");
    await waitForAutoRestart(service, "crypto-breakout", 6000);

    const restartedSession = service.getManagedSession("crypto-breakout");
    const updatedStrategy = service.listStrategies().find((strategy) => strategy.id === "crypto-breakout");
    const trades = service.listTrades().filter((trade) => trade.strategyId === "crypto-breakout");
    const completedSessionIds = new Set(
      trades.filter((trade) => trade.side === "sell").map((trade) => trade.sessionId),
    );

    expect(updatedStrategy?.autoPaperValidationEnabled).toBe(true);
    expect(updatedStrategy?.paperSessionActive).toBe(true);
    expect(restartedSession?.sessionId).toMatch(/^paper-crypto-breakout-/);
    expect(completedSessionIds.size).toBeGreaterThanOrEqual(1);
    expect(completedSessionIds.has(restartedSession?.sessionId ?? "")).toBe(false);
  }, 20_000);

  it("records validation campaign milestones as paper evidence begins and target is reached", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";
    process.env.HEXCHANGE_VALIDATION_TARGET_HOURS = "0";
    process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES = "1";

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const campaign = service.getValidationCampaignSummary();
    const events = await service.listEvents();

    expect(campaign).toEqual(
      expect.objectContaining({
        status: "ready",
        summary: "Forward validation target reached.",
        observedHoursTarget: 0,
        completedCyclesTarget: 1,
        campaignReady: true,
      }),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Forward validation started",
        }),
        expect.objectContaining({
          title: "Forward validation target reached",
        }),
      ]),
    );
  }, 20_000);

  it("marks the validation campaign stalled when evidence stops progressing for too long", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";
    process.env.HEXCHANGE_VALIDATION_TARGET_HOURS = "24";
    process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES = "10";
    process.env.HEXCHANGE_VALIDATION_STALE_HOURS = "0";

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");
    await waitForPaperCycleCompletion(service, "crypto-breakout");

    const campaign = service.getValidationCampaignSummary();
    const status = service.getSystemStatus();

    expect(campaign).toEqual(
      expect.objectContaining({
        status: "stalled",
        summary: "Kraken paper validation looks stale. Restart or inspect the paper runtime.",
        campaignReady: false,
      }),
    );
    expect(status.activeWarnings).toContain(
      "Kraken paper validation looks stale. Restart or inspect the paper runtime.",
    );
  }, 20_000);

  it("keeps stock strategies simulation-only even after backtest and paper activity", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = bundledPython;
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const service = await createHexchangeService(appDir);

    await service.runStrategyBacktest("stock-momentum");
    await service.startPaperSession("stock-momentum");

    await expect(service.armLiveStrategy("stock-momentum")).rejects.toThrow(/simulation-only/i);

    const strategy = service.listStrategies().find((item) => item.id === "stock-momentum");
    expect(strategy?.deploymentMode).toBe("simulation_only");
    expect(strategy?.liveEligible).toBe(false);
  }, 15_000);

  it("builds a live readiness report with venue and strategy blockers", async () => {
    const appDir = await createTempDir();
    const service = await createHexchangeService(appDir);

    const report = await service.getLiveReadinessReport();

    expect(report.overallStatus).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "interactive_brokers-connectivity", status: "pass" }),
        expect.objectContaining({ id: "kraken-connectivity", status: "fail" }),
      ]),
    );
    expect(report.strategies.some((strategy) => strategy.deploymentMode === "simulation_only")).toBe(true);
    expect(report.strategies.some((strategy) => strategy.blocking)).toBe(true);
  });
});
