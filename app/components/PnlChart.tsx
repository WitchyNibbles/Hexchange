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
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7ba3c4",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(76,201,240,0.05)" },
        horzLines: { color: "rgba(76,201,240,0.05)" },
      },
      crosshair: {
        vertLine: { color: "rgba(76,201,240,0.4)" },
        horzLine: { color: "rgba(76,201,240,0.4)" },
      },
      rightPriceScale: { borderColor: "rgba(76,201,240,0.12)" },
      timeScale: { borderColor: "rgba(76,201,240,0.12)", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 180,
    });

    const isProfit = cumulative >= 0;
    const series = chart.addSeries(AreaSeries, {
      lineColor: isProfit ? "#4ade80" : "#f87171",
      topColor: isProfit ? "rgba(74,222,128,0.28)" : "rgba(248,113,113,0.28)",
      bottomColor: isProfit ? "rgba(74,222,128,0.0)" : "rgba(248,113,113,0.0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
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
