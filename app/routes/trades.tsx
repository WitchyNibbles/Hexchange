import { getPortfolio, getTrades, postJson } from "../lib/api";
import { usePollingJson } from "../lib/use-polling-json";
import type { PortfolioSnapshot, TradeSummary } from "../../src/shared/contracts";

const emptyPortfolio: PortfolioSnapshot = {
  positions: [],
  openOrders: [],
};

export function TradesRoute() {
  const trades = usePollingJson<TradeSummary[]>(getTrades, []);
  const portfolio = usePollingJson<PortfolioSnapshot>(getPortfolio, emptyPortfolio);

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
    </div>
  );
}
