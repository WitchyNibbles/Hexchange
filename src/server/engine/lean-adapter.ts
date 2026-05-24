import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type {
  BacktestRequest,
  BacktestResult,
  EngineAdapter,
  PaperSession,
  StrategyRuntimeStatus,
} from "./types";

export class LeanAdapter implements EngineAdapter {
  private sessions = new Map<string, PaperSession>();
  private orders = new Map<string, NormalizedOrder[]>();
  private positions = new Map<string, PositionSnapshot[]>();

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const baseline = request.market === "stock" ? 11.8 : 15.4;

    return {
      runId: `backtest-${request.strategyId}`,
      feeAdjustedReturnPct: baseline,
      maxDrawdownPct: request.market === "stock" ? 4.8 : 6.2,
      trades: request.market === "stock" ? 43 : 37,
    };
  }

  async startPaperSession(strategyId: string): Promise<PaperSession> {
    const session = {
      sessionId: `paper-${strategyId}`,
      strategyId,
      startedAt: new Date().toISOString(),
    };
    this.sessions.set(strategyId, session);
    return session;
  }

  async stopSession(sessionId: string): Promise<void> {
    for (const [strategyId, session] of this.sessions.entries()) {
      if (session.sessionId === sessionId) {
        this.sessions.delete(strategyId);
        return;
      }
    }
  }

  async getOrders(strategyId: string): Promise<NormalizedOrder[]> {
    return this.orders.get(strategyId) ?? [];
  }

  async getPositions(strategyId: string): Promise<PositionSnapshot[]> {
    return this.positions.get(strategyId) ?? [];
  }

  async getStrategyStatus(strategyId: string): Promise<StrategyRuntimeStatus> {
    const session = this.sessions.get(strategyId);
    return {
      strategyId,
      state: session ? "paper" : "idle",
      lastHeartbeatAt: session?.startedAt ?? new Date().toISOString(),
    };
  }

  setOrders(strategyId: string, orders: NormalizedOrder[]): void {
    this.orders.set(strategyId, orders);
  }

  setPositions(strategyId: string, positions: PositionSnapshot[]): void {
    this.positions.set(strategyId, positions);
  }
}
