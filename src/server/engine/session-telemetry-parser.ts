import { readFile } from "node:fs/promises";
import type { PaperSessionTelemetry } from "./types";

export async function parseSessionTelemetry(artifactPath: string): Promise<PaperSessionTelemetry> {
  const raw = await readFile(artifactPath, "utf8");
  return JSON.parse(raw) as PaperSessionTelemetry;
}
