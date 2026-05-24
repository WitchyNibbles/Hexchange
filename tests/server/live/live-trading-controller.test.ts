import { describe, expect, it } from "vitest";
import { LiveTradingController } from "../../../src/server/live/live-trading-controller";
import type { StrategyState } from "../../../src/server/domain/strategy";
import type { BacktestResult } from "../../../src/server/engine/types";

describe("live trading controller", () => {
  const realBacktest: BacktestResult = {
    strategyId: "stock-momentum",
    runId: "backtest-stock-momentum-real",
    feeAdjustedReturnPct: 10,
    maxDrawdownPct: 4,
    trades: 12,
    executedAt: "2026-05-24T12:00:00.000Z",
    runtimeSource: "nautilus_trader",
    dataSource: "Locally generated sample bars via NautilusTrader.",
  };

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

    expect(controller.armStrategy(strategy, realBacktest).stage).toBe("live");
  });

  it("rejects live armament without a real nautilus backtest", () => {
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

    expect(() => controller.armStrategy(strategy, null)).toThrow(/real nautilus backtest/i);
  });
});
