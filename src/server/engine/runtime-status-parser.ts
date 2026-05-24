import { readFile } from "node:fs/promises";

export interface RuntimeStatusArtifact {
  runtimeHealth: "ready" | "degraded" | "offline";
  nautilusInstalled: boolean;
  nautilusVersion: string | null;
  sessions: Array<{
    sessionId: string | null;
    strategyId: string | null;
    state: string;
  }>;
  updatedAt: string;
}

export async function parseRuntimeStatus(artifactPath: string): Promise<RuntimeStatusArtifact> {
  const raw = await readFile(artifactPath, "utf8");
  return JSON.parse(raw) as RuntimeStatusArtifact;
}
