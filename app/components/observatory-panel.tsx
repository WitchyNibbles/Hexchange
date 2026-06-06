import { AnimatePresence, motion } from "framer-motion";
import { BatSvg } from "./decorations/BatSvg";
import { AnimatedNumber } from "./AnimatedNumber";
import type { SystemStatus, TradeSummary } from "../../src/shared/contracts";

interface ObservatoryPanelProps {
  status: SystemStatus;
  trades: TradeSummary[];
  isFresh?: boolean;
}

export function ObservatoryPanel({ status, trades, isFresh }: ObservatoryPanelProps) {
  const recentTrade = trades[0];

  return (
    <section className="glass-panel observatory-panel" style={{ position: "relative" }}>
      <AnimatePresence>
        {isFresh && (
          <motion.div
            key="fresh-ripple"
            initial={{ opacity: 0.55, scale: 0.9 }}
            animate={{ opacity: 0, scale: 1.06 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.72, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              border: "1.5px solid rgba(76, 201, 240, 0.55)",
              pointerEvents: "none",
              zIndex: 0,
            }}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <div className="panel-header">
        <p className="panel-kicker">Observatory</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BatSvg size={26} className="bat-decoration" />
          <span className={`mode-pill mode-${status.mode}`}>
            <AnimatePresence mode="wait">
              <motion.span
                key={status.mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {status.mode}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </div>
      <h2>Local trading familiar</h2>
      <p className="panel-copy">{status.currentActivity}</p>
      <motion.div
        className="stat-grid"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.1 }}
      >
        <div className={status.totalProfitUsd >= 0 ? "stat-profit" : "stat-loss"}>
          <span>Total profit</span>
          <strong>$<AnimatedNumber value={status.totalProfitUsd} /></strong>
        </div>
        <div>
          <span>Gross exposure</span>
          <strong>$<AnimatedNumber value={status.grossExposureUsd} /></strong>
        </div>
        <div className={status.dailyDrawdownPct > 3 ? "stat-loss" : ""}>
          <span>Daily drawdown</span>
          <strong><AnimatedNumber value={status.dailyDrawdownPct} />%</strong>
        </div>
        <div>
          <span>Paper / live</span>
          <strong>
            <AnimatedNumber value={status.paperStrategies} format={(n) => String(Math.round(n))} />
            {" / "}
            <AnimatedNumber value={status.liveStrategies} format={(n) => String(Math.round(n))} />
          </strong>
        </div>
      </motion.div>
      <div className="observatory-callout">
        <span>Latest ritual</span>
        <strong>
          {recentTrade
            ? `${recentTrade.symbol} ${recentTrade.side} @ $${recentTrade.price.toFixed(2)}`
            : "No trades yet"}
        </strong>
      </div>
    </section>
  );
}
