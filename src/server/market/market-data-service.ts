import { CandlesCache, type Candle } from "./candles-cache";
import { getSymbolMetadata, listSupportedSymbols } from "./symbol-registry";

const seedCandles: Record<string, Candle[]> = {
  AAPL: [
    { timestamp: "2026-05-20T09:30:00.000Z", open: 211, high: 214, low: 210, close: 213, volume: 1000000 },
    { timestamp: "2026-05-21T09:30:00.000Z", open: 213, high: 216, low: 212, close: 215, volume: 1100000 },
    { timestamp: "2026-05-22T09:30:00.000Z", open: 215, high: 218, low: 214, close: 217, volume: 1230000 },
    { timestamp: "2026-05-23T09:30:00.000Z", open: 217, high: 220, low: 216, close: 219, volume: 1350000 }
  ],
  BTCUSD: [
    { timestamp: "2026-05-20T00:00:00.000Z", open: 62400, high: 63100, low: 62100, close: 62850, volume: 8500 },
    { timestamp: "2026-05-21T00:00:00.000Z", open: 62850, high: 63500, low: 62700, close: 63320, volume: 9100 },
    { timestamp: "2026-05-22T00:00:00.000Z", open: 63320, high: 64100, low: 63200, close: 63980, volume: 9700 },
    { timestamp: "2026-05-23T00:00:00.000Z", open: 63980, high: 64850, low: 63750, close: 64720, volume: 10300 }
  ],
};

export class MarketDataService {
  constructor(private readonly cache = new CandlesCache(), private readonly now = () => new Date()) {
    for (const { symbol } of listSupportedSymbols()) {
      this.cache.set(symbol, seedCandles[symbol] ?? []);
    }
  }

  listSupportedSymbols(): string[] {
    return listSupportedSymbols().map((item) => item.symbol);
  }

  getCandles(symbol: string): Candle[] {
    getSymbolMetadata(symbol);
    return this.cache.get(symbol)?.candles ?? [];
  }

  getLatestPrice(symbol: string): number {
    const candles = this.getCandles(symbol);
    const latest = candles.at(-1);
    if (!latest) {
      throw new Error(`Missing candles for ${symbol}`);
    }
    return latest.close;
  }

  isFresh(symbol: string): boolean {
    const record = this.cache.get(symbol);
    if (!record) {
      return false;
    }
    return this.now().getTime() - new Date(record.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 7;
  }
}
