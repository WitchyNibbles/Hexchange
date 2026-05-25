import { describe, expect, it, vi } from "vitest";
import { KrakenPublicMarketData } from "../../../src/server/market/kraken-public-market-data";

describe("kraken public market data", () => {
  it("fetches and caches the latest ticker close price", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: [],
          result: {
            XXBTZUSD: {
              c: ["77512.00000", "0.00007921"],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const marketData = new KrakenPublicMarketData({
      fetch: fetchMock as typeof fetch,
      cacheTtlMs: 60_000,
    });

    const firstPrice = await marketData.getLatestPrice("BTCUSD");
    const secondPrice = await marketData.getLatestPrice("BTCUSD");
    const firstCall = fetchMock.mock.calls[0] as unknown[] | undefined;

    expect(firstPrice).toBe(77512);
    expect(secondPrice).toBe(77512);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(firstCall?.[0] ?? "")).toContain("/0/public/Ticker?pair=BTCUSD");
  });
});
