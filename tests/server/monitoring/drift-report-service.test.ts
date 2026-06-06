import { describe, expect, it } from "vitest";
import { computeDriftReport, computePaperDriftPct } from "../../../src/server/monitoring/drift-report-service";
import type { TradeLogEntry } from "../../../src/server/domain/trade-log";
import type { BacktestResult } from "../../../src/server/engine/types";

function makeTrade(strategyId: string, pnl: number): TradeLogEntry {
  return {
    id: "t1",
    strategyId,
    symbol: "AAPL",
    market: "stock",
    side: "buy",
    quantity: 5,
    price: 200,
    feeUsd: 1,
    realizedPnlUsd: pnl,
    expectedEdgeBps: 80,
    slippageBps: 5,
    explanation: "test",
    createdAt: new Date().toISOString(),
  };
}

function makeBacktest(returnPct: number): BacktestResult {
  return {
    strategyId: "s1",
    runId: "r1",
    feeAdjustedReturnPct: returnPct,
    maxDrawdownPct: 2,
    trades: 5,
    executedAt: new Date().toISOString(),
  };
}

describe("computeDriftReport", () => {
  it("returns zero drift when no trades", () => {
    const report = computeDriftReport("s1", [], makeBacktest(10), 10_000);
    expect(report.paperReturnPct).toBe(0);
    expect(report.driftPct).toBe(-10);
    expect(report.tradeCount).toBe(0);
  });

  it("computes positive drift when paper outperforms backtest", () => {
    const trades = [makeTrade("s1", 1500)];
    const report = computeDriftReport("s1", trades, makeBacktest(10), 10_000);
    expect(report.paperReturnPct).toBe(15);
    expect(report.driftPct).toBe(5);
  });

  it("computes negative drift when paper underperforms backtest", () => {
    const trades = [makeTrade("s1", 500)];
    const report = computeDriftReport("s1", trades, makeBacktest(10), 10_000);
    expect(report.driftPct).toBe(-5);
  });

  it("only counts trades for the given strategy", () => {
    const trades = [makeTrade("s1", 1000), makeTrade("other", 9000)];
    const report = computeDriftReport("s1", trades, makeBacktest(0), 10_000);
    expect(report.tradeCount).toBe(1);
  });
});

describe("computePaperDriftPct", () => {
  it("returns 0 when no backtest available", () => {
    expect(computePaperDriftPct("s1", [], null, 10_000)).toBe(0);
  });

  it("returns absolute drift magnitude", () => {
    const trades = [makeTrade("s1", -500)];
    const drift = computePaperDriftPct("s1", trades, makeBacktest(10), 10_000);
    expect(drift).toBeGreaterThan(0);
  });
});
