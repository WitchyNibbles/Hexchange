export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CachedCandles {
  candles: Candle[];
  updatedAt: string;
}

export class CandlesCache {
  private readonly store = new Map<string, CachedCandles>();

  set(symbol: string, candles: Candle[]): void {
    this.store.set(symbol, {
      candles,
      updatedAt: new Date().toISOString(),
    });
  }

  get(symbol: string): CachedCandles | undefined {
    return this.store.get(symbol);
  }
}
