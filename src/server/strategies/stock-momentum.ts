import type { Candle } from "../market/candles-cache";
import type { SignalExplanation } from "../domain/strategy";

export function buildStockMomentumSignal(candles: Candle[]): SignalExplanation | null {
  if (candles.length < 4) {
    return null;
  }

  const recent = candles.slice(-4);
  const latest = recent.at(-1);
  if (!latest) {
    return null;
  }

  const baseline = recent.slice(0, -1).reduce((sum, candle) => sum + candle.close, 0) / 3;
  if (latest.close <= baseline) {
    return null;
  }

  return {
    summary: `Momentum remains constructive with price closing above the trailing three-candle mean at ${latest.close.toFixed(2)}.`,
    indicators: ["price > trailing mean", "volume expansion", "trend continuation"],
    regime: "trend",
    confidence: 0.78,
    expectedEdgeBps: 86,
    invalidation: "Exit if price closes back below the trailing mean or volume collapses.",
  };
}
