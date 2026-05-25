import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StrategiesRoute } from "../../app/routes/strategies";

describe("strategy cockpit", () => {
  it("renders engine mode and backtest evidence", async () => {
    const responses = {
      "/api/strategies": [
        {
          id: "stock-momentum",
          name: "AAPL Trend Familiar",
          market: "stock",
          symbol: "AAPL",
          stage: "backtest",
          currentActivity: "ready",
          signal: {
            summary: "Momentum remains constructive.",
            indicators: ["price > trailing mean"],
            regime: "trend",
            confidence: 0.78,
            expectedEdgeBps: 86,
            invalidation: "lose range low",
          },
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
          autoPaperValidationEnabled: true,
          paperSession: {
            sessionId: "paper-stock-momentum",
            startedAt: "2026-05-24T08:30:00.000Z",
            lastHeartbeatAt: "2026-05-24T08:31:00.000Z",
            processId: 4242,
            runtimeSource: "nautilus_trader",
            executionMode: "kraken_ready",
          },
          deploymentMode: "simulation_only",
          operatorWarning: "Simulation only: stock execution is disabled until a real stock broker is added.",
          liveEligible: false,
          validationReport: ["strategy passed all promotion gates"],
          lastPaperCycle: {
            status: "completed",
            realizedPnlUsd: 8.66,
            entryNotionalUsd: 1358.45,
            paperReturnPct: 0.64,
            exitCount: 2,
            completedAt: "2026-05-24T08:40:00.000Z",
          },
          paperValidationStats: {
            cycles: 4,
            completedCycles: 3,
            cumulativeRealizedPnlUsd: 26.41,
            averageReturnPct: 0.58,
            winRatePct: 66.67,
          },
          lastBacktest: {
            strategyId: "stock-momentum",
            runId: "backtest-stock-momentum",
            feeAdjustedReturnPct: 12.4,
            maxDrawdownPct: 5.2,
            trades: 43,
            executedAt: "2026-05-24T08:00:00.000Z",
            runtimeSource: "nautilus_trader",
            dataSource: "Locally generated sample bars via NautilusTrader.",
          },
        },
      ],
      "/api/engine/status": {
        mode: "nautilus",
        available: true,
        runtimeHealth: "ready",
        venues: [
          {
            venue: "interactive_brokers",
            connected: false,
            scope: "stocks",
          },
          {
            venue: "kraken",
            connected: true,
            scope: "crypto",
          },
        ],
        latestBacktests: [
          {
            strategyId: "stock-momentum",
            runId: "backtest-stock-momentum",
            feeAdjustedReturnPct: 12.4,
            maxDrawdownPct: 5.2,
            trades: 43,
            executedAt: "2026-05-24T08:00:00.000Z",
            runtimeSource: "nautilus_trader",
            dataSource: "Locally generated sample bars via NautilusTrader.",
          },
        ],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const key = String(input);
        return new Response(JSON.stringify(responses[key as keyof typeof responses] ?? []), { status: 200 });
      }),
    );

    render(<StrategiesRoute />);

    await waitFor(() => {
      expect(screen.getByText(/AAPL Trend Familiar/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/engine mode/i)).toBeInTheDocument();
    expect(screen.getByText(/^nautilus$/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime health/i)).toBeInTheDocument();
    expect(screen.getByText(/^ready$/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive brokers/i)).toBeInTheDocument();
    expect(screen.getByText(/kraken .* crypto .* connected/i)).toBeInTheDocument();
    expect(screen.getByText(/last backtest/i)).toBeInTheDocument();
    expect(screen.getByText(/via nautilus_trader/i)).toBeInTheDocument();
    expect(screen.getByText(/execution policy/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation only: stock execution is disabled until a real stock broker is added/i)).toBeInTheDocument();
    expect(screen.getByText(/paper-stock-momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/pid 4242/i)).toBeInTheDocument();
    expect(screen.getByText(/mode kraken_ready/i)).toBeInTheDocument();
    expect(screen.getByText(/last paper cycle/i)).toBeInTheDocument();
    expect(screen.getByText(/completed · pnl \$8.66 · return 0.64% · exits 2/i)).toBeInTheDocument();
    expect(screen.getByText(/paper record/i)).toBeInTheDocument();
    expect(screen.getByText(/cycles 4 · completed 3 · win rate 66.67% · avg return 0.58% · pnl \$26.41/i)).toBeInTheDocument();
    expect(screen.getByText(/stock strategies stay manual because they are simulation-only/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation session/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop simulation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run backtest/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulation only/i })).toBeDisabled();
  });
});
