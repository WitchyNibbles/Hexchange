export type StrategyLifecycleStage =
  | "draft"
  | "backtest"
  | "paper"
  | "candidate_live"
  | "live"
  | "halted"
  | "retired";

export interface SignalExplanation {
  summary: string;
  indicators: string[];
  regime: string;
  confidence: number;
  expectedEdgeBps: number;
  invalidation: string;
}

export interface StrategyValidationMetrics {
  sampleSize: number;
  feeAdjustedReturnPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  sharpeRatio: number;
  slippageBps: number;
  paperDriftPct: number;
}

export interface StrategyState {
  id: string;
  name: string;
  market: "stock" | "crypto";
  symbol: string;
  stage: StrategyLifecycleStage;
  signal: SignalExplanation | null;
  validation: StrategyValidationMetrics;
  paperSessionActive: boolean;
}

const allowedTransitions: Record<StrategyLifecycleStage, StrategyLifecycleStage[]> = {
  draft: ["backtest", "retired"],
  backtest: ["paper", "retired", "halted"],
  paper: ["candidate_live", "halted", "retired"],
  candidate_live: ["live", "halted", "retired", "paper"],
  live: ["halted", "retired", "paper"],
  halted: ["paper", "retired"],
  retired: [],
};

export function canTransitionStage(
  current: StrategyLifecycleStage,
  next: StrategyLifecycleStage,
): boolean {
  return allowedTransitions[current].includes(next);
}

export function transitionStrategyState(
  state: StrategyState,
  nextStage: StrategyLifecycleStage,
): StrategyState {
  if (!canTransitionStage(state.stage, nextStage)) {
    throw new Error(`Invalid strategy transition from ${state.stage} to ${nextStage}`);
  }

  return {
    ...state,
    stage: nextStage,
    paperSessionActive: nextStage === "paper" || nextStage === "candidate_live" || nextStage === "live",
  };
}
