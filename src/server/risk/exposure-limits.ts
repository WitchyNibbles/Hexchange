import type { PositionSnapshot } from "../domain/position";

export interface ExposureLimits {
  maxPositionNotionalUsd: number;
  maxDailyLossPct: number;
}

export function calculateGrossExposure(positions: PositionSnapshot[]): number {
  return positions.reduce((total, position) => total + Math.abs(position.quantity * position.markPrice), 0);
}
