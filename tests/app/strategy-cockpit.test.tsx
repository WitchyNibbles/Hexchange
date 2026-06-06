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
          paperSessionActive: false,
          liveEligible: true,
          validationReport: ["strategy passed all promotion gates"],
          lastBacktest: {
            strategyId: "stock-momentum",
            runId: "backtest-stock-momentum",
            feeAdjustedReturnPct: 12.4,
            maxDrawdownPct: 5.2,
            trades: 43,
            executedAt: "2026-05-24T08:00:00.000Z",
          },
        },
      ],
      "/api/engine/status": {
        mode: "simulated",
        available: true,
        latestBacktests: [
          {
            strategyId: "stock-momentum",
            runId: "backtest-stock-momentum",
            feeAdjustedReturnPct: 12.4,
            maxDrawdownPct: 5.2,
            trades: 43,
            executedAt: "2026-05-24T08:00:00.000Z",
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

    expect(screen.getByText(/^Engine$/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated/i)).toBeInTheDocument();
    expect(screen.getByText(/last backtest/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run backtest/i })).toBeInTheDocument();
  });
});
