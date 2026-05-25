import { getEvents, getStrategies, getSystemStatus, getTrades } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type { EventSummary, StrategySummary, SystemStatus, TradeSummary } from "../../src/shared/contracts";
import { ObservatoryPanel } from "../components/observatory-panel";
import { FamiliarStatus } from "../components/familiar-status";
import { RitualLog } from "../components/ritual-log";

const initialStatus: SystemStatus = {
  mode: "research",
  currentActivity: "Loading observatory state...",
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

export function DashboardRoute() {
  const status = usePollingJson(getSystemStatus, initialStatus);
  const events = usePollingJson<EventSummary[]>(getEvents, []);
  const trades = usePollingJson<TradeSummary[]>(getTrades, []);
  const strategies = usePollingJson<StrategySummary[]>(getStrategies, []);
  const paperCycles = strategies.reduce((sum, strategy) => sum + strategy.paperValidationStats.cycles, 0);
  const completedPaperCycles = strategies.reduce(
    (sum, strategy) => sum + strategy.paperValidationStats.completedCycles,
    0,
  );
  const cumulativePaperPnl = strategies.reduce(
    (sum, strategy) => sum + strategy.paperValidationStats.cumulativeRealizedPnlUsd,
    0,
  );
  const completedStrategies = strategies.filter((strategy) => strategy.paperValidationStats.completedCycles > 0);
  const averageWinRate =
    completedStrategies.length > 0
      ? completedStrategies.reduce((sum, strategy) => sum + strategy.paperValidationStats.winRatePct, 0) /
        completedStrategies.length
      : 0;

  return (
    <div className="page-grid">
      <ObservatoryPanel status={status} trades={trades} />
      <FamiliarStatus status={status} />
      <section className="glass-panel metric-panel">
        <div className="panel-header">
          <p className="panel-kicker">Profit Lens</p>
        </div>
        <h3>How profit is forming</h3>
        <p>
          Hexchange shows realized trades, current exposure, and promotion-stage evidence side by side so
          gains are never detached from risk.
        </p>
        <div className="metric-stack">
          <div>
            <span>Realized trades</span>
            <strong>{trades.length}</strong>
          </div>
          <div>
            <span>Profit percent</span>
            <strong>{status.totalProfitPct.toFixed(2)}%</strong>
          </div>
        </div>
        <div className="validation-report">
          <strong>Paper record</strong>
          <p>
            {completedPaperCycles} completed cycles · {averageWinRate.toFixed(2)}% win rate · $
            {cumulativePaperPnl.toFixed(2)} cumulative pnl
          </p>
          <p>{paperCycles} total paper cycles are now preserved as promotion evidence.</p>
        </div>
      </section>
      <RitualLog events={events} />
    </div>
  );
}
