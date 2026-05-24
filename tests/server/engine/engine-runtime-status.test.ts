import { describe, expect, it } from "vitest";
import { createEngineAdapter } from "../../../src/server/engine/engine-adapter";

describe("engine runtime status", () => {
  it("reports the current engine mode and latest backtest runs", async () => {
    const previousMode = process.env.HEXCHANGE_ENGINE_MODE;
    const previousPython = process.env.HEXCHANGE_NAUTILUS_PYTHON;
    const previousProjectDir = process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR;
    const previousRunsDir = process.env.HEXCHANGE_NAUTILUS_RUNS_DIR;

    process.env.HEXCHANGE_ENGINE_MODE = "nautilus";
    process.env.HEXCHANGE_NAUTILUS_PYTHON = "/usr/bin/python3";
    process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = "/tmp/engine/nautilus";
    process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = "/tmp/engine/runs";
    const adapter = createEngineAdapter();

    try {
      await adapter.runBacktest({
        strategyId: "stock-momentum",
        symbol: "AAPL",
        market: "stock",
      });

      const status = await adapter.getEngineStatus();

      expect(status.mode).toBe("nautilus");
      expect(status.runtimeHealth).toBe("ready");
      expect(status.venues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ venue: "interactive_brokers", connected: false }),
          expect.objectContaining({ venue: "kraken", connected: false }),
        ]),
      );
      expect(status.latestBacktests.length).toBeGreaterThan(0);
      expect(status.latestBacktests[0]?.strategyId).toBe("stock-momentum");
    } finally {
      process.env.HEXCHANGE_ENGINE_MODE = previousMode;
      process.env.HEXCHANGE_NAUTILUS_PYTHON = previousPython;
      process.env.HEXCHANGE_NAUTILUS_PROJECT_DIR = previousProjectDir;
      process.env.HEXCHANGE_NAUTILUS_RUNS_DIR = previousRunsDir;
    }
  });
});
