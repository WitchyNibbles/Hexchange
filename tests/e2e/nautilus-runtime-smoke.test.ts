import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServerApp } from "../../src/server/app";
import { createHexchangeService } from "../../src/server/services/hexchange-service";

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
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
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  delete process.env.HEXCHANGE_ENGINE_MODE;
  delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
  delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
  delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
  delete process.env.HEXCHANGE_APP_DIR;
  delete process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES;
  delete process.env.HEXCHANGE_VALIDATION_TARGET_HOURS;
  delete process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES;
});

describe("nautilus runtime smoke", () => {
  it("runs a local backtest and managed paper session in nautilus mode", async () => {
    const appDir = await createTempDir("hexchange-nautilus-app-");
    const runsDir = await createTempDir("hexchange-nautilus-runs-");
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_APP_DIR = appDir;
    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const service = await createHexchangeService(appDir);
    const app = createServerApp(service);

    const engineStatus = await request(app).get("/api/engine/status");
    expect(engineStatus.status).toBe(200);
    expect(engineStatus.body.mode).toBe("nautilus");

    const backtest = await request(app).post("/api/strategies/stock-momentum/backtest");
    expect(backtest.status).toBe(200);
    expect(backtest.body.strategyId).toBe("stock-momentum");
    expect(backtest.body.runId).toContain("backtest-stock-momentum");
    expect(backtest.body.runtimeSource).toBe(existsSync(bundledPython) ? "nautilus_trader" : "synthetic");
    expect(backtest.body.dataSource).toBeTruthy();

    const session = await request(app).post("/api/strategies/stock-momentum/paper-session");
    expect(session.status).toBe(200);
    expect(session.body.paperSessionActive).toBe(true);
    expect(session.body.paperSession).toEqual(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^paper-stock-momentum-/),
      }),
    );

    const stopSession = await request(app).delete("/api/strategies/stock-momentum/paper-session");
    expect(stopSession.status).toBe(200);
    expect(stopSession.body.paperSessionActive).toBe(false);

    const events = await request(app).get("/api/events");
    expect(events.status).toBe(200);
    expect(events.body.some((event: { kind: string }) => event.kind === "paper_session")).toBe(true);
  }, 10_000);

  it("surfaces Kraken paper telemetry through the operator APIs", async () => {
    const appDir = await createTempDir("hexchange-nautilus-app-");
    const runsDir = await createTempDir("hexchange-nautilus-runs-");
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_APP_DIR = appDir;
    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const service = await createHexchangeService(appDir);
    const app = createServerApp(service);

    const session = await request(app).post("/api/strategies/crypto-breakout/paper-session");
    expect(session.status).toBe(200);
    expect(session.body.paperSessionActive).toBe(true);

    const portfolio = await request(app).get("/api/system/portfolio");
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "BTCUSD",
          quantity: 0.021,
          market: "crypto",
        }),
      ]),
    );

    const trades = await request(app).get("/api/trades");
    expect(trades.status).toBe(200);
    expect(trades.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategyId: "crypto-breakout",
          symbol: "BTCUSD",
          quantity: 0.021,
          explanation: "Kraken runtime telemetry executed the active crypto validation leg.",
        }),
      ]),
    );
  }, 10_000);

  it("keeps crypto paper validation running with the background heartbeat", async () => {
    const appDir = await createTempDir("hexchange-nautilus-app-");
    const runsDir = await createTempDir("hexchange-nautilus-runs-");
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_APP_DIR = appDir;
    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const service = await createHexchangeService(appDir);
    service.startRuntimeHeartbeat(100);
    const app = createServerApp(service);

    try {
      const automation = await request(app)
        .patch("/api/strategies/crypto-breakout/paper-automation")
        .send({ autoPaperValidationEnabled: true });
      expect(automation.status).toBe(200);
      expect(automation.body.autoPaperValidationEnabled).toBe(true);

      const session = await request(app).post("/api/strategies/crypto-breakout/paper-session");
      expect(session.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 1800));

      const strategies = await request(app).get("/api/strategies");
      expect(strategies.status).toBe(200);
      expect(strategies.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "crypto-breakout",
            autoPaperValidationEnabled: true,
            paperValidationStats: expect.objectContaining({
              completedCycles: expect.any(Number),
            }),
          }),
        ]),
      );
      const cryptoStrategy = strategies.body.find((strategy: { id: string }) => strategy.id === "crypto-breakout");
      expect(cryptoStrategy.paperValidationStats.completedCycles).toBeGreaterThanOrEqual(1);
      if (cryptoStrategy.paperSession) {
        expect(cryptoStrategy.paperSession.sessionId).toMatch(/^paper-crypto-breakout-/);
      }
    } finally {
      await service.stopRuntimeHeartbeat();
    }
  }, 10_000);
});
