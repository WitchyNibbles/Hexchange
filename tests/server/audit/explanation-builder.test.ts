import { describe, expect, it } from "vitest";
import { buildOrderNarrative, buildSignalNarrative } from "../../../src/server/audit/explanation-builder";

describe("explanation builder", () => {
  it("builds plain-language signal and order narratives", () => {
    const signal = buildSignalNarrative("AAPL Trend Familiar", {
      summary: "Momentum is strong.",
      indicators: ["price > mean"],
      regime: "trend",
      confidence: 0.8,
      expectedEdgeBps: 95,
      invalidation: "lose range low",
    });

    const order = buildOrderNarrative({
      id: "order-1",
      strategyId: "stock-momentum",
      symbol: "AAPL",
      market: "stock",
      side: "buy",
      quantity: 5,
      submittedAt: new Date().toISOString(),
      rationale: "Momentum is strong.",
    });

    expect(signal).toContain("Confidence 80%");
    expect(order).toContain("BUY 5 AAPL");
  });
});
