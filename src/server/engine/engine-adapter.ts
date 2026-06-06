import type { MarketDataService } from "../market/market-data-service";
import type { EngineAdapter } from "./types";
import { LeanAdapter } from "./lean-adapter";

export function createEngineAdapter(marketData?: MarketDataService): EngineAdapter {
  return new LeanAdapter(marketData);
}
