import type { StrategyState } from "../domain/strategy";
import { transitionStrategyState } from "../domain/strategy";
import { evaluateLiveArmamentPolicy } from "./live-armament-policy";

export class LiveTradingController {
  armStrategy(strategy: StrategyState): StrategyState {
    const decision = evaluateLiveArmamentPolicy(strategy);
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    const candidate = strategy.stage === "candidate_live" ? strategy : transitionStrategyState(strategy, "candidate_live");
    return transitionStrategyState(candidate, "live");
  }
}
