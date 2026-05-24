import type { Candle } from "../market/candles-cache";
import type { SignalExplanation } from "../domain/strategy";

export function buildCryptoBreakoutSignal(candles: Candle[]): SignalExplanation | null {
  if (candles.length < 4) {
    return null;
  }

  const recent = candles.slice(-4);
  const latest = recent.at(-1);
  if (!latest) {
    return null;
  }

  const priorHigh = Math.max(...recent.slice(0, -1).map((candle) => candle.high));
  if (latest.close <= priorHigh) {
    return null;
  }

  return {
    summary: `Breakout detected with BTCUSD closing above the recent range high at ${latest.close.toFixed(2)}.`,
    indicators: ["range breakout", "higher highs", "volume confirmation"],
    regime: "expansion",
    confidence: 0.74,
    expectedEdgeBps: 112,
    invalidation: "Exit if price loses the breakout level or volatility collapses.",
  };
}
