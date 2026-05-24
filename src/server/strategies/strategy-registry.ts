import type { StrategyState, StrategyValidationMetrics } from "../domain/strategy";
import type { MarketDataService } from "../market/market-data-service";
import { buildCryptoBreakoutSignal } from "./crypto-breakout";
import { buildStockMomentumSignal } from "./stock-momentum";

function createValidationMetrics(
  overrides: Partial<StrategyValidationMetrics>,
): StrategyValidationMetrics {
  return {
    sampleSize: 48,
    feeAdjustedReturnPct: 12.4,
    maxDrawdownPct: 5.2,
    profitFactor: 1.7,
    sharpeRatio: 1.26,
    slippageBps: 12,
    paperDriftPct: 2.3,
    ...overrides,
  };
}

export function buildReferenceStrategies(marketDataService: MarketDataService): StrategyState[] {
  return [
    {
      id: "stock-momentum",
      name: "AAPL Trend Familiar",
      market: "stock",
      symbol: "AAPL",
      stage: "backtest",
      signal: buildStockMomentumSignal(marketDataService.getCandles("AAPL")),
      validation: createValidationMetrics({ feeAdjustedReturnPct: 10.8, sharpeRatio: 1.14 }),
      paperSessionActive: false,
    },
    {
      id: "crypto-breakout",
      name: "BTC Lunar Breakout",
      market: "crypto",
      symbol: "BTCUSD",
      stage: "backtest",
      signal: buildCryptoBreakoutSignal(marketDataService.getCandles("BTCUSD")),
      validation: createValidationMetrics({
        feeAdjustedReturnPct: 14.9,
        maxDrawdownPct: 7.8,
        slippageBps: 18,
        paperDriftPct: 3.4,
      }),
      paperSessionActive: false,
    },
  ];
}
