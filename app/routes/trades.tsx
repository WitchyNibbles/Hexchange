import { useEffect, useState } from "react";
import {
  getEngineStatus,
  getLiveReadinessReport,
  getPortfolio,
  getRiskSettings,
  getSystemStatus,
  getTrades,
  getValidationCampaignSummary,
  patchJson,
  postJson,
} from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type {
  EngineStatus,
  LiveReadinessReport,
  PortfolioSnapshot,
  RiskSettings,
  SystemStatus,
  TradeSummary,
  ValidationCampaignSummary,
} from "../../src/shared/contracts";

const emptyPortfolio: PortfolioSnapshot = {
  positions: [],
  openOrders: [],
};

const defaultRiskSettings: RiskSettings = {
  maxPositionNotionalUsd: 100000,
  maxDailyLossPct: 8,
  liveRolloutCapUsd: 500,
};

const defaultSystemStatus: SystemStatus = {
  mode: "research",
  currentActivity: "Loading status...",
  totalProfitUsd: 0,
  totalProfitPct: 0,
  dailyDrawdownPct: 0,
  grossExposureUsd: 0,
  activeWarnings: [],
  paperStrategies: 0,
  liveStrategies: 0,
  killSwitchEngaged: false,
  dataFreshness: "fresh",
};

const defaultEngineStatus: EngineStatus = {
  mode: "simulated",
  available: true,
  runtimeHealth: "offline",
  runtimeDetails: "Running in simulated mode.",
  venues: [],
  latestBacktests: [],
};

const defaultLiveReadiness: LiveReadinessReport = {
  updatedAt: "",
  overallStatus: "blocked",
  summary: "Live readiness has not loaded yet.",
  checks: [],
  strategies: [],
};

const defaultValidationCampaign: ValidationCampaignSummary = {
  observedHoursTarget: 24,
  completedCyclesTarget: 10,
  observedHours: 0,
  completedCycles: 0,
  firstObservedCycleAt: null,
  lastCompletedCycleAt: null,
  readyCryptoStrategies: 0,
  unresolvedCryptoEvidenceChecks: 0,
  campaignReady: false,
};

