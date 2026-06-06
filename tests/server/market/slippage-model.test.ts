import { describe, expect, it } from "vitest";
import { estimateSlippage, computeAverageSlippageBps } from "../../../src/server/market/slippage-model";

describe("estimateSlippage", () => {
  it("charges at least the half-spread for stocks", () => {
    const { fillPrice, slippageBps } = estimateSlippage({
      midPrice: 200,
      quantity: 1,
      market: "stock",
      adv: 1_000_000,
    });
    expect(fillPrice).toBeGreaterThan(200);
    expect(slippageBps).toBeGreaterThanOrEqual(3);
  });

  it("charges higher spread for crypto", () => {
    const stock = estimateSlippage({ midPrice: 100, quantity: 1, market: "stock", adv: 1_000_000 });
    const crypto = estimateSlippage({ midPrice: 100, quantity: 1, market: "crypto", adv: 1_000_000 });
    expect(crypto.slippageBps).toBeGreaterThan(stock.slippageBps);
  });

  it("increases with order size relative to ADV", () => {
    const small = estimateSlippage({ midPrice: 100, quantity: 1, market: "stock", adv: 100_000 });
    const large = estimateSlippage({ midPrice: 100, quantity: 10_000, market: "stock", adv: 100_000 });
    expect(large.slippageBps).toBeGreaterThan(small.slippageBps);
  });

  it("produces zero market impact when ADV is zero", () => {
    const { slippageBps } = estimateSlippage({ midPrice: 100, quantity: 10, market: "stock", adv: 0 });
    expect(slippageBps).toBe(3);
  });
});

describe("computeAverageSlippageBps", () => {
  it("returns 0 for empty list", () => {
    expect(computeAverageSlippageBps([])).toBe(0);
  });

  it("averages slippageBps across trades", () => {
    const avg = computeAverageSlippageBps([{ slippageBps: 4 }, { slippageBps: 8 }]);
    expect(avg).toBe(6);
  });

  it("ignores entries without slippageBps", () => {
    const avg = computeAverageSlippageBps([{ slippageBps: 10 }, {}]);
    expect(avg).toBe(10);
  });
});
