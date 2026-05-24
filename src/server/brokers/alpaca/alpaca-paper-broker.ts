import type { NormalizedOrder, OrderIntent } from "../../domain/order";
import type { PositionSnapshot } from "../../domain/position";
import { AlpacaClient } from "./alpaca-client";

export interface AlpacaPaperBrokerConfig {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class AlpacaPaperBroker {
  readonly enabled: boolean;
  private readonly client?: AlpacaClient;

  constructor(private readonly config: AlpacaPaperBrokerConfig) {
    this.enabled = config.enabled;

    if (config.enabled) {
      if (!config.apiKey || !config.apiSecret) {
        throw new Error("Alpaca paper broker requires API credentials when enabled");
      }

      this.client = new AlpacaClient({
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        baseUrl: config.baseUrl,
        fetchImpl: config.fetchImpl,
      });
    }
  }

  static fromEnv(fetchImpl?: typeof fetch): AlpacaPaperBroker {
    return new AlpacaPaperBroker({
      enabled: process.env.HEXCHANGE_ENABLE_ALPACA_PAPER === "true",
      apiKey: process.env.ALPACA_API_KEY ?? "",
      apiSecret: process.env.ALPACA_API_SECRET ?? "",
      baseUrl: process.env.ALPACA_PAPER_BASE_URL ?? "https://paper-api.alpaca.markets",
      fetchImpl,
    });
  }

  async isHealthy(): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    const account = await this.client.getAccount();
    return account.status.toLowerCase() === "active";
  }

  async submitPaperOrder(intent: OrderIntent): Promise<NormalizedOrder> {
    if (!this.enabled || !this.client) {
      throw new Error("Alpaca paper broker is not enabled");
    }

    const order = await this.client.submitOrder({
      symbol: intent.symbol,
      side: intent.side,
      qty: String(intent.quantity),
      type: "market",
      time_in_force: "day",
    });

    return {
      ...intent,
      status: order.status === "accepted" || order.status === "new" ? "accepted" : "filled",
      averageFillPrice: order.filled_avg_price ? Number(order.filled_avg_price) : undefined,
    };
  }

  async getOrders(strategyId: string): Promise<NormalizedOrder[]> {
    if (!this.enabled || !this.client) {
      return [];
    }

    const orders = await this.client.getOrders();
    return orders.map((order, index) => ({
      id: order.id,
      strategyId,
      symbol: order.symbol,
      market: order.symbol.includes("/") ? "crypto" : "stock",
      side: order.side,
      quantity: Number(order.qty),
      submittedAt: new Date().toISOString(),
      rationale: "alpaca paper sync",
      status: order.status === "filled" ? "filled" : "accepted",
      averageFillPrice: order.filled_avg_price ? Number(order.filled_avg_price) : undefined,
    }));
  }

  async getPositions(): Promise<PositionSnapshot[]> {
    if (!this.enabled || !this.client) {
      return [];
    }

    const positions = await this.client.getPositions();
    return positions.map((position) => ({
      symbol: position.symbol,
      market: position.symbol.includes("/") ? "crypto" : "stock",
      quantity: Number(position.qty),
      averageEntryPrice: Number(position.avg_entry_price),
      markPrice: Number(position.current_price),
      unrealizedPnlUsd: Number(position.unrealized_pl),
      realizedPnlUsd: Number(position.unrealized_intraday_pl),
    }));
  }
}
