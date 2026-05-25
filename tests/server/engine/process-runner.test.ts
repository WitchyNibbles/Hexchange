import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProcessRunner } from "../../../src/server/engine/process-runner";

const tempDirs: string[] = [];
const bundledPython = path.resolve(process.cwd(), "engine", "nautilus", ".venv", "bin", "python");

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-runner-"));
  tempDirs.push(dir);
  return dir;
}

async function terminateRuntimeWorkers(rootDir: string): Promise<void> {
  const files = await readdir(rootDir).catch(() => []);
  await Promise.all(
    files
      .filter((file) => /^session-.*\.json$/.test(file) && !file.includes("-telemetry") && !file.includes("-state"))
      .map(async (file) => {
        try {
          const parsed = JSON.parse(await readFile(path.join(rootDir, file), "utf8")) as { processId?: number };
          if (typeof parsed.processId === "number" && parsed.processId > 0) {
            process.kill(parsed.processId, "SIGKILL");
          }
        } catch {
          // Best-effort cleanup for failed worker sessions.
        }
      }),
  );
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await terminateRuntimeWorkers(dir);
      await rm(dir, { recursive: true, force: true });
    }),
  );
  delete process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES;
});

describe("process runner", () => {
  it("executes the local python cli and returns a backtest artifact", async () => {
    const runsDir = await createTempDir();
    const runner = createProcessRunner();
    const projectDir = path.resolve(process.cwd(), "engine", "nautilus");
    const pythonPath = existsSync(bundledPython) ? bundledPython : "python3";

    const result = await runner({
      command: "backtest",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
        strategyId: "stock-momentum",
        symbol: "AAPL",
        market: "stock",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.artifactPath).toBeDefined();
    expect(existsSync(result.artifactPath!)).toBe(true);

    const parsed = JSON.parse(readFileSync(result.artifactPath!, "utf8")) as {
      runtimeSource?: string;
      dataSource?: string | null;
    };

    expect(parsed.runtimeSource).toBe(existsSync(bundledPython) ? "nautilus_trader" : "synthetic");
    expect(parsed.dataSource).toBeTruthy();
  });

  it("executes the local python cli for session lifecycle and status", async () => {
    const runsDir = await createTempDir();
    const runner = createProcessRunner();
    const projectDir = path.resolve(process.cwd(), "engine", "nautilus");
    const pythonPath = existsSync(bundledPython) ? bundledPython : "python3";

    const start = await runner({
      command: "start-session",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
        strategyId: "stock-momentum",
      },
    });

    expect(start.ok).toBe(true);
    expect(start.sessionId).toMatch(/^paper-stock-momentum-/);
    expect(existsSync(start.artifactPath!)).toBe(true);

    const startedSession = JSON.parse(readFileSync(start.artifactPath!, "utf8")) as {
      processId?: number | null;
      lastHeartbeatAt?: string | null;
      runtimeSource?: string | null;
      state?: string;
    };

    expect(startedSession.processId).toEqual(expect.any(Number));
    expect(startedSession.lastHeartbeatAt).toBeTruthy();
    expect(startedSession.state).toBe("paper");
    expect(startedSession.runtimeSource).toBe(existsSync(bundledPython) ? "nautilus_trader" : "synthetic");

    const status = await runner({
      command: "status",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
      },
    });

    expect(status.ok).toBe(true);
    expect(existsSync(status.artifactPath!)).toBe(true);

    const parsed = JSON.parse(readFileSync(status.artifactPath!, "utf8")) as {
      runtimeHealth: string;
      nautilusInstalled: boolean;
      nautilusVersion: string | null;
      sessions: Array<{ strategyId: string; state: string; alive?: boolean; processId?: number | null }>;
    };

    expect(["ready", "degraded"]).toContain(parsed.runtimeHealth);
    expect(typeof parsed.nautilusInstalled).toBe("boolean");
    if (parsed.nautilusInstalled) {
      expect(parsed.nautilusVersion).toMatch(/\d+\.\d+\.\d+/);
    }
    expect(parsed.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          strategyId: "stock-momentum",
          state: "paper",
          alive: true,
          processId: expect.any(Number),
        }),
      ]),
    );

    const stop = await runner({
      command: "stop-session",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
        strategyId: "stock-momentum",
      },
    });

    expect(stop.ok).toBe(true);
    const stoppedSession = JSON.parse(readFileSync(stop.artifactPath!, "utf8")) as {
      state?: string;
      stoppedAt?: string | null;
      alive?: boolean;
    };
    expect(stoppedSession.state).toBe("stopped");
    expect(stoppedSession.stoppedAt).toBeTruthy();
  }, 15_000);

  it("emits evolving crypto telemetry with deterministic price steps", async () => {
    const runsDir = await createTempDir();
    const runner = createProcessRunner();
    const projectDir = path.resolve(process.cwd(), "engine", "nautilus");
    const pythonPath = existsSync(bundledPython) ? bundledPython : "python3";
    process.env.HEXCHANGE_KRAKEN_TEST_PRICE_SERIES = "64688,64980,65220";

    const start = await runner({
      command: "start-session",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
        strategyId: "crypto-breakout",
      },
    });

    expect(start.ok).toBe(true);
    expect(start.sessionId).toMatch(/^paper-crypto-breakout-/);

    await new Promise((resolve) => setTimeout(resolve, 1900));

    const telemetryPath = path.join(runsDir, "session-crypto-breakout-telemetry.json");
    const telemetry = JSON.parse(readFileSync(telemetryPath, "utf8")) as {
      sessionId: string;
      positions: Array<{ quantity: number }>;
      trades: Array<{ side: string; quantity: number; realizedPnlUsd: number; sessionId: string }>;
    };

    expect(telemetry.positions).toEqual([]);
    expect(telemetry.sessionId).toBe(start.sessionId);
    expect(telemetry.trades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ side: "buy", quantity: 0.021, sessionId: start.sessionId }),
        expect.objectContaining({ side: "sell", quantity: 0.0105, sessionId: start.sessionId }),
        expect.objectContaining({ side: "sell", quantity: 0.0105, sessionId: start.sessionId }),
      ]),
    );
    expect(telemetry.trades.some((trade) => trade.realizedPnlUsd > 0)).toBe(true);

    await runner({
      command: "stop-session",
      payload: {
        pythonPath,
        projectDir,
        runsDir,
        strategyId: "crypto-breakout",
      },
    });
  }, 20_000);
});
