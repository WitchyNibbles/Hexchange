import { describe, expect, it } from "vitest";
import { MarketDataService } from "../../../src/server/market/market-data-service";
import { buildStockMomentumSignal } from "../../../src/server/strategies/stock-momentum";

describe("stock momentum strategy", () => {
  it("emits a signal when price closes above the trailing mean", () => {
    const service = new MarketDataService();
    const signal = buildStockMomentumSignal(service.getCandles("AAPL"));

    expect(signal?.expectedEdgeBps).toBeGreaterThan(0);
  });
});
