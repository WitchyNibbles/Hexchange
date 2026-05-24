import type { EngineAdapter } from "./types";
import { LeanAdapter } from "./lean-adapter";

export function createEngineAdapter(): EngineAdapter {
  return new LeanAdapter();
}
