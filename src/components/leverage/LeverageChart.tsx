import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi, type ISeriesApi } from "lightweight-charts";
import type { KlineBar, KlineInterval } from "@/hooks/useHyperliquidKlines";
import { cn } from "@/lib/utils";

const INTERVALS: { label: string; value: KlineInterval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
];

interface Props {
  bars: KlineBar[];
  loading: boolean;
  interval: KlineInterval;
  onIntervalChange: (i: KlineInterval) => void;
  symbol: string;
}

export function LeverageChart({ bars, loading, interval, onIntervalChange, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const hasBars = bars.length > 0;

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "hsl(0 0% 42%)",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "hsl(240 4% 12%)" },
        horzLines: { color: "hsl(240 4% 12%)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "hsl(72 100% 50% / 0.3)", labelBackgroundColor: "hsl(240 5% 15%)" },
        horzLine: { color: "hsl(72 100% 50% / 0.3)", labelBackgroundColor: "hsl(240 5% 15%)" },
      },
      timeScale: {
        borderColor: "hsl(240 4% 16%)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 6,
      },
      rightPriceScale: {
        borderColor: "hsl(240 4% 16%)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const resizeObs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!hasBars || !candleRef.current || !volumeRef.current) return;

    const candleData = bars.map((b) => ({
      time: b.time as any,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    const volumeData = bars.map((b) => ({
      time: b.time as any,
      value: b.volume,
      color: b.close >= b.open ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
    }));

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);

    chartRef.current?.timeScale().scrollToRealTime();
  }, [hasBars, bars]);

  return (
    <div className="flex flex-col h-full">
      {/* Interval selector */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onIntervalChange(iv.value)}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium rounded-sm transition-colors",
              interval === iv.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
            )}
          >
            {iv.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{symbol}/USDC</span>
      </div>

      {/* Chart container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
