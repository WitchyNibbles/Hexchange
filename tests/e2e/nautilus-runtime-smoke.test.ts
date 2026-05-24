import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
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

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  delete process.env.HEXCHANGE_ENGINE_MODE;
  delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
  delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
  delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
  delete process.env.HEXCHANGE_APP_DIR;
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

    const session = await request(app).post("/api/strategies/stock-momentum/paper-session");
    expect(session.status).toBe(200);
    expect(session.body.paperSessionActive).toBe(true);
    expect(existsSync(path.join(runsDir, "session-stock-momentum.json"))).toBe(true);

    const events = await request(app).get("/api/events");
    expect(events.status).toBe(200);
    expect(events.body.some((event: { kind: string }) => event.kind === "paper_session")).toBe(true);
  });
});
