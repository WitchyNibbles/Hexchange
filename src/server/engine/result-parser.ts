import { readFile } from "node:fs/promises";
import type { BacktestResult } from "./types";

export async function parseBacktestResult(artifactPath: string): Promise<BacktestResult> {
  const raw = await readFile(artifactPath, "utf8");
  return JSON.parse(raw) as BacktestResult;
}
