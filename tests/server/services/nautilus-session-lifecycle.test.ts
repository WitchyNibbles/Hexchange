import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHexchangeService } from "../../../src/server/services/hexchange-service";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-session-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
  delete process.env.HEXCHANGE_ENGINE_MODE;
  delete process.env.HEXCHANGE_NAUTILUS_PYTHON;
  delete process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
  delete process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;
});

describe("nautilus session lifecycle", () => {
  it("persists managed session ids across restarts", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    const first = await createHexchangeService(appDir);

    await first.startPaperSession("stock-momentum");
    const firstSession = first.getManagedSession("stock-momentum");

    expect(firstSession?.sessionId).toContain("paper-stock-momentum");
    expect(firstSession?.processId).toEqual(expect.any(Number));
    expect(firstSession?.lastHeartbeatAt).toBeTruthy();

    const second = await createHexchangeService(appDir);
    const restoredSession = second.getManagedSession("stock-momentum");

    expect(restoredSession).toEqual(firstSession);
  });

  it("can stop a managed session by runtime id", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    const service = await createHexchangeService(appDir);

    await service.startPaperSession("stock-momentum");
    const session = service.getManagedSession("stock-momentum");

    expect(session).not.toBeNull();

    await service.stopManagedSession(session!.sessionId);

    expect(service.getManagedSession("stock-momentum")).toBeNull();
    expect(service.listStrategies().find((strategy) => strategy.id === "stock-momentum")?.paperSessionActive).toBe(false);
  }, 15_000);
});
