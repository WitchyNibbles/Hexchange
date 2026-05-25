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

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");

    await expect(service.armLiveStrategy("crypto-breakout")).rejects.toThrow(/real nautilus backtest/i);

    await service.runStrategyBacktest("crypto-breakout");

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
    await new Promise((resolve) => setTimeout(resolve, 1400));
    await service.refreshRuntimeTelemetry();

    const portfolio = service.getPortfolioSnapshot();
    const trades = service.listTrades().filter((trade) => trade.strategyId === "crypto-breakout");

    expect(portfolio.positions).toEqual([]);
    expect(trades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ side: "buy", quantity: 0.021 }),
        expect.objectContaining({ side: "sell", quantity: 0.0105 }),
        expect.objectContaining({ side: "sell", quantity: 0.0105 }),
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
    const armedAfterCompletion = await service.armLiveStrategy("crypto-breakout");
    expect(armedAfterCompletion.stage).toBe("live");
    expect(service.getSystemStatus().mode).toBe("live");
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
