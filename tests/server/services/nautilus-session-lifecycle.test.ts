import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
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

    expect(restoredSession?.sessionId).toBe(firstSession?.sessionId);
    expect(restoredSession?.strategyId).toBe(firstSession?.strategyId);
    expect(restoredSession?.processId).toBe(firstSession?.processId);
    expect(restoredSession?.startedAt).toBe(firstSession?.startedAt);
    expect(restoredSession?.lastHeartbeatAt).toBeTruthy();
  }, 15_000);

  it("reattaches an active runtime session even when the new app state starts empty", async () => {
    const firstAppDir = await createTempDir();
    const secondAppDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;

    const first = await createHexchangeService(firstAppDir);
    await first.startPaperSession("crypto-breakout");

    const second = await createHexchangeService(secondAppDir);
    const restoredStrategy = second.listStrategies().find((strategy) => strategy.id === "crypto-breakout");
    const restoredSession = second.getManagedSession("crypto-breakout");
    const campaign = second.getValidationCampaignSummary();

    expect(restoredSession?.sessionId).toContain("paper-crypto-breakout");
    expect(restoredSession?.processId).toEqual(expect.any(Number));
    expect(restoredStrategy?.paperSessionActive).toBe(true);
    expect(campaign.status).toBe("collecting");
    expect(campaign.firstObservedCycleAt).toBeTruthy();
  }, 15_000);

  it("can stop a managed session by runtime id", async () => {
    const appDir = await createTempDir();
    const runsDir = await createTempDir();
    const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = path.resolve(process.cwd(), "engine", "nautilus");
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = runsDir;
    const service = await createHexchangeService(appDir);

    const started = await service.startPaperSession("stock-momentum");
    const session = started.paperSession ?? service.getManagedSession("stock-momentum");

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

  it("restarts a managed session if the existing worker heartbeat is stale", async () => {
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
    const sessionPath = path.join(runsDir, "session-crypto-breakout.json");
    const telemetryPath = path.join(runsDir, "session-crypto-breakout-telemetry.json");

    await writeFile(
      sessionPath,
      JSON.stringify(
        {
          sessionId: "paper-crypto-breakout-stale",
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
    await writeFile(
      telemetryPath,
      JSON.stringify(
        {
          sessionId: "paper-crypto-breakout-stale",
          strategyId: "crypto-breakout",
          updatedAt: "2026-05-25T17:00:01.000Z",
          orders: [],
          positions: [],
          trades: [],
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
    expect(restartedSession?.sessionId).not.toBe("paper-crypto-breakout-stale");
  }, 15_000);

  it("deduplicates concurrent paper-session starts for the same strategy", async () => {
    const appDir = await createTempDir();
    const service = await createHexchangeService(appDir);
    const engineAdapter = (service as unknown as {
      engineAdapter: {
        startPaperSession(strategyId: string): Promise<{
          sessionId: string;
          strategyId: string;
          startedAt: string;
          runtimeSource: "synthetic";
          executionMode: "simulated";
        }>;
      };
    }).engineAdapter;
    const originalStartPaperSession = engineAdapter.startPaperSession.bind(engineAdapter);
    let startCalls = 0;

    engineAdapter.startPaperSession = async (strategyId: string) => {
      startCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return originalStartPaperSession(strategyId);
    };

    const [first, second] = await Promise.all([
      service.startPaperSession("crypto-breakout"),
      service.startPaperSession("crypto-breakout"),
    ]);

    expect(startCalls).toBe(1);
    expect(first.paperSession?.sessionId).toBeTruthy();
    expect(second.paperSession?.sessionId).toBe(first.paperSession?.sessionId);
  });
});
