import { describe, expect, it } from "vitest";
import { createEngineAdapter } from "../../../src/server/engine/engine-adapter";

describe("engine adapter", () => {
  it("runs backtests and starts paper sessions through the LEAN boundary", async () => {
    const adapter = createEngineAdapter();

    const backtest = await adapter.runBacktest({
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
    });

    expect(backtest.feeAdjustedReturnPct).toBeGreaterThan(0);

    const session = await adapter.startPaperSession("stock-momentum");
    const status = await adapter.getStrategyStatus("stock-momentum");

    expect(session.sessionId).toContain("paper-stock-momentum");
    expect(status.state).toBe("paper");
  });
});
