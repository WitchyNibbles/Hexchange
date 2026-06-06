import type { TradeLogEntry } from "../domain/trade-log";

export type AnomalyKind =
  | "drawdown_proximity"
  | "slippage_spike"
  | "pnl_reversal"
  | "consecutive_losses";

export interface Anomaly {
  kind: AnomalyKind;
  message: string;
  severity: "warning" | "critical";
}

export interface AnomalyCheckParams {
  strategyId: string;
  trades: TradeLogEntry[];
  dailyDrawdownPct: number;
  maxDailyLossPct: number;
  latestSlippageBps: number;
  modelSlippageBps: number;
}

const DRAWDOWN_PROXIMITY_THRESHOLD = 0.8;
const SLIPPAGE_SPIKE_MULTIPLIER = 2.5;
const CONSECUTIVE_LOSS_THRESHOLD = 3;

export function detectAnomalies(params: AnomalyCheckParams): Anomaly[] {
  const {
    strategyId,
    trades,
    dailyDrawdownPct,
    maxDailyLossPct,
    latestSlippageBps,
    modelSlippageBps,
  } = params;

  const anomalies: Anomaly[] = [];

  const drawdownRatio = maxDailyLossPct > 0 ? dailyDrawdownPct / maxDailyLossPct : 0;
  if (drawdownRatio >= DRAWDOWN_PROXIMITY_THRESHOLD) {
    anomalies.push({
      kind: "drawdown_proximity",
      message: `Daily drawdown at ${dailyDrawdownPct.toFixed(2)}% — ${Math.round(drawdownRatio * 100)}% of max daily loss limit.`,
      severity: drawdownRatio >= 0.95 ? "critical" : "warning",
    });
  }

  if (modelSlippageBps > 0 && latestSlippageBps > modelSlippageBps * SLIPPAGE_SPIKE_MULTIPLIER) {
    anomalies.push({
      kind: "slippage_spike",
      message: `Slippage ${latestSlippageBps.toFixed(1)} bps — ${(latestSlippageBps / modelSlippageBps).toFixed(1)}× model estimate.`,
      severity: "warning",
    });
  }

  const strategyTrades = trades.filter((t) => t.strategyId === strategyId).slice(0, 5);
  const recentLosses = strategyTrades.filter((t) => t.realizedPnlUsd < 0).length;
  if (recentLosses >= CONSECUTIVE_LOSS_THRESHOLD && strategyTrades.length >= CONSECUTIVE_LOSS_THRESHOLD) {
    anomalies.push({
      kind: "consecutive_losses",
      message: `${recentLosses} of last ${strategyTrades.length} paper fills were losses.`,
      severity: "warning",
    });
  }

  const strategyPnl = trades.filter((t) => t.strategyId === strategyId).reduce((s, t) => s + t.realizedPnlUsd, 0);
  if (strategyPnl < 0) {
    const strategyAll = trades.filter((t) => t.strategyId === strategyId);
    const peak = strategyAll.reduce((max, _, i) => {
      const cumPnl = strategyAll.slice(0, i + 1).reduce((s, t) => s + t.realizedPnlUsd, 0);
      return Math.max(max, cumPnl);
    }, 0);
    if (peak > 0 && Math.abs(strategyPnl - peak) / peak > 0.5) {
      anomalies.push({
        kind: "pnl_reversal",
        message: `Strategy P&L reversed from peak — currently ${strategyPnl.toFixed(2)} USD.`,
        severity: "warning",
      });
    }
  }

  return anomalies;
}
