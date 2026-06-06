import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";

vi.mock("lightweight-charts", () => ({ createChart: () => ({ addSeries: () => ({ setData: vi.fn() }), timeScale: () => ({ fitContent: vi.fn() }), applyOptions: vi.fn(), remove: vi.fn() }), AreaSeries: {}, ColorType: { Solid: "solid" } }));
vi.mock("lottie-react", () => ({ default: () => null }));
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
      "/api/trades": [],
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
      expect(screen.getByText("Local trading familiar")).toBeInTheDocument();
      expect(screen.getByText(/AAPL Trend Familiar is paper trading AAPL/i)).toBeInTheDocument();
    });
  });
});
