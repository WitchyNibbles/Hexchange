import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TradesRoute } from "../../app/routes/trades";

describe("trades control center", () => {
  it("renders risk settings and reset controls", async () => {
    const responses = {
      "/api/trades": [
        {
          id: "trade-kraken-entry",
          strategyId: "crypto-breakout",
          symbol: "BTCUSD",
          market: "crypto",
          side: "buy",
          quantity: 0.021,
          price: 64688,
          feeUsd: 1.36,
          realizedPnlUsd: 0,
          expectedEdgeBps: 148,
          explanation: "Kraken runtime telemetry executed the active crypto validation leg.",
          createdAt: "2026-05-24T12:04:00.000Z",
          venue: "kraken",
          executionMode: "paper",
          runtimeSource: "nautilus_trader",
          sessionId: "paper-crypto-breakout",
        },
      ],
      "/api/system/portfolio": {
        positions: [],
        openOrders: [],
      },
      "/api/control/settings": {
        maxPositionNotionalUsd: 25000,
        maxDailyLossPct: 4.5,
        liveRolloutCapUsd: 750,
      },
      "/api/control/live-readiness": {
        updatedAt: "2026-05-24T12:00:00.000Z",
        overallStatus: "blocked",
        summary: "1 strategy is still blocking live rollout. 1 stock strategy remains simulation-only. Resolve the failing runtime, Kraken, or safety checks before using real funds.",
        checks: [
          {
            id: "nautilus-runtime",
            label: "Nautilus runtime",
            status: "pass",
            summary: "The Nautilus runtime is available for local execution.",
          },
          {
            id: "interactive_brokers-connectivity",
            label: "Interactive Brokers",
            status: "pass",
            summary: "Interactive Brokers is optional for now because stock strategies are simulation-only.",
          },
          {
            id: "kraken-connectivity",
            label: "Kraken",
            status: "fail",
            summary: "Kraken is not ready for live execution.",
          },
        ],
        strategies: [
          {
            strategyId: "stock-momentum",
            name: "AAPL Trend Familiar",
            market: "stock",
            stage: "paper",
            deploymentMode: "simulation_only",
            ready: false,
            blocking: false,
            blockers: ["Simulation only: stock execution is disabled until a real stock broker is added."],
            lastBacktestSource: "nautilus_trader",
            paperSessionMode: "kraken_ready",
          },
        ],
      },
      "/api/control/validation-campaign": {
        status: "collecting",
        summary: "Kraken paper validation is actively collecting forward evidence.",
        nextAction: "Keep Kraken paper validation running until the observed-hour and completed-cycle targets are met.",
        observedHoursTarget: 24,
        completedCyclesTarget: 10,
        observedHours: 6.5,
        completedCycles: 4,
        firstObservedCycleAt: "2026-05-24T06:00:00.000Z",
        lastCompletedCycleAt: "2026-05-24T12:30:00.000Z",
        readyCryptoStrategies: 1,
        unresolvedCryptoEvidenceChecks: 2,
        campaignReady: false,
      },
      "/api/engine/status": {
        mode: "nautilus",
        available: true,
        runtimeHealth: "ready",
        venues: [
          {
            venue: "interactive_brokers",
            connected: false,
            scope: "stocks",
            details: "Gateway credentials or socket unavailable.",
          },
          {
            venue: "kraken",
            connected: true,
            scope: "crypto",
            details: "Credentials loaded for Kraken adapter.",
          },
        ],
        latestBacktests: [],
      },
      "/api/system/status": {
        mode: "halted",
        currentActivity: "Trading is paused.",
        totalProfitUsd: 120,
        totalProfitPct: 1.2,
        dailyDrawdownPct: 2.4,
        grossExposureUsd: 0,
        activeWarnings: ["Manual halt"],
        paperStrategies: 0,
        liveStrategies: 0,
        killSwitchEngaged: true,
        dataFreshness: "fresh",
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const key = String(input);
        return new Response(JSON.stringify(responses[key as keyof typeof responses] ?? {}), { status: 200 });
      }),
    );

    render(<TradesRoute />);

    await waitFor(() => {
      expect(screen.getByText(/credentials loaded for kraken adapter/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Daily loss threshold/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/engine venue posture/i)).toBeInTheDocument();
    expect(screen.getByText(/live readiness ritual/i)).toBeInTheDocument();
    expect(screen.getByText(/validation campaign/i)).toBeInTheDocument();
    expect(screen.getByText(/collecting · kraken paper validation is actively collecting forward evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/next action: keep kraken paper validation running until the observed-hour and completed-cycle targets are met/i)).toBeInTheDocument();
    expect(screen.getByText(/6.5\/24 observed hours · 4\/10 completed cycles/i)).toBeInTheDocument();
    expect(screen.getByText(/1 crypto strategies ready · 2 evidence checks unresolved · campaign still running/i)).toBeInTheDocument();
    expect(screen.getByText(/kraken is not ready for live execution/i)).toBeInTheDocument();
    expect(screen.getByText(/credentials loaded for kraken adapter/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive brokers is optional for now because stock strategies are simulation-only/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation only: stock execution is disabled until a real stock broker is added/i)).toBeInTheDocument();
    expect(screen.getByText(/kraken · paper · nautilus_trader/i)).toBeInTheDocument();
    expect(screen.getByText(/session paper-crypto-breakout/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset kill switch/i })).toBeInTheDocument();
  });
});
