import { BatSvg } from "./decorations/BatSvg";
import type { SystemStatus, TradeSummary } from "../../src/shared/contracts";

interface ObservatoryPanelProps {
  status: SystemStatus;
  trades: TradeSummary[];
}

export function ObservatoryPanel({ status, trades }: ObservatoryPanelProps) {
  const recentTrade = trades[0];

  return (
    <section className="glass-panel observatory-panel">
      <div className="panel-header">
        <p className="panel-kicker">Observatory</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BatSvg size={26} className="bat-decoration" />
          <span className={`mode-pill mode-${status.mode}`}>{status.mode}</span>
        </div>
      </div>
      <h2>Local trading familiar</h2>
      <p className="panel-copy">{status.currentActivity}</p>
      <div className="stat-grid">
        <div className={status.totalProfitUsd >= 0 ? "stat-profit" : "stat-loss"}>
          <span>Total profit</span>
          <strong>${status.totalProfitUsd.toFixed(2)}</strong>
        </div>
        <div>
          <span>Gross exposure</span>
          <strong>${status.grossExposureUsd.toFixed(2)}</strong>
        </div>
        <div className={status.dailyDrawdownPct > 3 ? "stat-loss" : ""}>
          <span>Daily drawdown</span>
          <strong>{status.dailyDrawdownPct.toFixed(2)}%</strong>
        </div>
        <div>
          <span>Paper / live</span>
          <strong>
            {status.paperStrategies} / {status.liveStrategies}
          </strong>
        </div>
      </div>
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
