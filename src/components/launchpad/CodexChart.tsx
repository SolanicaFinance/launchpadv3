import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCodexChart, type CodexBar } from "@/hooks/useCodexChart";
import { CodexChartToolbar } from "./CodexChartToolbar";
import { Skeleton } from "@/components/ui/skeleton";

// Force thin candles: large visible window + low spacing
const BAR_SPACING = 0.8;
const MIN_BAR_SPACING = 0.2;
const TARGET_VISIBLE_BARS = 260;
const RIGHT_PADDING_BARS = 4;

interface CodexChartProps {
  tokenAddress: string;
  networkId?: number;
  height?: number;
}

export function CodexChart({
  tokenAddress,
  networkId = 1399811149,
  height = 520,
}: CodexChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const initialScrollDone = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    bars, isLoading, error, resolution, setResolution,
    chartType, cycleChartType, currencyCode, setCurrencyCode,
    statsType, setStatsType, showVolume, setShowVolume,
  } = useCodexChart(tokenAddress, networkId);

  const hasBars = bars.length > 0;

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggleFullscreen]);

  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // ========== CHART CREATION (no bars dependency) ==========
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      initialScrollDone.current = false;
    }

    const chartH = isFullscreen ? window.innerHeight - 40 : height;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: chartH,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#888",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
      },
      localization: {
        priceFormatter: (price: number): string => {
          if (price === 0) return '0';
          if (price < 0.000001) return price.toExponential(2);
          if (price < 0.01) return price.toPrecision(4);
          if (price < 1000) return price.toFixed(4);
          if (price >= 1_000_000) return (price / 1_000_000).toFixed(1) + 'M';
          if (price >= 1_000) return (price / 1_000).toFixed(1) + 'K';
          return price.toFixed(2);
        },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "rgba(255,255,255,0.12)", width: 1, style: 2, labelVisible: true },
        horzLine: { color: "rgba(255,255,255,0.12)", width: 1, style: 2, labelVisible: true },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: resolution.includes("S"),
        borderColor: "#222",
        rightOffset: 4,
        barSpacing: BAR_SPACING,
        minBarSpacing: MIN_BAR_SPACING,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      rightPriceScale: {
        borderColor: "#222",
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.35 : 0.08 },
        autoScale: true,
        entireTextOnly: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // ── CANDLE SERIES ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderVisible: false,
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
      priceScaleId: "right",
    });
    candleSeriesRef.current = candleSeries;

    // ── VOLUME SERIES ──
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.68, bottom: 0 },
      visible: true,
      borderVisible: false,
      entireTextOnly: true,
    });

    // Hide TradingView watermark
    const wm = container.querySelector('a[href*="tradingview"]');
    if (wm) (wm as HTMLElement).style.display = "none";

    // Resize handler
    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 40 : height,
        });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        priceLineRef.current = null;
      }
    };
  }, [height, isFullscreen, showVolume, resolution, hasBars]);

  // ========== DATA UPDATE (smooth, no chart recreation) ==========
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || bars.length === 0) return;

    // Build data arrays
    const chartData: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
    const volumeData: Array<{ time: UTCTimestamp; value: number; color: string }> = [];

    for (const b of bars) {
      const time = b.time as UTCTimestamp;
      chartData.push({
        time,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
      });
      volumeData.push({
        time,
        value: Math.max(0, Number(b.volume || 0)),
        color: Number(b.buyVolume || 0) >= Number(b.sellVolume || 0)
          ? "rgba(34,197,94,0.25)"
          : "rgba(239,68,68,0.20)",
      });
    }

    // Update data in-place (no flicker)
    candleSeries.setData(chartData);
    if (showVolume) {
      volumeSeries.setData(volumeData);
    } else {
      volumeSeries.setData([]);
    }

    // Remove old price line and add new one
    if (priceLineRef.current) {
      try { candleSeries.removePriceLine(priceLineRef.current); } catch {}
      priceLineRef.current = null;
    }
    const last = bars[bars.length - 1];
    if (last) {
      priceLineRef.current = candleSeries.createPriceLine({
        price: last.close,
        color: last.close >= last.open ? "#22C55E" : "#EF4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
      });
    }

    // Position: strict right-anchored viewport, thin candles always
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      chart.timeScale().applyOptions({ barSpacing: BAR_SPACING, minBarSpacing: MIN_BAR_SPACING });
      chart.timeScale().setVisibleLogicalRange({
        from: bars.length - TARGET_VISIBLE_BARS,
        to: bars.length + RIGHT_PADDING_BARS,
      });
    } else {
      chart.timeScale().scrollToRealTime();
    }
  }, [bars, showVolume]);

  // ── Toolbar props ──
  const tp = {
    resolution, onResolutionChange: setResolution,
    chartType, onCycleChartType: cycleChartType,
    currencyCode, onCurrencyToggle: () => setCurrencyCode(p => p === "USD" ? "TOKEN" : "USD"),
    statsType, onStatsToggle: () => setStatsType(p => p === "FILTERED" ? "UNFILTERED" : "FILTERED"),
    showVolume, onVolumeToggle: () => setShowVolume(p => !p),
    isLoading, onFullscreen: toggleFullscreen,
  };

  if (error && bars.length === 0) {
    return (
      <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-border/20" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...tp} />
        <div className="flex flex-col items-center justify-center gap-2" style={{ height }}>
          <div className="px-3 py-1 rounded bg-destructive/10 border border-destructive/20">
            <p className="text-[11px] font-mono text-destructive">⚠ Chart data unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && bars.length === 0) {
    return (
      <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-border/20" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...tp} isLoading={true} />
        <div style={{ height }} className="relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col justify-end p-4 gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="w-full rounded-sm" style={{ height: `${Math.random() * 30 + 10}%`, maxHeight: "60px", opacity: 0.08, backgroundColor: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-mono text-muted-foreground">Loading chart…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && bars.length === 0 && !error) {
    return (
      <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-border/20" style={{ backgroundColor: "#0a0a0a" }}>
        <CodexChartToolbar {...tp} />
        <div className="flex flex-col items-center justify-center gap-3" style={{ height }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-lg">📊</span>
            <div>
              <p className="text-[11px] font-mono text-white/60 font-medium">No trading activity yet</p>
              <p className="text-[9px] font-mono text-white/30 mt-0.5">Chart will appear after the first trade</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full rounded-2xl overflow-hidden border border-border/20" style={{ backgroundColor: "#0a0a0a" }}>
      <CodexChartToolbar {...tp} />
      {error && bars.length > 0 && (
        <div className="px-2 py-0.5 text-center" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
          <span className="text-[9px] font-mono text-destructive/80">⚠ Data may be delayed</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        style={{ height: isFullscreen ? "calc(100vh - 40px)" : height }}
      />
    </div>
  );
}
