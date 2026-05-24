import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";

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
}

export interface PaperSession {
  sessionId: string;
  strategyId: string;
  startedAt: string;
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
}

export interface EngineStatus {
  mode: "simulated" | "nautilus";
  available: boolean;
  runtimeHealth: "ready" | "degraded" | "offline";
  venues: VenueConnectivity[];
  latestBacktests: BacktestResult[];
}

export interface EngineAdapter {
  runBacktest(request: BacktestRequest): Promise<BacktestResult>;
  startPaperSession(strategyId: string): Promise<PaperSession>;
  stopSession(sessionId: string): Promise<void>;
  getOrders(strategyId: string): Promise<NormalizedOrder[]>;
  getPositions(strategyId: string): Promise<PositionSnapshot[]>;
  getStrategyStatus(strategyId: string): Promise<StrategyRuntimeStatus>;
  getEngineStatus(): Promise<EngineStatus>;
}
