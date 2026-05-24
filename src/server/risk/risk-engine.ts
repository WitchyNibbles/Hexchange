import type { OrderIntent } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type { MarketDataService } from "../market/market-data-service";
import { calculateGrossExposure, type ExposureLimits } from "./exposure-limits";
import type { KillSwitch } from "./kill-switch";

export interface RiskCheckResult {
  approved: boolean;
  reason: string;
}

export class RiskEngine {
  constructor(
    private readonly limits: ExposureLimits,
    private readonly killSwitch: KillSwitch,
    private readonly marketDataService: MarketDataService,
  ) {}

  evaluateOrder(intent: OrderIntent, positions: PositionSnapshot[], dailyDrawdownPct: number): RiskCheckResult {
    const killState = this.killSwitch.getState();
    if (killState.engaged) {
      return {
        approved: false,
        reason: `kill switch engaged: ${killState.reason}`,
      };
    }

    if (!this.marketDataService.isFresh(intent.symbol)) {
      return {
        approved: false,
        reason: "market data is stale",
      };
    }

    const grossExposure = calculateGrossExposure(positions);
    const nextExposure =
      grossExposure + Math.abs(intent.quantity * (intent.limitPrice ?? this.marketDataService.getLatestPrice(intent.symbol)));
    if (nextExposure > this.limits.maxPositionNotionalUsd) {
      return {
        approved: false,
        reason: "gross exposure would exceed the configured cap",
      };
    }

    if (dailyDrawdownPct >= this.limits.maxDailyLossPct) {
      return {
        approved: false,
        reason: "daily drawdown limit has been breached",
      };
    }

    return {
      approved: true,
      reason: "approved",
    };
  }
}
