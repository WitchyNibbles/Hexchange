import { describe, expect, it } from "vitest";
import path from "node:path";
import { loadRuntimeConfig } from "../../../src/server/config/runtime-config";

describe("runtime config", () => {
  it("loads safe defaults for simulated mode", () => {
    const config = loadRuntimeConfig({
      PORT: "5174",
      HEXCHANGE_APP_DIR: ".hexchange",
    });

    expect(config.engine.mode).toBe("simulated");
    expect(config.engine.pythonPath).toBe(null);
    expect(config.venues.interactiveBrokers.enabled).toBe(false);
    expect(config.venues.kraken.enabled).toBe(false);
  });

  it("requires explicit Nautilus runtime settings in nautilus mode", () => {
    const config = loadRuntimeConfig({
      HEXCHANGE_ENGINE_MODE: "nautilus",
      HEXCHANGE_NAUTILUS_PYTHON: "/usr/bin/python3",
      HEXCHANGE_NAUTILUS_PROJECT_DIR: "/tmp/engine/nautilus",
      HEXCHANGE_NAUTILUS_RUNS_DIR: "/tmp/engine/runs",
      IB_GATEWAY_HOST: "127.0.0.1",
      IB_GATEWAY_PORT: "7497",
      IB_CLIENT_ID: "7",
      KRAKEN_API_KEY: "kraken-key",
      KRAKEN_API_SECRET: "kraken-secret",
    });

    expect(config.engine.mode).toBe("nautilus");
    expect(config.engine.pythonPath).toBe("/usr/bin/python3");
    expect(config.engine.projectDir).toBe("/tmp/engine/nautilus");
    expect(config.engine.runsDir).toBe("/tmp/engine/runs");
    expect(config.venues.interactiveBrokers).toEqual({
      enabled: true,
      host: "127.0.0.1",
      port: 7497,
      clientId: 7,
      accountId: null,
    });
    expect(config.venues.kraken).toEqual({
      enabled: true,
      apiKey: "kraken-key",
      apiSecret: "kraken-secret",
      accountType: "spot",
    });
  });

  it("normalizes relative Nautilus paths against the current working directory", () => {
    const config = loadRuntimeConfig({
      HEXCHANGE_ENGINE_MODE: "nautilus",
      HEXCHANGE_NAUTILUS_PYTHON: ".venv/bin/python",
      HEXCHANGE_NAUTILUS_PROJECT_DIR: "engine/nautilus",
      HEXCHANGE_NAUTILUS_RUNS_DIR: ".hexchange-test-runs",
    });

    expect(config.engine.pythonPath).toBe(path.resolve(process.cwd(), ".venv/bin/python"));
    expect(config.engine.projectDir).toBe(path.resolve(process.cwd(), "engine/nautilus"));
    expect(config.engine.runsDir).toBe(path.resolve(process.cwd(), ".hexchange-test-runs"));
  });
});
