import { describe, expect, it } from "vitest";
import { computeExecutionMetrics } from "../../../src/server/monitoring/execution-metrics-service";
import type { TradeLogEntry } from "../../../src/server/domain/trade-log";
import type { NormalizedOrder } from "../../../src/server/domain/order";

function makeTrade(pnl: number, slippageBps = 5): TradeLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    strategyId: "s1",
    symbol: "AAPL",
    market: "stock",
    side: "buy",
    quantity: 5,
    price: 200,
    feeUsd: 1,
    realizedPnlUsd: pnl,
    expectedEdgeBps: 80,
    slippageBps,
    explanation: "test",
    createdAt: new Date().toISOString(),
  };
}

function makeOrder(status: NormalizedOrder["status"]): NormalizedOrder {
  return {
    id: Math.random().toString(36).slice(2),
    strategyId: "s1",
    symbol: "AAPL",
    market: "stock",
    side: "buy",
    quantity: 5,
    submittedAt: new Date().toISOString(),
    rationale: "test",
    status,
    averageFillPrice: 200,
  };
}

describe("computeExecutionMetrics", () => {
  it("returns zeros for empty input", () => {
    const m = computeExecutionMetrics([], []);
    expect(m.totalFills).toBe(0);
    expect(m.totalOrders).toBe(0);
    expect(m.fillRatePct).toBe(0);
  });

  it("computes fill rate correctly", () => {
    const orders = [makeOrder("filled"), makeOrder("filled"), makeOrder("rejected")];
    const trades = [makeTrade(10), makeTrade(-5)];
    const m = computeExecutionMetrics(trades, orders);
    expect(m.totalOrders).toBe(3);
    expect(m.totalFills).toBe(2);
    expect(m.rejectedOrders).toBe(1);
    expect(m.rejectionRatePct).toBe(33.3);
  });

  it("averages slippage across fills", () => {
    const trades = [makeTrade(0, 4), makeTrade(0, 8)];
    const m = computeExecutionMetrics(trades, []);
    expect(m.averageSlippageBps).toBe(6);
  });

  it("computes profitable trade pct", () => {
    const trades = [makeTrade(10), makeTrade(5), makeTrade(-3), makeTrade(0)];
    const m = computeExecutionMetrics(trades, []);
    expect(m.profitableTradesPct).toBe(50);
  });

  it("sums total realized P&L", () => {
    const trades = [makeTrade(10), makeTrade(-3)];
    const m = computeExecutionMetrics(trades, []);
    expect(m.totalRealizedPnlUsd).toBe(7);
  });
});
