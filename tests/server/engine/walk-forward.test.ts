import { describe, expect, it } from "vitest";
import { LeanAdapter } from "../../../src/server/engine/lean-adapter";
import { MarketDataService } from "../../../src/server/market/market-data-service";

describe("walk-forward validation", () => {
  it("produces windows from seeded market data", async () => {
    const adapter = new LeanAdapter(new MarketDataService());
    const result = await adapter.runWalkForward({
      strategyId: "crypto-breakout",
      symbol: "BTCUSD",
      market: "crypto",
    });

    expect(result.strategyId).toBe("crypto-breakout");
    expect(result.windowCount).toBeGreaterThanOrEqual(1);
    expect(result.windows.length).toBe(result.windowCount);
    expect(result.generatedAt).toBeTruthy();
  });

  it("each window has in-sample timestamps and a regime", async () => {
    const adapter = new LeanAdapter(new MarketDataService());
    const result = await adapter.runWalkForward({
      strategyId: "s1",
      symbol: "AAPL",
      market: "stock",
    });

    for (const w of result.windows) {
      expect(w.inSampleStart).toBeTruthy();
      expect(w.inSampleEnd).toBeTruthy();
      expect(w.maxDrawdownPct).toBeGreaterThanOrEqual(0);
      expect(["trending_up", "trending_down", "ranging", "volatile"]).toContain(w.regime);
    }
  });

  it("last window may have no OOS data when candles are exhausted", async () => {
    const adapter = new LeanAdapter(new MarketDataService());
    const result = await adapter.runWalkForward({
      strategyId: "s1",
      symbol: "AAPL",
      market: "stock",
    });

    const lastWindow = result.windows.at(-1)!;
    if (lastWindow.outOfSampleReturnPct === null) {
      expect(lastWindow.outOfSampleStart).toBeNull();
      expect(lastWindow.outOfSampleEnd).toBeNull();
    }
  });

  it("robustnessPct is 0–100", async () => {
    const adapter = new LeanAdapter(new MarketDataService());
    const result = await adapter.runWalkForward({
      strategyId: "s1",
      symbol: "BTCUSD",
      market: "crypto",
    });

    expect(result.robustnessPct).toBeGreaterThanOrEqual(0);
    expect(result.robustnessPct).toBeLessThanOrEqual(100);
  });

  it("verdict maps correctly to robustness thresholds", async () => {
    const adapter = new LeanAdapter(new MarketDataService());
    const result = await adapter.runWalkForward({
      strategyId: "s1",
      symbol: "BTCUSD",
      market: "crypto",
    });

    if (result.robustnessPct >= 75) expect(result.verdict).toBe("robust");
    else if (result.robustnessPct >= 50) expect(result.verdict).toBe("regime_dependent");
    else expect(result.verdict).toBe("weak");
  });

  it("returns a result with no candles (graceful fallback)", async () => {
    const adapter = new LeanAdapter();
    const result = await adapter.runWalkForward({
      strategyId: "unknown",
      symbol: "AAPL",
      market: "stock",
    });

    expect(result.windows).toHaveLength(0);
    expect(result.robustnessPct).toBe(0);
    expect(result.verdict).toBe("weak");
  });
});
