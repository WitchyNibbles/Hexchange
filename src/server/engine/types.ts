import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type { TradeLogEntry } from "../domain/trade-log";

export interface BacktestRequest {
  strategyId: string;
  symbol: string;
  market: "stock" | "crypto";
}

export interface BacktestResult {
  strategyId: string;
  runId: string;
  feeAdjustedReturnPct: number;
  maxDrawdownPct: number;
  trades: number;
  executedAt: string;
  runtimeSource: "synthetic" | "nautilus_trader";
  dataSource?: string | null;
}

export interface PaperSession {
  sessionId: string;
  strategyId: string;
  startedAt: string;
  lastHeartbeatAt?: string | null;
  processId?: number | null;
  runtimeSource?: "synthetic" | "nautilus_trader" | null;
  executionMode?: "simulated" | "kraken_ready" | "ib_ready" | "dual_venue_ready" | null;
  phase?: "waiting_entry" | "open" | "scaled" | "closed" | "stopped" | null;
  currentPrice?: number | null;
  referencePrice?: number | null;
  entryTriggerPrice?: number | null;
  entryDistanceUsd?: number | null;
}

export interface PaperSessionTelemetry {
  sessionId: string;
  strategyId: string;
  updatedAt: string;
  orders: NormalizedOrder[];
  positions: PositionSnapshot[];
  trades: TradeLogEntry[];
}

export interface StrategyRuntimeStatus {
  strategyId: string;
  state: "idle" | "paper" | "live";
  lastHeartbeatAt: string;
}

export interface VenueConnectivity {
  venue: "interactive_brokers" | "kraken";
  connected: boolean;
  scope: "stocks" | "crypto";
  details?: string | null;
}

export interface EngineStatus {
  mode: "simulated" | "nautilus";
  available: boolean;
  runtimeHealth: "ready" | "degraded" | "offline";
  runtimeDetails?: string | null;
  venues: VenueConnectivity[];
  latestBacktests: BacktestResult[];
}

export interface EngineAdapter {
  runBacktest(request: BacktestRequest): Promise<BacktestResult>;
  startPaperSession(strategyId: string): Promise<PaperSession>;
  stopSession(sessionId: string): Promise<void>;
  getPaperSession(strategyId: string): Promise<PaperSession | null>;
  getOrders(strategyId: string): Promise<NormalizedOrder[]>;
  getPositions(strategyId: string): Promise<PositionSnapshot[]>;
  getTrades(strategyId: string): Promise<TradeLogEntry[]>;
  getStrategyStatus(strategyId: string): Promise<StrategyRuntimeStatus>;
  getEngineStatus(): Promise<EngineStatus>;
}
