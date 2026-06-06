import { motion } from "framer-motion";
import { WalkForwardHistogram } from "./WalkForwardHistogram";
import { SkeletonPanel } from "./Skeleton";
import type { WalkForwardResult } from "../../src/shared/contracts";

interface Props {
  result: WalkForwardResult | null;
  loading: boolean;
}

const VERDICT_LABELS: Record<WalkForwardResult["verdict"], string> = {
  robust: "ROBUST",
  regime_dependent: "REGIME-DEPENDENT",
  weak: "WEAK",
};

const VERDICT_CLASS: Record<WalkForwardResult["verdict"], string> = {
  robust: "wf-verdict-robust",
  regime_dependent: "wf-verdict-regime",
  weak: "wf-verdict-weak",
};

const VERDICT_COPY: Record<WalkForwardResult["verdict"], string> = {
  robust: "Most out-of-sample windows were profitable. Strong case for paper promotion.",
  regime_dependent: "Performance is mixed across market conditions. Consider more data before promoting.",
  weak: "Fewer than half of OOS windows were profitable. Strategy may be curve-fitted.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export function WalkForwardPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="wf-panel">
        <p className="panel-kicker">Walk-Forward Validation</p>
        <SkeletonPanel lines={4} titleHeight="0.85rem" />
      </div>
    );
  }

  if (!result) return null;

  const oosWindows = result.windows.filter((w) => w.outOfSampleReturnPct !== null);

  return (
    <motion.div
      className="wf-panel"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      <div className="wf-header">
        <p className="panel-kicker">Walk-Forward Validation</p>
        <div className="wf-header-stats">
          <span className="wf-stat">
            <span className="wf-stat-label">Windows</span>
            <strong>{result.windowCount}</strong>
          </span>
          <span className="wf-stat">
            <span className="wf-stat-label">Robustness</span>
            <strong>{result.robustnessPct}%</strong>
          </span>
          <span className="wf-stat">
            <span className="wf-stat-label">OOS wins</span>
            <strong>
              {oosWindows.filter((w) => (w.outOfSampleReturnPct ?? 0) > 0).length}
              <span className="wf-stat-denom"> / {oosWindows.length}</span>
            </strong>
          </span>
        </div>
      </div>

      <WalkForwardHistogram result={result} />

      <table className="wf-table">
        <thead>
          <tr>
            <th>#</th>
            <th>In-sample</th>
            <th>OOS period</th>
            <th>OOS return</th>
            <th>DD</th>
            <th>Regime</th>
          </tr>
        </thead>
        <tbody>
          {result.windows.map((w) => {
            const oos = w.outOfSampleReturnPct;
            const pnlClass = oos === null ? "" : oos >= 0 ? "wf-oos-profit" : "wf-oos-loss";
            return (
              <tr key={w.windowIndex}>
                <td className="wf-td-index">W{w.windowIndex}</td>
                <td>{formatDate(w.inSampleStart)}–{formatDate(w.inSampleEnd)}</td>
                <td>
                  {w.outOfSampleStart
                    ? `${formatDate(w.outOfSampleStart)}–${formatDate(w.outOfSampleEnd)}`
                    : <span className="wf-td-muted">—</span>
                  }
                </td>
                <td className={pnlClass}>
                  {oos !== null ? `${oos >= 0 ? "+" : ""}${oos.toFixed(2)}%` : <span className="wf-td-muted">—</span>}
                </td>
                <td>{w.maxDrawdownPct.toFixed(2)}%</td>
                <td className="wf-td-regime">{w.regime}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={`wf-verdict ${VERDICT_CLASS[result.verdict]}`}>
        <span className="wf-verdict-dot" />
        <div>
          <strong>{VERDICT_LABELS[result.verdict]}</strong>
          <p>{VERDICT_COPY[result.verdict]}</p>
        </div>
      </div>
    </motion.div>
  );
}
