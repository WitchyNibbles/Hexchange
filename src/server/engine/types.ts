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

export interface EngineStatus {
  mode: "simulated" | "lean_cli";
  available: boolean;
  latestBacktests: BacktestResult[];
}

export interface WalkForwardWindow {
  windowIndex: number;
  inSampleStart: string;
  inSampleEnd: string;
  outOfSampleStart: string | null;
  outOfSampleEnd: string | null;
  inSampleReturnPct: number;
  outOfSampleReturnPct: number | null;
  maxDrawdownPct: number;
  regime: string;
}

export interface WalkForwardResult {
  strategyId: string;
  windowCount: number;
  robustnessPct: number;
  verdict: "robust" | "regime_dependent" | "weak";
  windows: WalkForwardWindow[];
  generatedAt: string;
}

export interface WalkForwardRequest {
  strategyId: string;
  symbol: string;
  market: "stock" | "crypto";
}

export interface EngineAdapter {
  runBacktest(request: BacktestRequest): Promise<BacktestResult>;
  runWalkForward(request: WalkForwardRequest): Promise<WalkForwardResult>;
  startPaperSession(strategyId: string): Promise<PaperSession>;
  stopSession(sessionId: string): Promise<void>;
  getOrders(strategyId: string): Promise<NormalizedOrder[]>;
  getPositions(strategyId: string): Promise<PositionSnapshot[]>;
  getStrategyStatus(strategyId: string): Promise<StrategyRuntimeStatus>;
  getEngineStatus(): Promise<EngineStatus>;
}
