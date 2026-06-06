import type { Candle } from "../market/candles-cache";

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface RegimeResult {
  regime: MarketRegime;
  volatilityPct: number;
  trendStrengthPct: number;
}

const VOLATILITY_THRESHOLD = 0.03;
const TREND_THRESHOLD = 0.015;

export function classifyRegime(candles: Candle[]): RegimeResult {
  if (candles.length < 3) {
    return { regime: "ranging", volatilityPct: 0, trendStrengthPct: 0 };
  }

  const closes = candles.map((c) => c.close);
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);

  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
  const volatilityPct = Number((Math.sqrt(variance) * 100).toFixed(3));

  const first = closes[0];
  const last = closes.at(-1)!;
  const trendStrengthPct = Number((((last - first) / first) * 100).toFixed(3));

  let regime: MarketRegime;

  if (volatilityPct > VOLATILITY_THRESHOLD * 100) {
    regime = "volatile";
  } else if (trendStrengthPct > TREND_THRESHOLD * 100) {
    regime = "trending_up";
  } else if (trendStrengthPct < -TREND_THRESHOLD * 100) {
    regime = "trending_down";
  } else {
    regime = "ranging";
  }

  return { regime, volatilityPct, trendStrengthPct };
}
