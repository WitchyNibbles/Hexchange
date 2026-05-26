import type { StrategyState } from "../domain/strategy";
import type { PaperValidationStats, ValidationCampaignSummary } from "../../shared/contracts";
import { evaluatePaperEvidencePolicyWithCampaign } from "../live/live-armament-policy";
import { evaluatePromotionGates } from "./promotion-gates";

export interface ValidationReport {
  strategyId: string;
  passed: boolean;
  reasons: string[];
}

export function buildValidationReport(
  strategy: StrategyState,
  paperValidationStats?: PaperValidationStats,
  validationCampaign?: ValidationCampaignSummary | null,
): ValidationReport {
  const result = evaluatePromotionGates(strategy.validation);
  const paperReasons =
    strategy.market === "crypto" && paperValidationStats
      ? evaluatePaperEvidencePolicyWithCampaign(paperValidationStats, validationCampaign ?? null)
      : [];
  const reasons = [...result.reasons, ...paperReasons];

  return {
    strategyId: strategy.id,
    passed: result.passed && paperReasons.length === 0,
    reasons: reasons.length > 0 ? reasons : ["strategy passed all promotion gates"],
  };
}
