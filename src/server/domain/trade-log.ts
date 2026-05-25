import type { OrderSide } from "./order";

export interface TradeLogEntry {
  id: string;
  strategyId: string;
  symbol: string;
  market: "stock" | "crypto";
  venue?: "simulation" | "kraken" | "interactive_brokers" | "alpaca" | null;
  executionMode?: "simulation" | "paper" | "live" | null;
  runtimeSource?: "hexchange_local" | "nautilus_trader" | "alpaca_paper" | "synthetic" | null;
  sessionId?: string | null;
  side: OrderSide;
  quantity: number;
  price: number;
  feeUsd: number;
  realizedPnlUsd: number;
  expectedEdgeBps: number;
  explanation: string;
  createdAt: string;
}

export interface EventLogRecord {
  id: string;
  kind:
    | "signal"
    | "paper_session"
    | "order"
    | "fill"
    | "risk"
    | "live_arm"
    | "kill_switch"
    | "system";
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
}
