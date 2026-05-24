import { describe, expect, it } from "vitest";
import { canTransitionStage, transitionStrategyState, type StrategyState } from "../../../src/server/domain/strategy";

describe("trading domain", () => {
  const strategy: StrategyState = {
    id: "stock-momentum",
    name: "AAPL Trend Familiar",
    market: "stock",
    symbol: "AAPL",
    stage: "backtest",
    signal: null,
    validation: {
      sampleSize: 40,
      feeAdjustedReturnPct: 10,
      maxDrawdownPct: 4,
      profitFactor: 1.4,
      sharpeRatio: 1.1,
      slippageBps: 12,
      paperDriftPct: 3,
    },
    paperSessionActive: false,
  };

  it("allows valid stage transitions", () => {
    expect(canTransitionStage("backtest", "paper")).toBe(true);
    expect(transitionStrategyState(strategy, "paper").stage).toBe("paper");
  });

  it("rejects invalid stage transitions", () => {
    expect(() => transitionStrategyState(strategy, "live")).toThrow(/Invalid strategy transition/);
  });
});
