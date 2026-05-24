import { describe, expect, it } from "vitest";
import { MarketDataService } from "../../../src/server/market/market-data-service";
import { KillSwitch } from "../../../src/server/risk/kill-switch";
import { RiskEngine } from "../../../src/server/risk/risk-engine";

describe("risk engine", () => {
  it("approves fresh orders under limits", () => {
    const service = new MarketDataService();
    const riskEngine = new RiskEngine(
      {
        maxPositionNotionalUsd: 100000,
        maxDailyLossPct: 8,
      },
      new KillSwitch(),
      service,
    );

    const result = riskEngine.evaluateOrder(
      {
        id: "order-1",
        strategyId: "stock-momentum",
        symbol: "AAPL",
        market: "stock",
        side: "buy",
        quantity: 5,
        submittedAt: new Date().toISOString(),
        rationale: "test order",
      },
      [],
      1.2,
    );

    expect(result.approved).toBe(true);
  });
});
