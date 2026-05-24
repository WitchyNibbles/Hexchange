import { describe, expect, it, vi } from "vitest";
import { AlpacaPaperBroker } from "../../../../src/server/brokers/alpaca/alpaca-paper-broker";

describe("alpaca paper broker", () => {
  it("maps paper orders and positions", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v2/orders") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "alpaca-order-1",
            symbol: "AAPL",
            side: "buy",
            qty: "5",
            status: "filled",
            filled_avg_price: "219.11",
          }),
          { status: 200 },
        );
      }

      if (url.includes("/v2/orders?status=all")) {
        return new Response(
          JSON.stringify([
            {
              id: "alpaca-order-1",
              symbol: "BTC/USD",
              side: "buy",
              qty: "0.05",
              status: "filled",
              filled_avg_price: "64520.00",
            },
          ]),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify([
          {
            symbol: "AAPL",
            qty: "5",
            avg_entry_price: "219.11",
            current_price: "220.55",
            unrealized_pl: "7.20",
            unrealized_intraday_pl: "1.10",
          },
        ]),
        { status: 200 },
      );
    });

    const broker = new AlpacaPaperBroker({
      enabled: true,
      apiKey: "key",
      apiSecret: "secret",
      baseUrl: "https://paper-api.alpaca.markets",
      fetchImpl,
    });

    const order = await broker.submitPaperOrder({
      id: "intent-1",
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
      side: "buy",
      quantity: 5,
      submittedAt: new Date().toISOString(),
      rationale: "momentum",
    });

    const orders = await broker.getOrders("crypto-breakout");
    const positions = await broker.getPositions();

    expect(order.averageFillPrice).toBe(219.11);
    expect(orders[0].market).toBe("crypto");
    expect(positions[0].unrealizedPnlUsd).toBe(7.2);
  });
});
