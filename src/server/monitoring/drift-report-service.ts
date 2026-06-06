import type { TradeLogEntry } from "../domain/trade-log";
import type { BacktestResult } from "../engine/types";

export interface StrategyDriftReport {
  strategyId: string;
  backtestReturnPct: number;
  paperReturnPct: number;
  driftPct: number;
  tradeCount: number;
  generatedAt: string;
}

export function computeDriftReport(
  strategyId: string,
  trades: TradeLogEntry[],
  lastBacktest: BacktestResult | null,
  startingCapitalUsd: number,
): StrategyDriftReport {
  const strategyTrades = trades.filter((t) => t.strategyId === strategyId);
  const paperPnlUsd = strategyTrades.reduce((sum, t) => sum + t.realizedPnlUsd, 0);
  const paperReturnPct = startingCapitalUsd > 0
    ? Number(((paperPnlUsd / startingCapitalUsd) * 100).toFixed(2))
    : 0;

  const backtestReturnPct = lastBacktest?.feeAdjustedReturnPct ?? 0;

  const driftPct = Number((paperReturnPct - backtestReturnPct).toFixed(2));

  return {
    strategyId,
    backtestReturnPct,
    paperReturnPct,
    driftPct,
    tradeCount: strategyTrades.length,
    generatedAt: new Date().toISOString(),
  };
}

export function computePaperDriftPct(
  strategyId: string,
  trades: TradeLogEntry[],
  lastBacktest: BacktestResult | null,
  startingCapitalUsd: number,
): number {
  if (!lastBacktest || lastBacktest.feeAdjustedReturnPct === 0) return 0;
  const report = computeDriftReport(strategyId, trades, lastBacktest, startingCapitalUsd);
  return Math.abs(report.driftPct);
}
