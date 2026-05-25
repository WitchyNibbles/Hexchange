import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardRoute } from "../../app/routes/dashboard";

describe("dashboard route", () => {
  it("renders transparent status data", async () => {
    const responses = {
      "/api/system/status": {
        mode: "paper",
        currentActivity: "AAPL Trend Familiar is paper trading AAPL.",
        totalProfitUsd: 124.5,
        totalProfitPct: 1.25,
        dailyDrawdownPct: 0.8,
        grossExposureUsd: 1100,
        activeWarnings: [],
        paperStrategies: 1,
        liveStrategies: 0,
        killSwitchEngaged: false,
        dataFreshness: "fresh",
      },
      "/api/events": [],
      "/api/strategies": [
        {
          id: "crypto-breakout",
          name: "BTC Breakout Familiar",
          market: "crypto",
          symbol: "BTCUSD",
          stage: "paper",
          currentActivity: "kraken paper validation active",
          signal: null,
          validation: {
            sampleSize: 49,
            feeAdjustedReturnPct: 14.2,
            maxDrawdownPct: 4.8,
            profitFactor: 1.9,
            sharpeRatio: 1.33,
            slippageBps: 11,
            paperDriftPct: 2.1,
          },
          paperSessionActive: true,
          paperSession: null,
          deploymentMode: "kraken_live_candidate",
          operatorWarning: "Kraken is the only venue that can progress from paper validation to live trading right now.",
          liveEligible: true,
          validationReport: ["strategy passed all promotion gates"],
          liveEvidenceProgress: {
            ready: true,
            items: [
              {
                id: "real-backtest",
                label: "Real Nautilus backtest",
                status: "pass",
                summary: "Completed.",
              },
              {
                id: "completed-cycles",
                label: "Completed Kraken paper cycles",
                status: "pass",
                summary: "3/2 completed.",
              },
            ],
          },
          paperValidationStats: {
            cycles: 4,
            completedCycles: 3,
            cumulativeRealizedPnlUsd: 26.41,
            averageReturnPct: 0.58,
            winRatePct: 66.67,
          },
          lastPaperCycle: {
            status: "completed",
            realizedPnlUsd: 8.66,
            entryNotionalUsd: 1358.45,
            paperReturnPct: 0.64,
            exitCount: 2,
            completedAt: "2026-05-24T12:00:00.000Z",
          },
          paperCycleHistory: [
            {
              sessionId: "paper-crypto-breakout-2",
              status: "completed",
              venue: "kraken",
              executionMode: "paper",
              runtimeSource: "nautilus_trader",
              realizedPnlUsd: 8.66,
              entryNotionalUsd: 1358.45,
              paperReturnPct: 0.64,
              exitCount: 2,
              startedAt: "2026-05-24T11:52:00.000Z",
              completedAt: "2026-05-24T12:00:00.000Z",
            },
          ],
          lastBacktest: null,
        },
      ],
      "/api/control/validation-campaign": {
        status: "collecting",
        summary: "Kraken paper validation is actively collecting forward evidence.",
        nextAction: "Keep Kraken paper validation running until the observed-hour and completed-cycle targets are met.",
        observedHoursTarget: 24,
        completedCyclesTarget: 10,
        observedHours: 0.1,
        completedCycles: 3,
        firstObservedCycleAt: "2026-05-24T11:52:00.000Z",
        lastCompletedCycleAt: "2026-05-24T12:00:00.000Z",
        readyCryptoStrategies: 1,
        unresolvedCryptoEvidenceChecks: 0,
        campaignReady: false,
      },
      "/api/trades": [
        {
          id: "trade-kraken-exit",
          strategyId: "crypto-breakout",
          symbol: "BTCUSD",
          market: "crypto",
          side: "sell",
          quantity: 0.0105,
          price: 65220,
          feeUsd: 0.68,
          realizedPnlUsd: 5.59,
          expectedEdgeBps: 148,
          explanation: "Closed the Kraken paper leg.",
          createdAt: "2026-05-24T12:09:00.000Z",
          venue: "kraken",
          executionMode: "paper",
          runtimeSource: "nautilus_trader",
          sessionId: "paper-crypto-breakout",
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const key = String(input);
        return new Response(JSON.stringify(responses[key as keyof typeof responses] ?? []), { status: 200 });
      }),
    );

    render(<DashboardRoute />);

    await waitFor(() => {
      expect(screen.getByText(/AAPL Trend Familiar is paper trading AAPL/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/BTCUSD sell at \$65220\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/kraken · paper · session paper-crypto-breakout/i)).toBeInTheDocument();
    expect(screen.getByText(/paper record/i)).toBeInTheDocument();
    expect(screen.getByText(/3 completed cycles/i)).toBeInTheDocument();
    expect(screen.getByText(/66.67% win rate/i)).toBeInTheDocument();
    expect(screen.getByText(/\$26.41 cumulative pnl/i)).toBeInTheDocument();
    expect(screen.getByText(/forward validation window/i)).toBeInTheDocument();
    expect(screen.getByText(/first observed cycle 2026-05-24T11:52:00.000Z · last completed cycle 2026-05-24T12:00:00.000Z/i)).toBeInTheDocument();
    expect(screen.getByText(/1 crypto strategies currently satisfy the live evidence gate · 0 evidence checks still unresolved/i)).toBeInTheDocument();
    expect(screen.getByText(/validation campaign target/i)).toBeInTheDocument();
    expect(screen.getByText(/collecting · kraken paper validation is actively collecting forward evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/next action: keep kraken paper validation running until the observed-hour and completed-cycle targets are met/i)).toBeInTheDocument();
    expect(screen.getByText(/0.1\/24 observed hours · 3\/10 completed cycles/i)).toBeInTheDocument();
    expect(screen.getByText(/keep kraken paper validation running until both the observed-hour and completed-cycle targets are met/i)).toBeInTheDocument();
  });
});
