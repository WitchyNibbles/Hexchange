import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import { createProcessRunner, type ProcessRunner, type ProcessRunnerResult } from "./process-runner";
import { parseBacktestResult } from "./result-parser";
import type {
  BacktestRequest,
  BacktestResult,
  EngineAdapter,
  EngineStatus,
  PaperSession,
  StrategyRuntimeStatus,
} from "./types";

export interface NautilusAdapterOptions {
  mode: EngineStatus["mode"];
  pythonPath: string | null;
  projectDir: string | null;
  runsDir: string | null;
  runner?: ProcessRunner;
}

export class NautilusAdapter implements EngineAdapter {
  private sessions = new Map<string, PaperSession>();
  private orders = new Map<string, NormalizedOrder[]>();
  private positions = new Map<string, PositionSnapshot[]>();
  private backtests: BacktestResult[] = [];
  private readonly runner: ProcessRunner;

  constructor(private readonly options: NautilusAdapterOptions) {
    this.runner = options.runner ?? createProcessRunner();
  }

  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    if (this.options.mode === "nautilus") {
      const result = await this.runner({
        command: "backtest",
        payload: {
          strategyId: request.strategyId,
          symbol: request.symbol,
          market: request.market,
          pythonPath: this.options.pythonPath,
          projectDir: this.options.projectDir,
          runsDir: this.options.runsDir,
        },
      });

      if (result.ok && result.artifactPath) {
        const parsed = await parseBacktestResult(result.artifactPath);
        this.backtests = [parsed, ...this.backtests.filter((item) => item.strategyId !== request.strategyId)].slice(0, 10);
        return parsed;
      }
    }

    return this.buildSimulatedBacktest(request);
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
      mode: this.options.mode,
      available: true,
      runtimeHealth: this.options.mode === "nautilus" ? "ready" : "offline",
      venues: [
        {
          venue: "interactive_brokers",
          connected: false,
          scope: "stocks",
        },
        {
          venue: "kraken",
          connected: false,
          scope: "crypto",
        },
      ],
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

  private buildSimulatedBacktest(request: BacktestRequest): BacktestResult {
    const baseline = request.market === "stock" ? 11.8 : 15.4;
    const result = {
      strategyId: request.strategyId,
      runId: `backtest-${request.strategyId}`,
      feeAdjustedReturnPct: baseline,
      maxDrawdownPct: request.market === "stock" ? 4.8 : 6.2,
      trades: request.market === "stock" ? 43 : 37,
      executedAt: new Date().toISOString(),
    };
    this.backtests = [result, ...this.backtests.filter((item) => item.strategyId !== request.strategyId)].slice(0, 10);
    return result;
  }
}
