import { describe, expect, it } from "vitest";
import { buildLiveReadinessReport } from "../../../src/server/live/live-readiness-report";
import type { EngineStatus, RiskSettings } from "../../../src/shared/contracts";
import type { StrategyState } from "../../../src/server/domain/strategy";
import type { BacktestResult, PaperSession } from "../../../src/server/engine/types";

const baseEngineStatus: EngineStatus = {
  mode: "nautilus",
  available: true,
  runtimeHealth: "ready",
  runtimeDetails: "nautilus_trader 2.0.0",
  venues: [
    {
      venue: "interactive_brokers",
      connected: true,
      scope: "stocks",
      details: "Gateway reachable.",
    },
    {
      venue: "kraken",
      connected: true,
      scope: "crypto",
      details: "Credentials loaded for Kraken adapter.",
    },
  ],
  latestBacktests: [],
};

const baseRiskSettings: RiskSettings = {
  maxPositionNotionalUsd: 100000,
  maxDailyLossPct: 8,
  liveRolloutCapUsd: 500,
};

const stockStrategy: StrategyState = {
  id: "stock-momentum",
  name: "AAPL Trend Familiar",
  market: "stock",
  symbol: "AAPL",
  stage: "paper",
  signal: null,
  validation: {
    sampleSize: 48,
    feeAdjustedReturnPct: 12.4,
    maxDrawdownPct: 5.2,
    profitFactor: 1.7,
    sharpeRatio: 1.26,
    slippageBps: 12,
    paperDriftPct: 2.3,
  },
  paperSessionActive: true,
};

const stockBacktest: BacktestResult = {
  strategyId: "stock-momentum",
  runId: "backtest-stock-momentum",
  feeAdjustedReturnPct: 12.4,
  maxDrawdownPct: 5.2,
  trades: 43,
  executedAt: "2026-05-24T08:00:00.000Z",
  runtimeSource: "nautilus_trader",
  dataSource: "Locally generated sample bars via NautilusTrader.",
};

const stockSession: PaperSession = {
  sessionId: "paper-stock-momentum",
  strategyId: "stock-momentum",
  startedAt: "2026-05-24T08:30:00.000Z",
  lastHeartbeatAt: "2026-05-24T08:31:00.000Z",
  processId: 4242,
  runtimeSource: "nautilus_trader",
  executionMode: "dual_venue_ready",
};

describe("live readiness report", () => {
  it("marks the platform ready when venues, runtime, and strategy evidence are all in place", () => {
    const report = buildLiveReadinessReport({
      engineStatus: baseEngineStatus,
      strategies: [stockStrategy],
      backtests: [stockBacktest],
      managedSessions: new Map([[stockStrategy.id, stockSession]]),
      riskSettings: baseRiskSettings,
      killSwitchEngaged: false,
    });

    expect(report.overallStatus).toBe("ready");
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
    expect(report.strategies[0]).toMatchObject({
      strategyId: "stock-momentum",
      ready: true,
      blockers: [],
      paperSessionMode: "dual_venue_ready",
      lastBacktestSource: "nautilus_trader",
    });
  });

  it("surfaces platform and strategy blockers when venues or safety rails are missing", () => {
    const report = buildLiveReadinessReport({
      engineStatus: {
        ...baseEngineStatus,
        runtimeHealth: "degraded",
        venues: [
          {
            venue: "interactive_brokers",
            connected: false,
            scope: "stocks",
            details: "Gateway credentials or socket unavailable.",
          },
          {
            venue: "kraken",
            connected: false,
            scope: "crypto",
            details: "Kraken API credentials missing.",
          },
        ],
      },
      strategies: [{ ...stockStrategy, paperSessionActive: false }],
      backtests: [],
      managedSessions: new Map<string, PaperSession>(),
      riskSettings: { ...baseRiskSettings, liveRolloutCapUsd: 2500 },
      killSwitchEngaged: true,
    });

    expect(report.overallStatus).toBe("blocked");
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "nautilus-runtime", status: "warn" }),
        expect.objectContaining({ id: "interactive_brokers-connectivity", status: "fail" }),
        expect.objectContaining({ id: "kraken-connectivity", status: "fail" }),
        expect.objectContaining({ id: "kill-switch", status: "fail" }),
        expect.objectContaining({ id: "live-rollout-cap", status: "fail" }),
      ]),
    );
    expect(report.strategies[0].blockers).toEqual(
      expect.arrayContaining([
        "Run a real Nautilus backtest first.",
        "Start an active paper session first.",
        "Reset the kill switch before arming live.",
        "Interactive Brokers must be connected for stock execution.",
      ]),
    );
  });
});
