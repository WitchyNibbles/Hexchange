import type { OrderStatus, OrderSide } from "../server/domain/order";
import type { PositionSnapshot } from "../server/domain/position";
import type {
  StrategyLifecycleStage,
  SignalExplanation,
  StrategyValidationMetrics,
} from "../server/domain/strategy";
import type { EventLogRecord, TradeLogEntry } from "../server/domain/trade-log";
import type { BacktestResult, EngineStatus as EngineStatusPayload, PaperSession } from "../server/engine/types";

export type AppMode = "research" | "paper" | "live" | "halted";

export interface HealthPayload {
  ok: true;
  mode: AppMode;
  timestamp: string;
}

export interface SystemStatus {
  mode: AppMode;
  currentActivity: string;
  totalProfitUsd: number;
  totalProfitPct: number;
  dailyDrawdownPct: number;
  grossExposureUsd: number;
  activeWarnings: string[];
  paperStrategies: number;
  liveStrategies: number;
  killSwitchEngaged: boolean;
  dataFreshness: "fresh" | "stale";
}

export interface StrategySummary {
  id: string;
  name: string;
  market: "stock" | "crypto";
  symbol: string;
  stage: StrategyLifecycleStage;
  currentActivity: string;
  signal: SignalExplanation | null;
  validation: StrategyValidationMetrics;
  paperSessionActive: boolean;
  paperSession: PaperSession | null;
  deploymentMode: "simulation_only" | "kraken_live_candidate";
  operatorWarning: string | null;
  liveEligible: boolean;
  validationReport: string[];
  paperValidationStats: {
    cycles: number;
    completedCycles: number;
    cumulativeRealizedPnlUsd: number;
    averageReturnPct: number;
    winRatePct: number;
  };
  lastPaperCycle: {
    status: "completed" | "running";
    realizedPnlUsd: number;
    entryNotionalUsd: number;
    paperReturnPct: number;
    exitCount: number;
    completedAt: string | null;
  } | null;
  lastBacktest: BacktestResult | null;
}

export interface TradeSummary extends TradeLogEntry {}

export interface EventSummary extends EventLogRecord {}

export interface PortfolioSnapshot {
  positions: PositionSnapshot[];
  openOrders: Array<{
    id: string;
    symbol: string;
    side: OrderSide;
    quantity: number;
    status: OrderStatus;
  }>;
}

export interface RiskSettings {
  maxPositionNotionalUsd: number;
  maxDailyLossPct: number;
  liveRolloutCapUsd: number;
}

export interface EngineStatus extends EngineStatusPayload {}

export type ReadinessCheckStatus = "pass" | "warn" | "fail";

export interface LiveReadinessCheck {
  id: string;
  label: string;
  status: ReadinessCheckStatus;
  summary: string;
  details?: string | null;
}

export interface StrategyLiveReadiness {
  strategyId: string;
  name: string;
  market: "stock" | "crypto";
  stage: StrategyLifecycleStage;
  deploymentMode: "simulation_only" | "kraken_live_candidate";
  ready: boolean;
  blocking: boolean;
  blockers: string[];
  lastBacktestSource: BacktestResult["runtimeSource"] | null;
  paperSessionMode: PaperSession["executionMode"] | null;
}

export interface LiveReadinessReport {
  updatedAt: string;
  overallStatus: "ready" | "attention" | "blocked";
  summary: string;
  checks: LiveReadinessCheck[];
  strategies: StrategyLiveReadiness[];
}
