import { motion } from "framer-motion";
import { getEvents, getSystemStatus, getTrades } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import { usePollingPulse } from "../lib/use-polling-pulse";
import { AnimatedNumber } from "../components/AnimatedNumber";
import type { EventSummary, SystemStatus, TradeSummary } from "../../src/shared/contracts";
import { ObservatoryPanel } from "../components/observatory-panel";
import { FamiliarStatus } from "../components/familiar-status";
import { RitualLog } from "../components/ritual-log";
import { PnlChart } from "../components/PnlChart";

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

const panelVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, delay: i * 0.07, ease: "easeOut" as const },
  }),
};

export function DashboardRoute() {
  const { value: status, isPulsing: statusFresh } = usePollingPulse(getSystemStatus, initialStatus);
  const events = usePollingJson<EventSummary[]>(getEvents, []);
  const trades = usePollingJson<TradeSummary[]>(getTrades, []);

  const pnlPositive = status.totalProfitUsd >= 0;

  return (
    <div className="page-grid">
      <motion.section
        className={`glass-panel dashboard-chart-row${statusFresh ? " is-fresh" : ""}`}
        custom={0}
        initial="hidden"
        animate="visible"
        variants={panelVariants}
      >
        <div className="panel-header">
          <p className="panel-kicker">Cumulative P&L</p>
          <span className={`mode-pill mode-${status.mode}`}>{status.mode}</span>
        </div>
        <h2 className={pnlPositive ? "stat-profit" : "stat-loss"} style={{ margin: "0 0 0.1rem" }}>
          {pnlPositive ? "+" : ""}$<AnimatedNumber value={status.totalProfitUsd} />
        </h2>
        <PnlChart trades={trades} />
      </motion.section>

      {/* Left column: Observatory + Profit Lens stacked */}
      <div className="dashboard-column">
        <motion.div custom={1} initial="hidden" animate="visible" variants={panelVariants}>
          <ObservatoryPanel status={status} trades={trades} isFresh={statusFresh} />
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={panelVariants}>
          <section className={`glass-panel metric-panel${statusFresh ? " is-fresh" : ""}`}>
            <div className="panel-header">
              <p className="panel-kicker">Profit Lens</p>
            </div>
            <h3>How profit is forming</h3>
            <p>
              Realized trades, current exposure, and promotion evidence side by side so gains are
              never detached from risk.
            </p>
            <div className="metric-stack">
              <div>
                <span>Realized trades</span>
                <strong><AnimatedNumber value={trades.length} format={(n) => String(Math.round(n))} /></strong>
              </div>
              <div className={status.totalProfitPct >= 0 ? "stat-profit" : "stat-loss"}>
                <span>Profit percent</span>
                <strong>
                  {status.totalProfitPct >= 0 ? "+" : ""}
                  <AnimatedNumber value={status.totalProfitPct} />%
                </strong>
              </div>
              <div>
                <span>Active paper</span>
                <strong><AnimatedNumber value={status.paperStrategies} format={(n) => String(Math.round(n))} /></strong>
              </div>
              <div>
                <span>Active live</span>
                <strong><AnimatedNumber value={status.liveStrategies} format={(n) => String(Math.round(n))} /></strong>
              </div>
            </div>
          </section>
        </motion.div>
      </div>

      {/* Right column: Familiar + Ritual Log always adjacent */}
      <div className="dashboard-column">
        <motion.div custom={3} initial="hidden" animate="visible" variants={panelVariants}>
          <FamiliarStatus status={status} />
        </motion.div>
        <motion.div custom={4} initial="hidden" animate="visible" variants={panelVariants}>
          <RitualLog events={events} />
        </motion.div>
      </div>
    </div>
  );
}
