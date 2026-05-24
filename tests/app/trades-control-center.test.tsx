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
      expect(screen.getByText("Control Center")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Daily loss threshold/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/engine venue posture/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive brokers/i)).toBeInTheDocument();
    expect(screen.getByText(/kraken/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset kill switch/i })).toBeInTheDocument();
  });
});
