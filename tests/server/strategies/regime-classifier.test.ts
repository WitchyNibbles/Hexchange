import { describe, expect, it } from "vitest";
import { classifyRegime } from "../../../src/server/strategies/regime-classifier";
import type { Candle } from "../../../src/server/market/candles-cache";

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: `2026-05-${String(i + 1).padStart(2, "0")}T09:30:00.000Z`,
    open: close,
    high: close * 1.005,
    low: close * 0.995,
    close,
    volume: 1_000_000,
  }));
}

describe("classifyRegime", () => {
  it("returns ranging for fewer than 3 candles", () => {
    const { regime } = classifyRegime(makeCandles([100, 101]));
    expect(regime).toBe("ranging");
  });

  it("classifies a steady uptrend as trending_up", () => {
    const candles = makeCandles([100, 102, 104, 106, 108]);
    const { regime, trendStrengthPct } = classifyRegime(candles);
    expect(regime).toBe("trending_up");
    expect(trendStrengthPct).toBeGreaterThan(0);
  });

  it("classifies a steady downtrend as trending_down", () => {
    const candles = makeCandles([108, 106, 104, 102, 100]);
    const { regime } = classifyRegime(candles);
    expect(regime).toBe("trending_down");
  });

  it("classifies high-volatility as volatile (overrides trend)", () => {
    const candles = makeCandles([100, 120, 80, 130, 70]);
    const { regime, volatilityPct } = classifyRegime(candles);
    expect(regime).toBe("volatile");
    expect(volatilityPct).toBeGreaterThan(3);
  });

  it("classifies flat sideways as ranging", () => {
    const candles = makeCandles([100, 100.1, 99.9, 100.05, 100]);
    const { regime } = classifyRegime(candles);
    expect(regime).toBe("ranging");
  });
});
