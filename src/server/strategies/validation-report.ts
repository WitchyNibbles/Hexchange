import type { StrategyState } from "../domain/strategy";
import { evaluatePromotionGates } from "./promotion-gates";

export interface ValidationReport {
  strategyId: string;
  passed: boolean;
  reasons: string[];
}

export function buildValidationReport(strategy: StrategyState): ValidationReport {
  const result = evaluatePromotionGates(strategy.validation);
  return {
    strategyId: strategy.id,
    passed: result.passed,
    reasons: result.reasons.length > 0 ? result.reasons : ["strategy passed all promotion gates"],
  };
}
