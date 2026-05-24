import { mkdtemp, rm } from "node:fs/promises";
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
});
