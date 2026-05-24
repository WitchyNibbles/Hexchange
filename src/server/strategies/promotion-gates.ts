import type { StrategyValidationMetrics } from "../domain/strategy";

export interface PromotionGateResult {
  passed: boolean;
  reasons: string[];
}

export function evaluatePromotionGates(metrics: StrategyValidationMetrics): PromotionGateResult {
  const reasons: string[] = [];

  if (metrics.sampleSize < 25) {
    reasons.push("sample size is too small");
  }

  if (metrics.feeAdjustedReturnPct <= 0) {
    reasons.push("fee-adjusted return is non-positive");
  }

  if (metrics.maxDrawdownPct > 12) {
    reasons.push("drawdown exceeds the allowed paper-to-live threshold");
  }

  if (metrics.slippageBps > 30) {
    reasons.push("slippage is too high for promotion");
  }

  if (Math.abs(metrics.paperDriftPct) > 8) {
    reasons.push("paper drift is too large");
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}
