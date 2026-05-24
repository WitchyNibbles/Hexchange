export interface AlpacaAccount {
  id: string;
  status: string;
  equity: string;
}

export interface AlpacaOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  type: "market";
  time_in_force: "day";
}

export interface AlpacaOrderResponse {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  status: string;
  filled_avg_price?: string;
}

export interface AlpacaPositionResponse {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_intraday_pl: string;
}

export interface AlpacaClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class AlpacaClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: AlpacaClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "APCA-API-KEY-ID": this.config.apiKey,
        "APCA-API-SECRET-KEY": this.config.apiSecret,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Alpaca request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }

  getAccount(): Promise<AlpacaAccount> {
    return this.request("/v2/account");
  }

  submitOrder(order: AlpacaOrderRequest): Promise<AlpacaOrderResponse> {
    return this.request("/v2/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  getOrders(status = "all"): Promise<AlpacaOrderResponse[]> {
    return this.request(`/v2/orders?status=${status}`);
  }

  getPositions(): Promise<AlpacaPositionResponse[]> {
    return this.request("/v2/positions");
  }
}
