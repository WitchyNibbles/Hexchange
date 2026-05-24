import { getEngineStatus, getStrategies, postJson } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type { EngineStatus, StrategySummary } from "../../src/shared/contracts";

const defaultEngineStatus: EngineStatus = {
  mode: "simulated",
  available: true,
  runtimeHealth: "offline",
  venues: [],
  latestBacktests: [],
};

export function StrategiesRoute() {
  const strategies = usePollingJson<StrategySummary[]>(getStrategies, []);
  const engineStatus = usePollingJson<EngineStatus>(getEngineStatus, defaultEngineStatus);

  return (
    <section className="glass-panel strategies-page">
      <div className="panel-header">
        <p className="panel-kicker">Spellbook</p>
      </div>
      <h2>Strategy library</h2>
      <div className="engine-callout">
        <span>Engine mode</span>
        <strong>{engineStatus.mode}</strong>
        <p>{engineStatus.available ? "Backtest engine ready." : "Backtest engine unavailable."}</p>
        <span>Runtime health</span>
        <strong>{engineStatus.runtimeHealth}</strong>
        <ul className="strategy-stats">
          {engineStatus.venues.map((venue) => (
            <li key={venue.venue}>
              {venue.venue.replaceAll("_", " ")} · {venue.scope} · {venue.connected ? "connected" : "offline"}
            </li>
          ))}
        </ul>
      </div>
      <div className="strategy-list">
        {strategies.map((strategy) => (
          <article className="strategy-card" key={strategy.id}>
            <div className="strategy-heading">
              <div>
                <h3>{strategy.name}</h3>
                <p>
                  {strategy.symbol} · {strategy.market}
                </p>
              </div>
              <span className={`mode-pill mode-${strategy.stage}`}>{strategy.stage}</span>
            </div>
            <p>{strategy.signal?.summary ?? "No active signal yet."}</p>
            <ul className="strategy-stats">
              <li>Fee-adjusted return: {strategy.validation.feeAdjustedReturnPct.toFixed(2)}%</li>
              <li>Drawdown: {strategy.validation.maxDrawdownPct.toFixed(2)}%</li>
              <li>Paper drift: {strategy.validation.paperDriftPct.toFixed(2)}%</li>
            </ul>
            <div className="validation-report">
              <strong>Promotion gate</strong>
              <p>{strategy.validationReport.join(" ")}</p>
            </div>
            <div className="validation-report">
              <strong>Last backtest</strong>
              <p>
                {strategy.lastBacktest
                  ? `${strategy.lastBacktest.feeAdjustedReturnPct.toFixed(2)}% return, ${strategy.lastBacktest.maxDrawdownPct.toFixed(2)}% drawdown, ${strategy.lastBacktest.trades} trades.`
                  : "No backtest has been recorded yet."}
              </p>
            </div>
            <div className="strategy-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void postJson(`/api/strategies/${strategy.id}/backtest`);
                }}
              >
                Run backtest
              </button>
              <button
                type="button"
                onClick={() => {
                  void postJson(`/api/strategies/${strategy.id}/paper-session`);
                }}
              >
                Start paper
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void postJson(`/api/strategies/${strategy.id}/arm-live`);
                }}
                disabled={!strategy.liveEligible}
              >
                Arm live
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
