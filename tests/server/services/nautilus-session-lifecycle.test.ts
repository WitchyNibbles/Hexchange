import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createHexchangeService } from "../../../src/server/services/hexchange-service";

const tempDirs: string[] = [];
const backgroundProcesses: Array<{ kill(signal?: NodeJS.Signals | number): boolean }> = [];

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
  for (const child of backgroundProcesses.splice(0)) {
    child.kill("SIGKILL");
  }
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

  it("restarts a managed session if a legacy paper artifact is alive but missing telemetry", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    const dummyProcess = spawn("node", ["-e", "setTimeout(() => {}, 30000)"], {
      stdio: "ignore",
      detached: true,
    });
    backgroundProcesses.push(dummyProcess);
    const telemetryPath = path.join(runsDir, "session-crypto-breakout-telemetry.json");
    const sessionPath = path.join(runsDir, "session-crypto-breakout.json");

    await writeFile(
      sessionPath,
      JSON.stringify(
        {
          sessionId: "paper-crypto-breakout",
          strategyId: "crypto-breakout",
          startedAt: "2026-05-25T17:00:00.000Z",
          lastHeartbeatAt: "2026-05-25T17:00:01.000Z",
          processId: dummyProcess.pid,
          runtimeSource: "nautilus_trader",
          executionMode: "kraken_ready",
          state: "paper",
          alive: true,
        },
        null,
        2,
      ),
      "utf8",
    );

    const service = await createHexchangeService(appDir);

    await service.startPaperSession("crypto-breakout");
    const restartedSession = service.getManagedSession("crypto-breakout");

    expect(restartedSession?.processId).not.toBe(dummyProcess.pid);
    expect(existsSync(telemetryPath)).toBe(true);
  }, 15_000);
});
