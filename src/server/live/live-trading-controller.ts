import type { StrategyState } from "../domain/strategy";
import type { BacktestResult } from "../engine/types";
import { transitionStrategyState } from "../domain/strategy";
import { evaluateLiveArmamentPolicy, type PaperCycleEvidence } from "./live-armament-policy";

export class LiveTradingController {
  armStrategy(
    strategy: StrategyState,
    lastBacktest: BacktestResult | null,
    lastPaperCycle: PaperCycleEvidence | null = null,
  ): StrategyState {
    const decision = evaluateLiveArmamentPolicy(strategy, lastBacktest, lastPaperCycle);
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    const candidate = strategy.stage === "candidate_live" ? strategy : transitionStrategyState(strategy, "candidate_live");
    return transitionStrategyState(candidate, "live");
  }
}
