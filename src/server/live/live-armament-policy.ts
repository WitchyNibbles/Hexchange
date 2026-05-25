import type { StrategyState } from "../domain/strategy";
import type { BacktestResult } from "../engine/types";
import type { LiveEvidenceProgress, PaperValidationStats } from "../../shared/contracts";
import { evaluatePromotionGates } from "../strategies/promotion-gates";

export interface PaperCycleEvidence {
  status: "completed" | "running";
  realizedPnlUsd: number;
  entryNotionalUsd: number;
  paperReturnPct: number;
  exitCount: number;
  completedAt: string | null;
}

export interface LiveArmamentDecision {
  allowed: boolean;
  reason: string;
  notionalCapUsd: number;
}

export const MIN_COMPLETED_PAPER_CYCLES = 2;
export const MIN_PAPER_WIN_RATE_PCT = 55;

export function buildLiveEvidenceProgress(
  strategy: StrategyState,
  lastBacktest: BacktestResult | null,
  paperValidationStats: PaperValidationStats,
): LiveEvidenceProgress {
  if (strategy.market === "stock") {
    return {
      ready: false,
      items: [
        {
          id: "simulation-only",
          label: "Stock execution",
          status: "blocked",
          summary: "Simulation only until a real stock broker is added.",
        },
      ],
    };
  }

  const items: LiveEvidenceProgress["items"] = [];
  const backtestReady = lastBacktest?.runtimeSource === "nautilus_trader";
  items.push({
    id: "real-backtest",
    label: "Real Nautilus backtest",
    status: backtestReady ? "pass" : "blocked",
    summary: backtestReady ? "Completed." : "Still required before live armament.",
  });

  const completedCyclesReady =
    paperValidationStats.completedCycles >= MIN_COMPLETED_PAPER_CYCLES;
  items.push({
    id: "completed-cycles",
    label: "Completed Kraken paper cycles",
    status: completedCyclesReady ? "pass" : paperValidationStats.completedCycles > 0 ? "warn" : "blocked",
    summary: `${paperValidationStats.completedCycles}/${MIN_COMPLETED_PAPER_CYCLES} completed.`,
  });

  const netPnlReady = paperValidationStats.cumulativeRealizedPnlUsd > 0;
  items.push({
    id: "net-pnl",
    label: "Cumulative paper PnL",
    status: netPnlReady ? "pass" : paperValidationStats.completedCycles > 0 ? "warn" : "blocked",
    summary: `$${paperValidationStats.cumulativeRealizedPnlUsd.toFixed(2)} net realized PnL.`,
  });

  const avgReturnReady = paperValidationStats.averageReturnPct > 0;
  items.push({
    id: "average-return",
    label: "Average paper return",
    status: avgReturnReady ? "pass" : paperValidationStats.completedCycles > 0 ? "warn" : "blocked",
    summary: `${paperValidationStats.averageReturnPct.toFixed(2)}% average return.`,
  });

  const winRateReady =
    paperValidationStats.completedCycles > 0 &&
    paperValidationStats.winRatePct >= MIN_PAPER_WIN_RATE_PCT;
  items.push({
    id: "win-rate",
    label: "Paper win rate",
    status: winRateReady ? "pass" : paperValidationStats.completedCycles > 0 ? "warn" : "blocked",
    summary: `${paperValidationStats.winRatePct.toFixed(2)}% vs ${MIN_PAPER_WIN_RATE_PCT}% minimum.`,
  });

  return {
    ready: items.every((item) => item.status === "pass"),
    items,
  };
}

export function evaluatePaperEvidencePolicy(paperValidationStats: PaperValidationStats): string[] {
  const reasons: string[] = [];

  if (paperValidationStats.completedCycles < MIN_COMPLETED_PAPER_CYCLES) {
    reasons.push(`Complete at least ${MIN_COMPLETED_PAPER_CYCLES} Kraken paper cycles before live armament.`);
  }

  if (paperValidationStats.cumulativeRealizedPnlUsd <= 0) {
    reasons.push("Paper validation must stay net profitable before live armament.");
  }

  if (paperValidationStats.averageReturnPct <= 0) {
    reasons.push("Average paper return must stay positive before live armament.");
  }

  if (paperValidationStats.completedCycles > 0 && paperValidationStats.winRatePct < MIN_PAPER_WIN_RATE_PCT) {
    reasons.push(`Paper win rate must stay above ${MIN_PAPER_WIN_RATE_PCT}% before live armament.`);
  }

  return reasons;
}

export function evaluateLiveArmamentPolicy(
  strategy: StrategyState,
  lastBacktest: BacktestResult | null,
  lastPaperCycle: PaperCycleEvidence | null,
  paperValidationStats: PaperValidationStats,
): LiveArmamentDecision {
  if (strategy.market === "stock") {
    return {
      allowed: false,
      reason: "Stock execution is simulation-only until a real stock broker is added.",
      notionalCapUsd: 0,
    };
  }

  const promotion = evaluatePromotionGates(strategy.validation);
  if (!promotion.passed) {
    return {
      allowed: false,
      reason: promotion.reasons.join(", "),
      notionalCapUsd: 0,
    };
  }

  if (!lastBacktest || lastBacktest.runtimeSource !== "nautilus_trader") {
    return {
      allowed: false,
      reason: "A real Nautilus backtest is required before live armament.",
      notionalCapUsd: 0,
    };
  }

  if (!strategy.paperSessionActive && lastPaperCycle?.status !== "completed") {
    return {
      allowed: false,
      reason: "An active paper session or a completed paper cycle is required before live armament.",
      notionalCapUsd: 0,
    };
  }

  const paperEvidenceReasons = evaluatePaperEvidencePolicy(paperValidationStats);
  if (paperEvidenceReasons.length > 0) {
    return {
      allowed: false,
      reason: paperEvidenceReasons.join(", "),
      notionalCapUsd: 0,
    };
  }

  return {
    allowed: true,
    reason: "strategy passed promotion gates and can be armed with a tiny rollout size",
    notionalCapUsd: 500,
  };
}
