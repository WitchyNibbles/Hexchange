import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProcessRunner } from "../../../src/server/engine/process-runner";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hexchange-nautilus-runner-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("process runner", () => {
  it("executes the local python cli and returns a backtest artifact", async () => {
    const runsDir = await createTempDir();
    const runner = createProcessRunner();
    const projectDir = path.resolve(process.cwd(), "engine", "nautilus");

    const result = await runner({
      command: "backtest",
      payload: {
        pythonPath: "python3",
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
  });

  it("executes the local python cli for session lifecycle and status", async () => {
    const runsDir = await createTempDir();
    const runner = createProcessRunner();
    const projectDir = path.resolve(process.cwd(), "engine", "nautilus");

    const start = await runner({
      command: "start-session",
      payload: {
        pythonPath: "python3",
        projectDir,
        runsDir,
        strategyId: "stock-momentum",
      },
    });

    expect(start.ok).toBe(true);
    expect(start.sessionId).toBe("paper-stock-momentum");
    expect(existsSync(start.artifactPath!)).toBe(true);

    const status = await runner({
      command: "status",
      payload: {
        pythonPath: "python3",
        projectDir,
        runsDir,
      },
    });

    expect(status.ok).toBe(true);
    expect(existsSync(status.artifactPath!)).toBe(true);

    const parsed = JSON.parse(readFileSync(status.artifactPath!, "utf8")) as {
      runtimeHealth: string;
      sessions: Array<{ strategyId: string; state: string }>;
    };

    expect(parsed.runtimeHealth).toBe("ready");
    expect(parsed.sessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ strategyId: "stock-momentum", state: "paper" })]),
    );
  });
});
