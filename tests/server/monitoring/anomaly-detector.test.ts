import { describe, expect, it } from "vitest";
import { detectAnomalies } from "../../../src/server/monitoring/anomaly-detector";
import type { TradeLogEntry } from "../../../src/server/domain/trade-log";

function makeTrade(pnl: number): TradeLogEntry {
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
    slippageBps: 5,
    explanation: "test",
    createdAt: new Date().toISOString(),
  };
}

const BASE = {
  strategyId: "s1",
  trades: [] as TradeLogEntry[],
  dailyDrawdownPct: 0,
  maxDailyLossPct: 8,
  latestSlippageBps: 5,
  modelSlippageBps: 5,
};

describe("detectAnomalies", () => {
  it("returns no anomalies under normal conditions", () => {
    expect(detectAnomalies(BASE)).toHaveLength(0);
  });

  it("flags drawdown_proximity when drawdown exceeds 80% of limit", () => {
    const anomalies = detectAnomalies({ ...BASE, dailyDrawdownPct: 6.5, maxDailyLossPct: 8 });
    expect(anomalies.some((a) => a.kind === "drawdown_proximity")).toBe(true);
  });

  it("flags critical when drawdown exceeds 95% of limit", () => {
    const anomalies = detectAnomalies({ ...BASE, dailyDrawdownPct: 7.7, maxDailyLossPct: 8 });
    const a = anomalies.find((a) => a.kind === "drawdown_proximity");
    expect(a?.severity).toBe("critical");
  });

  it("flags slippage_spike when slippage exceeds 2.5x model", () => {
    const anomalies = detectAnomalies({ ...BASE, latestSlippageBps: 20, modelSlippageBps: 5 });
    expect(anomalies.some((a) => a.kind === "slippage_spike")).toBe(true);
  });

  it("does not flag slippage_spike within normal range", () => {
    const anomalies = detectAnomalies({ ...BASE, latestSlippageBps: 8, modelSlippageBps: 5 });
    expect(anomalies.some((a) => a.kind === "slippage_spike")).toBe(false);
  });

  it("flags consecutive_losses after 3 losses in last 5 trades", () => {
    const trades = [makeTrade(-10), makeTrade(-10), makeTrade(-10), makeTrade(5), makeTrade(5)];
    const anomalies = detectAnomalies({ ...BASE, trades });
    expect(anomalies.some((a) => a.kind === "consecutive_losses")).toBe(true);
  });
});
