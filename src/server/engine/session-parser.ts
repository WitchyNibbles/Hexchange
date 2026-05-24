import { readFile } from "node:fs/promises";
import type { PaperSession } from "./types";

export async function parsePaperSession(artifactPath: string): Promise<PaperSession> {
  const raw = await readFile(artifactPath, "utf8");
  const parsed = JSON.parse(raw) as PaperSession;
  return {
    sessionId: parsed.sessionId,
    strategyId: parsed.strategyId,
    startedAt: parsed.startedAt,
    lastHeartbeatAt: parsed.lastHeartbeatAt ?? null,
    processId: parsed.processId ?? null,
    runtimeSource: parsed.runtimeSource ?? null,
    executionMode: parsed.executionMode ?? null,
  };
}
