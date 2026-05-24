import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";

export interface BacktestRequest {
  strategyId: string;
  symbol: string;
  market: "stock" | "crypto";
}

export interface BacktestResult {
  runId: string;
  feeAdjustedReturnPct: number;
  maxDrawdownPct: number;
  trades: number;
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

export interface EngineAdapter {
  runBacktest(request: BacktestRequest): Promise<BacktestResult>;
  startPaperSession(strategyId: string): Promise<PaperSession>;
  stopSession(sessionId: string): Promise<void>;
  getOrders(strategyId: string): Promise<NormalizedOrder[]>;
  getPositions(strategyId: string): Promise<PositionSnapshot[]>;
  getStrategyStatus(strategyId: string): Promise<StrategyRuntimeStatus>;
}
