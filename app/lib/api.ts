import type {
  EventSummary,
  EngineStatus,
  LiveReadinessReport,
  PortfolioSnapshot,
  RiskSettings,
  StrategySummary,
  SystemStatus,
  TradeSummary,
  ValidationCampaignSummary,
} from "../../src/shared/contracts";

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

export function getEngineStatus(): Promise<EngineStatus> {
  return fetchJson("/api/engine/status");
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

export function getRiskSettings(): Promise<RiskSettings> {
  return fetchJson("/api/control/settings");
}

export function getLiveReadinessReport(): Promise<LiveReadinessReport> {
  return fetchJson("/api/control/live-readiness");
}

export function getValidationCampaignSummary(): Promise<ValidationCampaignSummary> {
  return fetchJson("/api/control/validation-campaign");
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

export async function patchJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}
