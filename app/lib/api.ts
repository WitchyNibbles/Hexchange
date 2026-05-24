import type { EventSummary, PortfolioSnapshot, StrategySummary, SystemStatus, TradeSummary } from "../../src/shared/contracts";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}

export function getSystemStatus(): Promise<SystemStatus> {
  return fetchJson("/api/system/status");
}

export function getStrategies(): Promise<StrategySummary[]> {
  return fetchJson("/api/strategies");
}

export function getTrades(): Promise<TradeSummary[]> {
  return fetchJson("/api/trades");
}

export function getEvents(): Promise<EventSummary[]> {
  return fetchJson("/api/events");
}

export function getPortfolio(): Promise<PortfolioSnapshot> {
  return fetchJson("/api/system/portfolio");
}

export async function postJson<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}
