interface KrakenPublicMarketDataOptions {
  fetch?: typeof fetch;
  cacheTtlMs?: number;
  baseUrl?: string;
}

interface CachedPrice {
  price: number;
  fetchedAt: number;
}

export interface KrakenTicker {
  getLatestPrice(symbol: string): Promise<number | null>;
}

export class KrakenPublicMarketData implements KrakenTicker {
  private readonly fetchImpl: typeof fetch;
  private readonly cacheTtlMs: number;
  private readonly baseUrl: string;
  private readonly cache = new Map<string, CachedPrice>();

  constructor(options: KrakenPublicMarketDataOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.cacheTtlMs = options.cacheTtlMs ?? 15_000;
    this.baseUrl = options.baseUrl ?? "https://api.kraken.com";
  }

  async getLatestPrice(symbol: string): Promise<number | null> {
    const normalizedPair = normalizeKrakenPair(symbol);
    if (!normalizedPair) {
      return null;
    }

    const cached = this.cache.get(normalizedPair);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.price;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/0/public/Ticker?pair=${normalizedPair}`, {
      headers: {
        "User-Agent": "Hexchange ticker client",
      },
    });
    if (!response.ok) {
      throw new Error(`Kraken public ticker request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      error?: string[];
      result?: Record<string, { c?: string[] }>;
    };
    if (payload.error && payload.error.length > 0) {
      throw new Error(`Kraken public ticker returned errors: ${payload.error.join(", ")}`);
    }

    const ticker = payload.result ? Object.values(payload.result)[0] : null;
    const lastTradePrice = Number(ticker?.c?.[0] ?? Number.NaN);
    if (!Number.isFinite(lastTradePrice)) {
      return null;
    }

    this.cache.set(normalizedPair, {
      price: lastTradePrice,
      fetchedAt: now,
    });
    return lastTradePrice;
  }
}

function normalizeKrakenPair(symbol: string): string | null {
  if (symbol === "BTCUSD") {
    return "BTCUSD";
  }

  return null;
}
