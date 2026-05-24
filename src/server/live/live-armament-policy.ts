import type { StrategyState } from "../domain/strategy";
import { evaluatePromotionGates } from "../strategies/promotion-gates";

export interface LiveArmamentDecision {
  allowed: boolean;
  reason: string;
  notionalCapUsd: number;
}

export function evaluateLiveArmamentPolicy(strategy: StrategyState): LiveArmamentDecision {
  const promotion = evaluatePromotionGates(strategy.validation);
  if (!promotion.passed) {
    return {
      allowed: false,
      reason: promotion.reasons.join(", "),
      notionalCapUsd: 0,
    };
  }

  return {
    allowed: true,
    reason: "strategy passed promotion gates and can be armed with a tiny rollout size",
    notionalCapUsd: 500,
  };
}
