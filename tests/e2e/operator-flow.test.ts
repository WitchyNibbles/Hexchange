import request from "supertest";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerApp } from "../../src/server/app";
import { createHexchangeService } from "../../src/server/services/hexchange-service";

async function waitForCompletedCycles(
  app: ReturnType<typeof createServerApp>,
  minimumCompletedCycles: number,
  timeoutMs = 10000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const strategies = await request(app).get("/api/strategies");
    const cryptoStrategy = strategies.body.find((strategy: { id: string }) => strategy.id === "crypto-breakout");
    if (cryptoStrategy?.paperValidationStats?.completedCycles >= minimumCompletedCycles) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${minimumCompletedCycles} completed crypto paper cycles`);
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

describe("operator flow", () => {
  let app: ReturnType<typeof createServerApp>;
  let service: Awaited<ReturnType<typeof createHexchangeService>>;
  let appDir: string;
  let runsDir: string;

  beforeAll(async () => {
    appDir = await mkdtemp(path.join(os.tmpdir(), "hexchange-operator-app-"));
    runsDir = await mkdtemp(path.join(os.tmpdir(), "hexchange-operator-runs-"));
    process.env.HEXCHANGE_APP_DIR = appDir;
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");
    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";
    process.env.HEXCHANGE_VALIDATION_TARGET_HOURS = "0";
    process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES = "2";
    service = await createHexchangeService();
    service.startRuntimeHeartbeat(100);
    app = createServerApp(service);
  });

  afterAll(async () => {
    await service.stopRuntimeHeartbeat();
    await terminateRuntimeWorkers(runsDir);
    delete process.env.HEXCHANGE_APP_DIR;
    delete process.env.HEXCHANGE_ENGINE_MODE;
    delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
    delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
    delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
    delete process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES;
    delete process.env.HEXCHANGE_VALIDATION_TARGET_HOURS;
    delete process.env.HEXCHANGE_VALIDATION_TARGET_CYCLES;
    await rm(appDir, { recursive: true, force: true });
    await rm(runsDir, { recursive: true, force: true });
  });

  it("starts paper trading, arms crypto live mode, and halts via kill switch", async () => {
    const engineStatus = await request(app).get("/api/engine/status");
    expect(engineStatus.status).toBe(200);
    expect(engineStatus.body.mode).toBeDefined();
    expect(engineStatus.body.venues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ venue: "interactive_brokers" }),
        expect.objectContaining({ venue: "kraken" }),
      ]),
    );

    const initialReadiness = await request(app).get("/api/control/live-readiness");
    expect(initialReadiness.status).toBe(200);
    expect(initialReadiness.body.overallStatus).toBeDefined();
    expect(initialReadiness.body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "nautilus-runtime" }),
        expect.objectContaining({ id: "interactive_brokers-connectivity" }),
        expect.objectContaining({ id: "kraken-connectivity" }),
      ]),
    );

    const initialCampaign = await request(app).get("/api/control/validation-campaign");
    expect(initialCampaign.status).toBe(200);
    expect(initialCampaign.body).toEqual(
      expect.objectContaining({
        observedHoursTarget: 0,
        completedCyclesTarget: 2,
        campaignReady: false,
      }),
    );

    const events = await request(app).get("/api/events");
    expect(events.status).toBe(200);
    expect(events.body[0]?.body).toMatch(/interactive brokers|kraken|nautilus/i);

    const backtest = await request(app).post("/api/strategies/crypto-breakout/backtest");
    expect(backtest.status).toBe(200);
    expect(backtest.body.strategyId).toBe("crypto-breakout");

    const initialSettings = await request(app).get("/api/control/settings");
    expect(initialSettings.status).toBe(200);
    expect(initialSettings.body.maxPositionNotionalUsd).toBeGreaterThan(0);

    const enableAutoPaper = await request(app)
      .patch("/api/strategies/crypto-breakout/paper-automation")
      .send({ autoPaperValidationEnabled: true });
    expect(enableAutoPaper.status).toBe(200);
    expect(enableAutoPaper.body.autoPaperValidationEnabled).toBe(true);

    const startPaper = await request(app).post("/api/strategies/crypto-breakout/paper-session");
    expect(startPaper.status).toBe(200);
    expect(startPaper.body.stage).toBe("paper");

    await waitForCompletedCycles(app, 2);

    const activeCampaign = await request(app).get("/api/control/validation-campaign");
    expect(activeCampaign.status).toBe(200);
    expect(activeCampaign.body).toEqual(
      expect.objectContaining({
        completedCycles: expect.any(Number),
        firstObservedCycleAt: expect.any(String),
      }),
    );

    const stockLiveAttempt = await request(app).post("/api/strategies/stock-momentum/arm-live");
    expect(stockLiveAttempt.status).toBe(400);
    expect(stockLiveAttempt.body.error).toMatch(/simulation-only/i);

    const armLive = await request(app).post("/api/strategies/crypto-breakout/arm-live");
    expect(armLive.status).toBe(200);
    expect(armLive.body.stage).toBe("live");

    const midReadiness = await request(app).get("/api/control/live-readiness");
    expect(midReadiness.status).toBe(200);
    expect(midReadiness.body.strategies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategyId: "crypto-breakout",
          lastBacktestSource: "nautilus_trader",
        }),
      ]),
    );

    const kill = await request(app)
      .post("/api/control/kill-switch")
      .send({ reason: "Test halt" });
    expect(kill.status).toBe(200);
    expect(kill.body.killSwitchEngaged).toBe(true);

    const updateSettings = await request(app)
      .patch("/api/control/settings")
      .send({ maxDailyLossPct: 4.25, liveRolloutCapUsd: 900 });
    expect(updateSettings.status).toBe(200);
    expect(updateSettings.body.maxDailyLossPct).toBe(4.25);
    expect(updateSettings.body.liveRolloutCapUsd).toBe(900);

    const reset = await request(app).post("/api/control/kill-switch/reset");
    expect(reset.status).toBe(200);
    expect(reset.body.killSwitchEngaged).toBe(false);

    const finalReadiness = await request(app).get("/api/control/live-readiness");
    expect(finalReadiness.status).toBe(200);
    expect(finalReadiness.body.summary).toMatch(/blocked|ready|resolve/i);

    const stopPaper = await request(app).delete("/api/strategies/crypto-breakout/paper-session");
    expect(stopPaper.status).toBe(200);
    expect(stopPaper.body.paperSessionActive).toBe(false);
  }, 15000);
});
