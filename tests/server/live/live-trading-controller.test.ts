import { describe, expect, it } from "vitest";
import { LiveTradingController } from "../../../src/server/live/live-trading-controller";
import type { StrategyState } from "../../../src/server/domain/strategy";
import type { BacktestResult } from "../../../src/server/engine/types";
import type { ValidationCampaignSummary } from "../../../src/shared/contracts";

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
  const readyCampaign: ValidationCampaignSummary = {
    status: "ready",
    summary: "Forward validation target reached.",
    nextAction: "Review the Kraken paper evidence and decide whether to arm live trading.",
    observedHoursTarget: 24,
    completedCyclesTarget: 10,
    observedHours: 24.5,
    completedCycles: 12,
    firstObservedCycleAt: "2026-05-25T00:00:00.000Z",
    lastCompletedCycleAt: "2026-05-26T00:30:00.000Z",
    readyCryptoStrategies: 1,
    unresolvedCryptoEvidenceChecks: 0,
    campaignReady: true,
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
      }, readyCampaign).stage,
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
      }, readyCampaign).stage,
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
      }, readyCampaign),
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
