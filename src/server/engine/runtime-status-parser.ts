import { readFile } from "node:fs/promises";

export interface RuntimeStatusArtifact {
  runtimeHealth: "ready" | "degraded" | "offline";
  nautilusInstalled: boolean;
  nautilusVersion: string | null;
  venues?: Array<{
    venue: "interactive_brokers" | "kraken";
    connected: boolean;
    scope: "stocks" | "crypto";
    details?: string | null;
  }>;
  sessions: Array<{
    sessionId: string | null;
    strategyId: string | null;
    state: string;
    startedAt?: string | null;
    lastHeartbeatAt?: string | null;
    processId?: number | null;
    alive?: boolean;
    runtimeSource?: "synthetic" | "nautilus_trader" | null;
  }>;
  updatedAt: string;
}

export async function parseRuntimeStatus(artifactPath: string): Promise<RuntimeStatusArtifact> {
  const raw = await readFile(artifactPath, "utf8");
  return JSON.parse(raw) as RuntimeStatusArtifact;
}
