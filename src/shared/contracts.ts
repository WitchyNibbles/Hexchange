import type { OrderStatus, OrderSide } from "../server/domain/order";
import type { PositionSnapshot } from "../server/domain/position";
import type {
  StrategyLifecycleStage,
  SignalExplanation,
  StrategyValidationMetrics,
} from "../server/domain/strategy";
import type { EventLogRecord, TradeLogEntry } from "../server/domain/trade-log";

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
