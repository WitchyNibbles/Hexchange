import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type { MarketDataService } from "../market/market-data-service";
import type {
  BacktestRequest,
  BacktestResult,
  EngineAdapter,
  EngineStatus,
  PaperSession,
  StrategyRuntimeStatus,
} from "./types";

export class LeanAdapter implements EngineAdapter {
  private sessions = new Map<string, PaperSession>();
  private orders = new Map<string, NormalizedOrder[]>();
  private positions = new Map<string, PositionSnapshot[]>();
  private backtests: BacktestResult[] = [];

  constructor(private readonly marketData?: MarketDataService) {}

  private getMode(): EngineStatus["mode"] {
    return process.env.HEXCHANGE_ENGINE_MODE === "lean_cli" ? "lean_cli" : "simulated";
  }

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    const candles = this.marketData?.getCandles(request.symbol) ?? [];
    const closes = candles.map((c) => c.close);

    let feeAdjustedReturnPct: number;
    let maxDrawdownPct: number;
    let tradeCount: number;

    if (closes.length >= 2) {
      const totalReturn = ((closes.at(-1)! - closes[0]) / closes[0]) * 100;
      feeAdjustedReturnPct = Number((totalReturn - 0.5).toFixed(2));

      let peak = closes[0];
      let maxDd = 0;
      for (const price of closes) {
        if (price > peak) peak = price;
        const dd = ((peak - price) / peak) * 100;
        if (dd > maxDd) maxDd = dd;
      }
      maxDrawdownPct = Number(maxDd.toFixed(2));
      tradeCount = closes.length - 1;
    } else {
      feeAdjustedReturnPct = request.market === "stock" ? 3.2 : 5.1;
      maxDrawdownPct = request.market === "stock" ? 1.4 : 2.1;
      tradeCount = request.market === "stock" ? 8 : 6;
    }

    const result = {
      strategyId: request.strategyId,
      runId: `backtest-${request.strategyId}`,
      feeAdjustedReturnPct,
      maxDrawdownPct,
      trades: tradeCount,
      executedAt: new Date().toISOString(),
    };
    this.backtests = [result, ...this.backtests.filter((item) => item.strategyId !== request.strategyId)].slice(0, 10);
    return result;
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

  async getEngineStatus(): Promise<EngineStatus> {
    return {
      mode: this.getMode(),
      available: true,
      latestBacktests: this.backtests,
    };
  }

  setOrders(strategyId: string, orders: NormalizedOrder[]): void {
    this.orders.set(strategyId, orders);
  }

  setPositions(strategyId: string, positions: PositionSnapshot[]): void {
    this.positions.set(strategyId, positions);
  }

  seedBacktests(backtests: BacktestResult[]): void {
    this.backtests = backtests;
  }
}
