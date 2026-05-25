import type { StrategyState } from "../domain/strategy";
import type { BacktestResult } from "../engine/types";
import type { PaperValidationStats } from "../../shared/contracts";
import { transitionStrategyState } from "../domain/strategy";
import { evaluateLiveArmamentPolicy, type PaperCycleEvidence } from "./live-armament-policy";

export class LiveTradingController {
  armStrategy(
    strategy: StrategyState,
    lastBacktest: BacktestResult | null,
    lastPaperCycle: PaperCycleEvidence | null = null,
    paperValidationStats: PaperValidationStats = {
      cycles: 0,
      completedCycles: 0,
      cumulativeRealizedPnlUsd: 0,
      averageReturnPct: 0,
      winRatePct: 0,
    },
  ): StrategyState {
    const decision = evaluateLiveArmamentPolicy(strategy, lastBacktest, lastPaperCycle, paperValidationStats);
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    const candidate = strategy.stage === "candidate_live" ? strategy : transitionStrategyState(strategy, "candidate_live");
    return transitionStrategyState(candidate, "live");
  }
}
