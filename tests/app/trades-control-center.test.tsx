import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TradesRoute } from "../../app/routes/trades";

describe("trades control center", () => {
  it("renders risk settings and reset controls", async () => {
    const responses = {
      "/api/trades": [],
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
        summary: "1 strategy is still blocked. Resolve the failing venue, runtime, or safety checks before using real funds.",
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
            status: "fail",
            summary: "Interactive Brokers is not ready for live execution.",
          },
          {
            id: "kraken-connectivity",
            label: "Kraken",
            status: "pass",
            summary: "Kraken is connected and ready.",
          },
        ],
        strategies: [
          {
            strategyId: "stock-momentum",
            name: "AAPL Trend Familiar",
            market: "stock",
            stage: "paper",
            ready: false,
            blockers: ["Interactive Brokers must be connected for stock execution."],
            lastBacktestSource: "nautilus_trader",
            paperSessionMode: "kraken_ready",
          },
        ],
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
    expect(screen.getByText(/kraken is connected and ready/i)).toBeInTheDocument();
    expect(screen.getByText(/credentials loaded for kraken adapter/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive brokers is not ready for live execution/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive brokers must be connected for stock execution/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset kill switch/i })).toBeInTheDocument();
  });
});
