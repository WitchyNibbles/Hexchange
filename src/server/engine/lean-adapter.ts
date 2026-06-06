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
  WalkForwardRequest,
  WalkForwardResult,
  WalkForwardWindow,
} from "./types";
import { classifyRegime } from "../strategies/regime-classifier";
import type { Candle } from "../market/candles-cache";

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

  async runWalkForward(request: WalkForwardRequest): Promise<WalkForwardResult> {
    const candles = this.marketData?.getCandles(request.symbol) ?? [];
    const IN_SAMPLE_SIZE = 3;
    const OOS_SIZE = 1;
    const FEE_PCT = 0.5;

    const windows: WalkForwardWindow[] = [];

    for (let start = 0; start + IN_SAMPLE_SIZE <= candles.length; start += OOS_SIZE) {
      const inSample = candles.slice(start, start + IN_SAMPLE_SIZE);
      const oosSample = candles.slice(start + IN_SAMPLE_SIZE, start + IN_SAMPLE_SIZE + OOS_SIZE);

      const inReturn = this.computeWindowReturn(inSample, FEE_PCT);
      const maxDd = this.computeMaxDrawdown(inSample);
      const { regime } = classifyRegime(inSample);

      let outOfSampleReturnPct: number | null = null;
      let outOfSampleStart: string | null = null;
      let outOfSampleEnd: string | null = null;

      if (oosSample.length > 0) {
        const oosReturn = ((oosSample.at(-1)!.close - inSample.at(-1)!.close) / inSample.at(-1)!.close) * 100 - FEE_PCT;
        outOfSampleReturnPct = Number(oosReturn.toFixed(2));
        outOfSampleStart = oosSample[0].timestamp;
        outOfSampleEnd = oosSample.at(-1)!.timestamp;
      }

      windows.push({
        windowIndex: windows.length + 1,
        inSampleStart: inSample[0].timestamp,
        inSampleEnd: inSample.at(-1)!.timestamp,
        outOfSampleStart,
        outOfSampleEnd,
        inSampleReturnPct: inReturn,
        outOfSampleReturnPct,
        maxDrawdownPct: maxDd,
        regime,
      });
    }

    const oosWindows = windows.filter((w) => w.outOfSampleReturnPct !== null);
    const positiveOos = oosWindows.filter((w) => (w.outOfSampleReturnPct ?? 0) > 0).length;
    const robustnessPct = oosWindows.length > 0
      ? Number(((positiveOos / oosWindows.length) * 100).toFixed(1))
      : 0;

    const verdict: WalkForwardResult["verdict"] =
      robustnessPct >= 75 ? "robust"
      : robustnessPct >= 50 ? "regime_dependent"
      : "weak";

    return {
      strategyId: request.strategyId,
      windowCount: windows.length,
      robustnessPct,
      verdict,
      windows,
      generatedAt: new Date().toISOString(),
    };
  }

  private computeWindowReturn(candles: Candle[], feePct: number): number {
    if (candles.length < 2) return 0;
    const raw = ((candles.at(-1)!.close - candles[0].close) / candles[0].close) * 100;
    return Number((raw - feePct).toFixed(2));
  }

  private computeMaxDrawdown(candles: Candle[]): number {
    let peak = candles[0]?.close ?? 0;
    let maxDd = 0;
    for (const c of candles) {
      if (c.close > peak) peak = c.close;
      const dd = peak > 0 ? ((peak - c.close) / peak) * 100 : 0;
      if (dd > maxDd) maxDd = dd;
    }
    return Number(maxDd.toFixed(2));
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
