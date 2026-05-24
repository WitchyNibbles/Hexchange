import type { EngineAdapter } from "./types";
import { loadRuntimeConfig } from "../config/runtime-config";
import { NautilusAdapter } from "./nautilus-adapter";

export function createEngineAdapter(): EngineAdapter {
  const config = loadRuntimeConfig();
  return new NautilusAdapter({
    mode: config.engine.mode,
    pythonPath: config.engine.pythonPath,
    projectDir: config.engine.projectDir,
    runsDir: config.engine.runsDir,
  });
}
