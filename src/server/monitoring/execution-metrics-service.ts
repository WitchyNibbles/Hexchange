import type { TradeLogEntry } from "../domain/trade-log";
import type { NormalizedOrder } from "../domain/order";

export interface ExecutionMetrics {
  totalFills: number;
  totalOrders: number;
  fillRatePct: number;
  averageSlippageBps: number;
  rejectedOrders: number;
  rejectionRatePct: number;
  profitableTradesPct: number;
  totalRealizedPnlUsd: number;
  generatedAt: string;
}

export function computeExecutionMetrics(
  trades: TradeLogEntry[],
  orders: NormalizedOrder[],
): ExecutionMetrics {
  const totalFills = trades.length;
  const totalOrders = orders.length;
  const rejectedOrders = orders.filter((o) => o.status === "rejected").length;

  const fillRatePct = totalOrders > 0
    ? Number(((totalFills / totalOrders) * 100).toFixed(1))
    : 0;

  const rejectionRatePct = totalOrders > 0
    ? Number(((rejectedOrders / totalOrders) * 100).toFixed(1))
    : 0;

  const avgSlippageBps = trades.length > 0
    ? Number((trades.reduce((s, t) => s + (t.slippageBps ?? 0), 0) / trades.length).toFixed(1))
    : 0;

  const profitableTrades = trades.filter((t) => t.realizedPnlUsd > 0).length;
  const profitableTradesPct = totalFills > 0
    ? Number(((profitableTrades / totalFills) * 100).toFixed(1))
    : 0;

  const totalRealizedPnlUsd = Number(
    trades.reduce((s, t) => s + t.realizedPnlUsd, 0).toFixed(2),
  );

  return {
    totalFills,
    totalOrders,
    fillRatePct,
    averageSlippageBps: avgSlippageBps,
    rejectedOrders,
    rejectionRatePct,
    profitableTradesPct,
    totalRealizedPnlUsd,
    generatedAt: new Date().toISOString(),
  };
}
