export interface SlippageEstimate {
  fillPrice: number;
  slippageBps: number;
}

export interface SlippageParams {
  midPrice: number;
  quantity: number;
  market: "stock" | "crypto";
  adv: number;
}

const HALF_SPREAD_BPS: Record<"stock" | "crypto", number> = {
  stock: 3,
  crypto: 8,
};

const MARKET_IMPACT_COEFFICIENT: Record<"stock" | "crypto", number> = {
  stock: 0.1,
  crypto: 0.2,
};

export function estimateSlippage(params: SlippageParams): SlippageEstimate {
  const { midPrice, quantity, market, adv } = params;

  const halfSpreadBps = HALF_SPREAD_BPS[market];

  const participationRate = adv > 0 ? quantity / adv : 0;
  const impactBps = MARKET_IMPACT_COEFFICIENT[market] * Math.sqrt(participationRate) * 10_000;

  const totalSlippageBps = halfSpreadBps + impactBps;

  const fillPrice = Number((midPrice * (1 + totalSlippageBps / 10_000)).toFixed(2));

  return { fillPrice, slippageBps: Number(totalSlippageBps.toFixed(1)) };
}

export function computeAverageSlippageBps(trades: { slippageBps?: number }[]): number {
  const withSlippage = trades.filter((t) => typeof t.slippageBps === "number" && t.slippageBps >= 0);
  if (withSlippage.length === 0) return 0;
  const total = withSlippage.reduce((sum, t) => sum + (t.slippageBps ?? 0), 0);
  return Number((total / withSlippage.length).toFixed(1));
}
