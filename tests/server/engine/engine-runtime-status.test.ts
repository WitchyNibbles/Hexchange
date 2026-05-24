import { describe, expect, it } from "vitest";
import { createEngineAdapter } from "../../../src/server/engine/engine-adapter";

describe("engine runtime status", () => {
  it("reports the current engine mode and latest backtest runs", async () => {
    const adapter = createEngineAdapter();

    await adapter.runBacktest({
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
    });

    const status = await adapter.getEngineStatus();

    expect(status.mode).toBeDefined();
    expect(status.latestBacktests.length).toBeGreaterThan(0);
    expect(status.latestBacktests[0]?.strategyId).toBe("stock-momentum");
  });
});
