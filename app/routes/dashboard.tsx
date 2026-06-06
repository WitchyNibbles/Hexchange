import { useEffect } from "react";
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
import { SkeletonPanel } from "../components/Skeleton";
import { toast } from "../lib/toast";

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
    transition: { type: "spring" as const, stiffness: 280, damping: 22, delay: i * 0.07 },
  }),
};

export function DashboardRoute() {
  useEffect(() => { toast.show("Observatory online.", "info"); }, []);

  const { value: status, isPulsing: statusFresh, loading: statusLoading } = usePollingPulse(getSystemStatus, initialStatus);
  const { value: events, loading: eventsLoading } = usePollingJson<EventSummary[]>(getEvents, []);
  const { value: trades, loading: tradesLoading } = usePollingJson<TradeSummary[]>(getTrades, []);

  const pnlPositive = status.totalProfitUsd >= 0;

  return (
    <div className="page-grid">
      <motion.section
        className={`glass-panel panel-hero dashboard-chart-row${statusFresh ? " is-fresh" : ""}`}
        custom={0}
        initial="hidden"
        animate="visible"
        variants={panelVariants}
      >
        <div className="panel-header">
          <p className="panel-kicker">Cumulative P&amp;L</p>
        </div>
        {statusLoading ? (
          <SkeletonPanel heroHeight="3.5rem" lines={2} titleHeight="0.75rem" />
        ) : (
          <>
            <div className={`hero-stat ${pnlPositive ? "stat-profit" : "stat-loss"}`}>
              {pnlPositive ? "+" : ""}$<AnimatedNumber value={status.totalProfitUsd} />
            </div>
            <PnlChart trades={trades} />
          </>
        )}
      </motion.section>

      {/* Left column: Observatory + Profit Lens stacked */}
      <div className="dashboard-column">
        <motion.div custom={1} initial="hidden" animate="visible" variants={panelVariants} whileHover={{ y: -3, scale: 1.003 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
          <ObservatoryPanel status={status} trades={trades} isFresh={statusFresh} />
        </motion.div>
        <motion.div custom={2} initial="hidden" animate="visible" variants={panelVariants} whileHover={{ y: -3, scale: 1.003 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
          <section className={`glass-panel metric-panel${statusFresh ? " is-fresh" : ""}`}>
            <div className="panel-header">
              <p className="panel-kicker">Profit Lens</p>
            </div>
            {tradesLoading ? (
              <SkeletonPanel lines={4} />
            ) : (
              <>
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
              </>
            )}
          </section>
        </motion.div>
      </div>

      {/* Right column: Familiar + Ritual Log always adjacent */}
      <div className="dashboard-column">
        <motion.div custom={3} initial="hidden" animate="visible" variants={panelVariants} whileHover={{ y: -3, scale: 1.003 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
          <FamiliarStatus status={status} />
        </motion.div>
        <motion.div custom={4} initial="hidden" animate="visible" variants={panelVariants} whileHover={{ y: -3, scale: 1.003 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
          {eventsLoading ? (
            <section className="glass-panel">
              <div className="panel-header"><p className="panel-kicker">Ritual Log</p></div>
              <SkeletonPanel lines={5} />
            </section>
          ) : (
            <RitualLog events={events} />
          )}
        </motion.div>
      </div>
    </div>
  );
}
