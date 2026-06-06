import type { OrderStatus, OrderSide } from "../server/domain/order";
import type { WalkForwardResult } from "../server/engine/types";
import type { PositionSnapshot } from "../server/domain/position";
import type {
  StrategyLifecycleStage,
  SignalExplanation,
  StrategyValidationMetrics,
} from "../server/domain/strategy";
import type { EventLogRecord, TradeLogEntry } from "../server/domain/trade-log";
import type { BacktestResult, EngineStatus as EngineStatusPayload } from "../server/engine/types";

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
  liveEligible: boolean;
  validationReport: string[];
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
  startingCapitalUsd: number;
}

export interface EngineStatus extends EngineStatusPayload {}
export type { WalkForwardResult } from "../server/engine/types";
