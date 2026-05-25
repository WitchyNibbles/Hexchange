import { describe, expect, it } from "vitest";
import { LiveTradingController } from "../../../src/server/live/live-trading-controller";
import type { StrategyState } from "../../../src/server/domain/strategy";
import type { BacktestResult } from "../../../src/server/engine/types";

describe("live trading controller", () => {
  const realBacktest: BacktestResult = {
    strategyId: "crypto-breakout",
    runId: "backtest-crypto-breakout-real",
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
      id: "crypto-breakout",
      name: "BTC Lunar Breakout",
      market: "crypto",
      symbol: "BTCUSD",
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

    expect(
      controller.armStrategy(strategy, realBacktest, null, {
        cycles: 2,
        completedCycles: 2,
        cumulativeRealizedPnlUsd: 17.32,
        averageReturnPct: 0.64,
        winRatePct: 100,
      }).stage,
    ).toBe("live");
  });

  it("allows live armament after repeated completed paper cycles detach", () => {
    const controller = new LiveTradingController();
    const strategy: StrategyState = {
      id: "crypto-breakout",
      name: "BTC Lunar Breakout",
      market: "crypto",
      symbol: "BTCUSD",
      stage: "paper",
      signal: null,
      validation: {
        sampleSize: 49,
        feeAdjustedReturnPct: 10,
        maxDrawdownPct: 4,
        profitFactor: 1.5,
        sharpeRatio: 1.2,
        slippageBps: 12,
        paperDriftPct: 4,
      },
      paperSessionActive: false,
    };

    expect(
      controller.armStrategy(strategy, realBacktest, {
        status: "completed",
        realizedPnlUsd: 8.66,
        entryNotionalUsd: 1358.45,
        paperReturnPct: 0.64,
        exitCount: 2,
        completedAt: "2026-05-25T18:20:26.109554+00:00",
      }, {
        cycles: 2,
        completedCycles: 2,
        cumulativeRealizedPnlUsd: 17.32,
        averageReturnPct: 0.64,
        winRatePct: 100,
      }).stage,
    ).toBe("live");
  });

  it("rejects live armament when cumulative paper evidence is still too thin", () => {
    const controller = new LiveTradingController();
    const strategy: StrategyState = {
      id: "crypto-breakout",
      name: "BTC Lunar Breakout",
      market: "crypto",
      symbol: "BTCUSD",
      stage: "paper",
      signal: null,
      validation: {
        sampleSize: 49,
        feeAdjustedReturnPct: 10,
        maxDrawdownPct: 4,
        profitFactor: 1.5,
        sharpeRatio: 1.2,
        slippageBps: 12,
        paperDriftPct: 4,
      },
      paperSessionActive: false,
    };

    expect(() =>
      controller.armStrategy(strategy, realBacktest, {
        status: "completed",
        realizedPnlUsd: 8.66,
        entryNotionalUsd: 1358.45,
        paperReturnPct: 0.64,
        exitCount: 2,
        completedAt: "2026-05-25T18:20:26.109554+00:00",
      }, {
        cycles: 1,
        completedCycles: 1,
        cumulativeRealizedPnlUsd: 8.66,
        averageReturnPct: 0.64,
        winRatePct: 100,
      }),
    ).toThrow(/at least 2 Kraken paper cycles/i);
  });

  it("rejects live armament without a real nautilus backtest", () => {
    const controller = new LiveTradingController();
    const strategy: StrategyState = {
      id: "crypto-breakout",
      name: "BTC Lunar Breakout",
      market: "crypto",
      symbol: "BTCUSD",
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

  it("rejects stock strategies because they are simulation-only", () => {
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

    expect(() => controller.armStrategy(strategy, realBacktest)).toThrow(/simulation-only/i);
  });
});
