import { describe, expect, it } from "vitest";
import { LiveTradingController } from "../../../src/server/live/live-trading-controller";
import type { StrategyState } from "../../../src/server/domain/strategy";

describe("live trading controller", () => {
  it("arms validated strategies for live trading", () => {
    const controller = new LiveTradingController();
    const strategy: StrategyState = {
      id: "stock-momentum",
      name: "AAPL Trend Familiar",
      market: "stock",
      symbol: "AAPL",
      stage: "paper",
      signal: null,
      validation: {
        sampleSize: 48,
        feeAdjustedReturnPct: 10,
        maxDrawdownPct: 4,
        profitFactor: 1.5,
        sharpeRatio: 1.2,
        slippageBps: 12,
        paperDriftPct: 2,
      },
      paperSessionActive: true,
    };

    expect(controller.armStrategy(strategy).stage).toBe("live");
  });
});
