import { getStrategies, postJson } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type { StrategySummary } from "../../src/shared/contracts";

export function StrategiesRoute() {
  const strategies = usePollingJson<StrategySummary[]>(getStrategies, []);

  return (
    <section className="glass-panel strategies-page">
      <div className="panel-header">
        <p className="panel-kicker">Spellbook</p>
      </div>
      <h2>Strategy library</h2>
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
            <div className="strategy-actions">
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
