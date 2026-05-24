import type { OrderIntent } from "../domain/order";
import type { SignalExplanation } from "../domain/strategy";

export function buildSignalNarrative(strategyName: string, signal: SignalExplanation): string {
  return `${strategyName}: ${signal.summary} Confidence ${(signal.confidence * 100).toFixed(0)}%, expected edge ${signal.expectedEdgeBps} bps.`;
}

export function buildOrderNarrative(order: OrderIntent): string {
  return `${order.side.toUpperCase()} ${order.quantity} ${order.symbol} because ${order.rationale}.`;
}
