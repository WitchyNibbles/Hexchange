import { describe, expect, it } from "vitest";
import { evaluatePromotionGates } from "../../../src/server/strategies/promotion-gates";

describe("promotion gates", () => {
  it("passes strong validation metrics", () => {
    const result = evaluatePromotionGates({
      sampleSize: 40,
      feeAdjustedReturnPct: 12,
      maxDrawdownPct: 5,
      profitFactor: 1.6,
      sharpeRatio: 1.2,
      slippageBps: 12,
      paperDriftPct: 3,
    });

    expect(result.passed).toBe(true);
  });

  it("blocks weak metrics", () => {
    const result = evaluatePromotionGates({
      sampleSize: 10,
      feeAdjustedReturnPct: -1,
      maxDrawdownPct: 19,
      profitFactor: 0.9,
      sharpeRatio: 0.4,
      slippageBps: 55,
      paperDriftPct: 15,
    });

    expect(result.passed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
