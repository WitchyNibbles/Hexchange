import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedOrder } from "../domain/order";
import type { PositionSnapshot } from "../domain/position";
import type { StrategyState } from "../domain/strategy";
import type { TradeLogEntry } from "../domain/trade-log";
import type { RiskSettings } from "../../shared/contracts";
import type { BacktestResult } from "../engine/types";

export interface RuntimeStateSnapshot {
  strategies: StrategyState[];
  orders: NormalizedOrder[];
  positions: PositionSnapshot[];
  trades: TradeLogEntry[];
  backtests: BacktestResult[];
  riskSettings: RiskSettings;
  killSwitch: {
    engaged: boolean;
    reason: string;
  };
}

export class RuntimeStateStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<RuntimeStateSnapshot | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as RuntimeStateSnapshot;
    } catch {
      return null;
    }
  }

  async save(snapshot: RuntimeStateSnapshot): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snapshot, null, 2), "utf8");
  }
}
