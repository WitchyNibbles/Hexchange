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
  autoPaperValidationEnabled: boolean;
  deploymentMode: "simulation_only" | "kraken_live_candidate";
  operatorWarning: string | null;
  liveEligible: boolean;
  validationReport: string[];
  paperValidationStats: PaperValidationStats;
  liveEvidenceProgress: LiveEvidenceProgress;
  lastPaperCycle: {
    status: "completed" | "running";
    realizedPnlUsd: number;
    entryNotionalUsd: number;
    paperReturnPct: number;
    exitCount: number;
    completedAt: string | null;
  } | null;
  paperCycleHistory: PaperCycleSummary[];
  lastBacktest: BacktestResult | null;
}

export interface PaperValidationStats {
  cycles: number;
  completedCycles: number;
  cumulativeRealizedPnlUsd: number;
  averageReturnPct: number;
  winRatePct: number;
}

export interface PaperCycleSummary {
  sessionId: string;
  status: "completed" | "running";
  venue: TradeLogEntry["venue"];
  executionMode: TradeLogEntry["executionMode"];
  runtimeSource: TradeLogEntry["runtimeSource"];
  realizedPnlUsd: number;
  entryNotionalUsd: number;
  paperReturnPct: number;
  exitCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface LiveEvidenceProgress {
  ready: boolean;
  items: LiveEvidenceProgressItem[];
}

export interface LiveEvidenceProgressItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "blocked";
  summary: string;
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

export interface ValidationCampaignSummary {
  observedHoursTarget: number;
  completedCyclesTarget: number;
  observedHours: number;
  completedCycles: number;
  firstObservedCycleAt: string | null;
  lastCompletedCycleAt: string | null;
  readyCryptoStrategies: number;
  unresolvedCryptoEvidenceChecks: number;
  campaignReady: boolean;
}
