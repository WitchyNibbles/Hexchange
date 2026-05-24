import type { StrategyState } from "../domain/strategy";
import type { BacktestResult } from "../engine/types";
import { evaluatePromotionGates } from "../strategies/promotion-gates";

export interface LiveArmamentDecision {
  allowed: boolean;
  reason: string;
  notionalCapUsd: number;
}

export function evaluateLiveArmamentPolicy(
  strategy: StrategyState,
  lastBacktest: BacktestResult | null,
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

  if (!strategy.paperSessionActive) {
    return {
      allowed: false,
      reason: "An active paper session is required before live armament.",
      notionalCapUsd: 0,
    };
  }

  return {
    allowed: true,
    reason: "strategy passed promotion gates and can be armed with a tiny rollout size",
    notionalCapUsd: 500,
  };
}