export function TradesRoute() {
  const trades = usePollingJson<TradeSummary[]>(getTrades, []);
  const portfolio = usePollingJson<PortfolioSnapshot>(getPortfolio, emptyPortfolio);
  const riskSettings = usePollingJson<RiskSettings>(getRiskSettings, defaultRiskSettings);
  const status = usePollingJson<SystemStatus>(getSystemStatus, defaultSystemStatus);
  const engineStatus = usePollingJson<EngineStatus>(getEngineStatus, defaultEngineStatus);
  const liveReadiness = usePollingJson<LiveReadinessReport>(getLiveReadinessReport, defaultLiveReadiness);
  const validationCampaign = usePollingJson<ValidationCampaignSummary>(
    getValidationCampaignSummary,
    defaultValidationCampaign,
  );
  const [draftSettings, setDraftSettings] = useState<RiskSettings>(defaultRiskSettings);

  useEffect(() => {
    setDraftSettings(riskSettings);
  }, [riskSettings]);

  return (
    <div className="page-grid">
      <section className="glass-panel trades-page">
        <div className="panel-header">
          <p className="panel-kicker">Ledger</p>
        </div>
        <h2>Trade attribution</h2>
        <div className="trade-table">
          {trades.map((trade) => (
            <article key={trade.id} className="trade-row">
              <div>
                <strong>{trade.symbol}</strong>
                <p>{trade.explanation}</p>
                <p>
                  {[trade.venue, trade.executionMode, trade.runtimeSource].filter(Boolean).join(" · ")}
                  {trade.sessionId ? ` · session ${trade.sessionId}` : ""}
                </p>
              </div>
              <div>
                <span>{trade.side}</span>
                <strong>${trade.realizedPnlUsd.toFixed(2)}</strong>
              </div>
            </article>
          ))}
          {trades.length === 0 ? <p>No trades recorded yet.</p> : null}
        </div>
      </section>
      <section className="glass-panel portfolio-page">
        <div className="panel-header">
          <p className="panel-kicker">Ward Circle</p>
        </div>
        <h3>Positions and controls</h3>
        <ul className="position-list">
          {portfolio.positions.map((position) => (
            <li key={position.symbol}>
              <span>{position.symbol}</span>
              <strong>${position.unrealizedPnlUsd.toFixed(2)}</strong>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="danger"
          onClick={() => {
            void postJson("/api/control/kill-switch", {
              reason: "Operator manually halted all trading.",
            });
          }}
        >
          Engage kill switch
        </button>
      </section>
      <section className="glass-panel control-center-panel">
        <div className="panel-header">
          <p className="panel-kicker">Control Center</p>
        </div>
        <h3>Risk settings and safeguards</h3>
        <p className="panel-copy">
          Tune the notional cap, drawdown ceiling, and live rollout size locally. Every change is persisted
          so the observatory comes back exactly how you left it.
        </p>
        <div className="metric-stack">
          <div>
            <span>Max notional</span>
            <strong>${riskSettings.maxPositionNotionalUsd.toFixed(0)}</strong>
          </div>
          <div>
            <span>Daily loss threshold</span>
            <strong>{riskSettings.maxDailyLossPct.toFixed(2)}%</strong>
          </div>
          <div>
            <span>Live rollout cap</span>
            <strong>${riskSettings.liveRolloutCapUsd.toFixed(0)}</strong>
          </div>
          <div>
            <span>Kill switch</span>
            <strong>{status.killSwitchEngaged ? "engaged" : "ready"}</strong>
          </div>
        </div>
        <div className="validation-report">
          <strong>Engine venue posture</strong>
          <p>
            {engineStatus.mode} runtime is {engineStatus.runtimeHealth}.
          </p>
          <p>{engineStatus.runtimeDetails ?? "No runtime details available."}</p>
          <ul className="strategy-stats">
            {engineStatus.venues.map((venue) => (
              <li key={venue.venue}>
                {venue.venue.replaceAll("_", " ")} · {venue.scope} · {venue.connected ? "connected" : "offline"}
                {venue.details ? ` · ${venue.details}` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="validation-report">
          <strong>Live readiness ritual</strong>
          <p>
            {liveReadiness.overallStatus} · {liveReadiness.summary}
          </p>
          <ul className="strategy-stats">
            {liveReadiness.checks.map((check) => (
              <li key={check.id}>
                {check.label} · {check.status} · {check.summary}
              </li>
            ))}
          </ul>
          <ul className="strategy-stats">
            {liveReadiness.strategies.map((strategy) => (
              <li key={strategy.strategyId}>
                {strategy.name} ·{" "}
                {strategy.deploymentMode === "simulation_only" ? "simulation only" : strategy.ready ? "ready" : "blocked"} ·{" "}
                {strategy.blockers[0] ?? "Ready for guarded live rollout."}
              </li>
            ))}
          </ul>
        </div>
        <div className="validation-report">
          <strong>Validation campaign</strong>
          <p>
            {validationCampaign.observedHours.toFixed(1)}/{validationCampaign.observedHoursTarget} observed hours ·{" "}
            {validationCampaign.completedCycles}/{validationCampaign.completedCyclesTarget} completed cycles
          </p>
          <p>
            First observed cycle {validationCampaign.firstObservedCycleAt ?? "not started"} · last completed cycle{" "}
            {validationCampaign.lastCompletedCycleAt ?? "none yet"}
          </p>
          <p>
            {validationCampaign.readyCryptoStrategies} crypto strategies ready ·{" "}
            {validationCampaign.unresolvedCryptoEvidenceChecks} evidence checks unresolved ·{" "}
            {validationCampaign.campaignReady ? "target reached" : "campaign still running"}
          </p>
        </div>
        <div className="settings-form">
          <label>
            <span>Max notional (USD)</span>
            <input
              type="number"
              value={draftSettings.maxPositionNotionalUsd}
              onChange={(event) => {
                setDraftSettings((current) => ({
                  ...current,
                  maxPositionNotionalUsd: Number(event.target.value),
                }));
              }}
            />
          </label>
          <label>
            <span>Daily loss threshold (%)</span>
            <input
              type="number"
              step="0.25"
              value={draftSettings.maxDailyLossPct}
              onChange={(event) => {
                setDraftSettings((current) => ({
                  ...current,
                  maxDailyLossPct: Number(event.target.value),
                }));
              }}
            />
          </label>
          <label>
            <span>Live rollout cap (USD)</span>
            <input
              type="number"
              value={draftSettings.liveRolloutCapUsd}
              onChange={(event) => {
                setDraftSettings((current) => ({
                  ...current,
                  liveRolloutCapUsd: Number(event.target.value),
                }));
              }}
            />
          </label>
        </div>
        <div className="strategy-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void patchJson("/api/control/settings", {
                maxPositionNotionalUsd: draftSettings.maxPositionNotionalUsd,
                maxDailyLossPct: draftSettings.maxDailyLossPct,
                liveRolloutCapUsd: draftSettings.liveRolloutCapUsd,
              });
            }}
          >
            Save settings
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void postJson("/api/control/kill-switch/reset");
            }}
          >
            Reset kill switch
          </button>
        </div>
      </section>
    </div>
  );
}
