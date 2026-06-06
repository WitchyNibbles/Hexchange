import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getEngineStatus, getStrategies, postJson, postWalkForward } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type { EngineStatus, StrategySummary, WalkForwardResult } from "../../src/shared/contracts";
import { SkeletonPanel } from "../components/Skeleton";
import { WalkForwardPanel } from "../components/WalkForwardPanel";

const defaultEngineStatus: EngineStatus = {
  mode: "simulated",
  available: true,
  latestBacktests: [],
};

export function StrategiesRoute() {
  const { value: strategies, loading: strategiesLoading } = usePollingJson<StrategySummary[]>(getStrategies, []);
  const { value: engineStatus } = usePollingJson<EngineStatus>(getEngineStatus, defaultEngineStatus);
  const [wfResults, setWfResults] = useState<Record<string, WalkForwardResult | null>>({});
  const [wfLoading, setWfLoading] = useState<Record<string, boolean>>({});

  async function runWalkForward(strategyId: string) {
    setWfLoading((prev) => ({ ...prev, [strategyId]: true }));
    try {
      const result = await postWalkForward(strategyId);
      setWfResults((prev) => ({ ...prev, [strategyId]: result }));
    } finally {
      setWfLoading((prev) => ({ ...prev, [strategyId]: false }));
    }
  }

  return (
    <section className="glass-panel strategies-page">
      <div className="panel-header">
        <p className="panel-kicker">Spellbook</p>
      </div>
      <h2>Strategy library</h2>
      <div className="engine-callout">
        <span>Engine</span>
        <span className={`mode-pill mode-${engineStatus.mode}`}>{engineStatus.mode}</span>
        <span>{engineStatus.available ? "✦ ready" : "unavailable"}</span>
      </div>
      {strategiesLoading ? (
        <div className="strategy-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="strategy-card">
              <SkeletonPanel lines={4} titleHeight="1.1rem" />
            </div>
          ))}
        </div>
      ) : (
      <div className="strategy-list">
        {strategies.map((strategy, i) => (
          <motion.article
            className="strategy-card"
            key={strategy.id}
            initial={{ opacity: 0, scale: 0.93, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22, delay: i * 0.07 }}
            whileHover={{ y: -3, scale: 1.003 }}
          >
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
                  ? `${strategy.lastBacktest.feeAdjustedReturnPct.toFixed(2)}% return · ${strategy.lastBacktest.maxDrawdownPct.toFixed(2)}% drawdown · ${strategy.lastBacktest.trades} trades`
                  : "No backtest recorded yet."}
              </p>
            </div>
            <AnimatePresence>
              {(wfLoading[strategy.id] || wfResults[strategy.id]) && (
                <WalkForwardPanel
                  result={wfResults[strategy.id] ?? null}
                  loading={wfLoading[strategy.id] ?? false}
                />
              )}
            </AnimatePresence>

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
                className="secondary"
                disabled={wfLoading[strategy.id]}
                onClick={() => void runWalkForward(strategy.id)}
              >
                {wfLoading[strategy.id] ? "Validating…" : "Validate windows"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void postJson(`/api/strategies/${strategy.id}/paper-session`);
                }}
                disabled={strategy.paperSessionActive}
              >
                Start paper
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void postJson(`/api/strategies/${strategy.id}/stop-session`);
                }}
                disabled={!strategy.paperSessionActive}
              >
                Stop session
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
          </motion.article>
        ))}
        {strategies.length === 0 && (
          <p className="panel-copy">No strategies found in the spellbook yet.</p>
        )}
      </div>
      )}
    </section>
  );
}
