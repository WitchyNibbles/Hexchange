import { describe, expect, it } from "vitest";
import { MarketDataService } from "../../../src/server/market/market-data-service";

describe("market data service", () => {
  it("normalizes seeded symbols and freshness", () => {
    const service = new MarketDataService();

    expect(service.listSupportedSymbols()).toEqual(["AAPL", "BTCUSD"]);
    expect(service.getLatestPrice("AAPL")).toBeGreaterThan(0);
    expect(service.isFresh("BTCUSD")).toBe(true);
  });
});
