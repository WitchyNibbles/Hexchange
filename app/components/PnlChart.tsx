import { useEffect, useRef } from "react";
import { createChart, AreaSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import type { TradeSummary } from "../../src/shared/contracts";

interface PnlChartProps {
  trades: TradeSummary[];
}

export function PnlChart({ trades }: PnlChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || trades.length === 0) return;

    const sorted = [...trades].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    let cumulative = 0;
    const data = sorted.map((trade) => {
      cumulative += trade.realizedPnlUsd;
      return {
        time: Math.floor(new Date(trade.createdAt).getTime() / 1000) as UTCTimestamp,
        value: Number(cumulative.toFixed(2)),
      };
    });

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7ba3c4",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(76,201,240,0.035)" },
        horzLines: { color: "rgba(76,201,240,0.035)" },
      },
      crosshair: {
        vertLine: { color: "rgba(76,201,240,0.55)", labelBackgroundColor: "#060b1a" },
        horzLine: { color: "rgba(76,201,240,0.55)", labelBackgroundColor: "#060b1a" },
      },
      rightPriceScale: { borderVisible: false, textColor: "#7ba3c4" },
      timeScale: { borderVisible: false, textColor: "#5a8aaa", timeVisible: true },
      handleScroll: false,
      handleScale: false,
    });

    const isProfit = cumulative >= 0;
    const series = chart.addSeries(AreaSeries, {
      lineColor: isProfit ? "#4ade80" : "#f87171",
      topColor: isProfit ? "rgba(74,222,128,0.32)" : "rgba(248,113,113,0.32)",
      bottomColor: isProfit ? "rgba(74,222,128,0.0)" : "rgba(248,113,113,0.0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: isProfit ? "#4ade80" : "#f87171",
      crosshairMarkerBackgroundColor: "#060b1a",
    });

    series.setData(data);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="chart-empty">
        No trade history yet — the P&L chart will appear here once trades are recorded.
      </div>
    );
  }

  return <div ref={containerRef} className="pnl-chart-container" />;
}
