export type OrderSide = "buy" | "sell";
export type OrderStatus = "pending" | "accepted" | "filled" | "rejected" | "cancelled";

export interface OrderIntent {
  id: string;
  strategyId: string;
  symbol: string;
  market: "stock" | "crypto";
  side: OrderSide;
  quantity: number;
  limitPrice?: number;
  submittedAt: string;
  rationale: string;
}

export interface NormalizedOrder extends OrderIntent {
  status: OrderStatus;
  averageFillPrice?: number;
  rejectedReason?: string;
}
