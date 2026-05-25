import type { StrategyState } from "../domain/strategy";
import type { PaperValidationStats } from "../../shared/contracts";
import { evaluatePaperEvidencePolicy } from "../live/live-armament-policy";
import { evaluatePromotionGates } from "./promotion-gates";

export interface ValidationReport {
  strategyId: string;
  passed: boolean;
  reasons: string[];
}

export function buildValidationReport(
  strategy: StrategyState,
  paperValidationStats?: PaperValidationStats,
): ValidationReport {
  const result = evaluatePromotionGates(strategy.validation);
  const paperReasons =
    strategy.market === "crypto" && paperValidationStats
      ? evaluatePaperEvidencePolicy(paperValidationStats)
      : [];
  const reasons = [...result.reasons, ...paperReasons];

  return {
    strategyId: strategy.id,
    passed: result.passed && paperReasons.length === 0,
    reasons: reasons.length > 0 ? reasons : ["strategy passed all promotion gates"],
  };
}
