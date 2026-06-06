import { useEffect, useRef } from "react";
import { createChart, HistogramSeries, ColorType, type UTCTimestamp } from "lightweight-charts";
import type { WalkForwardResult } from "../../src/shared/contracts";

interface Props {
  result: WalkForwardResult;
}

export function WalkForwardHistogram({ result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const oosWindows = result.windows.filter((w) => w.outOfSampleReturnPct !== null);
    if (oosWindows.length === 0) return;

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
      timeScale: { borderVisible: false, timeVisible: false, ticksVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(HistogramSeries, {
      color: "#4ade80",
      priceFormat: { type: "percent" as const },
    });

    const data = oosWindows.map((w, i) => ({
      time: (i + 1) as UTCTimestamp,
      value: w.outOfSampleReturnPct!,
      color: w.outOfSampleReturnPct! >= 0 ? "rgba(74,222,128,0.72)" : "rgba(248,113,113,0.72)",
    }));

    series.setData(data);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [result]);

  const oosCount = result.windows.filter((w) => w.outOfSampleReturnPct !== null).length;
  if (oosCount === 0) {
    return (
      <div className="chart-empty" style={{ height: 120 }}>
        Not enough candle history for out-of-sample windows.
      </div>
    );
  }

  return <div ref={containerRef} className="wf-histogram-container" />;
}
