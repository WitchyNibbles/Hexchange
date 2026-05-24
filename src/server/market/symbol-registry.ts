export interface SymbolMetadata {
  symbol: string;
  market: "stock" | "crypto";
  displayName: string;
}

const symbols: Record<string, SymbolMetadata> = {
  AAPL: { symbol: "AAPL", market: "stock", displayName: "Apple" },
  BTCUSD: { symbol: "BTCUSD", market: "crypto", displayName: "Bitcoin / US Dollar" },
};

export function getSymbolMetadata(symbol: string): SymbolMetadata {
  const metadata = symbols[symbol];
  if (!metadata) {
    throw new Error(`Unknown symbol ${symbol}`);
  }

  return metadata;
}

export function listSupportedSymbols(): SymbolMetadata[] {
  return Object.values(symbols);
}
