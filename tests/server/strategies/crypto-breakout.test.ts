import { describe, expect, it } from "vitest";
import { MarketDataService } from "../../../src/server/market/market-data-service";
import { buildCryptoBreakoutSignal } from "../../../src/server/strategies/crypto-breakout";

describe("crypto breakout strategy", () => {
  it("emits a signal when price breaks the recent range", () => {
    const service = new MarketDataService();
    const signal = buildCryptoBreakoutSignal(service.getCandles("BTCUSD"));

    expect(["trending_up", "trending_down", "ranging", "volatile"]).toContain(signal?.regime);
  });
});
