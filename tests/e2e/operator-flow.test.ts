import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerApp } from "../../src/server/app";
import { createHexchangeService } from "../../src/server/services/hexchange-service";

describe("operator flow", () => {
  let app: ReturnType<typeof createServerApp>;

  beforeAll(async () => {
    process.env.HEXCHANGE_APP_DIR = ".hexchange-test";
    const service = await createHexchangeService();
    app = createServerApp(service);
  });

  afterAll(() => {
    delete process.env.HEXCHANGE_APP_DIR;
  });

  it("starts paper trading, arms live mode, and halts via kill switch", async () => {
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
  });
});
