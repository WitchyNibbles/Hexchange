export interface PositionSnapshot {
  symbol: string;
  market: "stock" | "crypto";
  quantity: number;
  averageEntryPrice: number;
  markPrice: number;
  unrealizedPnlUsd: number;
  realizedPnlUsd: number;
}
