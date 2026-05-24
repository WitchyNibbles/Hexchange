import request from "supertest";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerApp } from "../../src/server/app";
import { createHexchangeService } from "../../src/server/services/hexchange-service";

describe("operator flow", () => {
  let app: ReturnType<typeof createServerApp>;
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
    const service = await createHexchangeService();
    app = createServerApp(service);
  });

  afterAll(async () => {
    delete process.env.HEXCHANGE_APP_DIR;
    delete process.env.HEXCHANGE_ENGINE_MODE;
    delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
    delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
    delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
    await rm(appDir, { recursive: true, force: true });
    await rm(runsDir, { recursive: true, force: true });
  });

  it("starts paper trading, arms live mode, and halts via kill switch", async () => {
    const engineStatus = await request(app).get("/api/engine/status");
    expect(engineStatus.status).toBe(200);
    expect(engineStatus.body.mode).toBeDefined();
    expect(engineStatus.body.venues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ venue: "interactive_brokers" }),
        expect.objectContaining({ venue: "kraken" }),
      ]),
    );

    const events = await request(app).get("/api/events");
    expect(events.status).toBe(200);
    expect(events.body[0]?.body).toMatch(/interactive brokers|kraken|nautilus/i);

    const backtest = await request(app).post("/api/strategies/stock-momentum/backtest");
    expect(backtest.status).toBe(200);
    expect(backtest.body.strategyId).toBe("stock-momentum");

    const initialSettings = await request(app).get("/api/control/settings");
    expect(initialSettings.status).toBe(200);
    expect(initialSettings.body.maxPositionNotionalUsd).toBeGreaterThan(0);

    const startPaper = await request(app).post("/api/strategies/stock-momentum/paper-session");
    expect(startPaper.status).toBe(200);
    expect(startPaper.body.stage).toBe("paper");

    const armLive = await request(app).post("/api/strategies/stock-momentum/arm-live");
    expect(armLive.status).toBe(200);
    expect(armLive.body.stage).toBe("live");

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

    const stopPaper = await request(app).delete("/api/strategies/stock-momentum/paper-session");
    expect(stopPaper.status).toBe(200);
    expect(stopPaper.body.paperSessionActive).toBe(false);
  });
});
