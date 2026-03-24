import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
import { Maximize2, Minimize2, BarChart3 } from "lucide-react";

// Match Codex chart thin-candle style
const BAR_SPACING = 6;
const MIN_BAR_SPACING = 1;
const RIGHT_PADDING_BARS = 4;

interface Trade {
  id: string;
  created_at: string;
  price_btc: number;
  trade_type: string;
  btc_amount: number;
  token_amount: number;
  solana_proof_signature?: string | null;
}

interface BtcMemeChartProps {
  trades: Trade[];
  currentPrice: number;
  height?: number;
}

type Resolution = "1" | "5" | "15" | "60";

const RESOLUTIONS: { label: string; value: Resolution }[] = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
];

interface Bar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

function buildBars(trades: Trade[], resolutionMinutes: number, currentPrice: number): Bar[] {
  if (!trades || trades.length === 0) return [];

  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const intervalMs = resolutionMinutes * 60 * 1000;
  const bars: Map<number, Bar> = new Map();

  for (const t of sorted) {
    const ts = new Date(t.created_at).getTime();
    const bucketTs = Math.floor(ts / intervalMs) * intervalMs;
    const time = Math.floor(bucketTs / 1000) as UTCTimestamp;
    const price = t.price_btc;
    const vol = t.btc_amount;

    const existing = bars.get(bucketTs);
    if (existing) {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
      existing.volume += vol;
      if (t.trade_type === "buy") existing.buyVolume += vol;
      else existing.sellVolume += vol;
    } else {
      bars.set(bucketTs, {
        time,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: vol,
        buyVolume: t.trade_type === "buy" ? vol : 0,
        sellVolume: t.trade_type === "sell" ? vol : 0,
      });
    }
  }

  const result = Array.from(bars.values()).sort((a, b) => a.time - b.time);

  // If only one bar, pad with empty bars before and after for better visual
  if (result.length === 1) {
    const bar = result[0];
    const beforeTime = (bar.time - resolutionMinutes * 60 * 5) as UTCTimestamp;
    const afterTime = (bar.time + resolutionMinutes * 60) as UTCTimestamp;
    
    // Add a "flat" bar before showing the initial price
    result.unshift({
      time: beforeTime,
      open: bar.open,
      high: bar.open,
      low: bar.open,
      close: bar.open,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    });

    // Add current price bar after
    if (currentPrice > 0) {
      result.push({
        time: afterTime,
        open: bar.close,
        high: Math.max(bar.close, currentPrice),
        low: Math.min(bar.close, currentPrice),
        close: currentPrice,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
      });
    }
  }

  return result;
}

export function BtcMemeChart({ trades, currentPrice, height = 420 }: BtcMemeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const initialScrollDone = useRef(false);
  const [resolution, setResolution] = useState<Resolution>("5");
  const [showVolume, setShowVolume] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const bars = useMemo(
    () => buildBars(trades, parseInt(resolution), currentPrice),
    [trades, resolution, currentPrice]
  );

  const hasBars = bars.length > 0;

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen?.(); setIsFullscreen(true); }
    else { document.exitFullscreen?.(); setIsFullscreen(false); }
  }, []);

  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Chart creation
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
          if (price === 0) return "0";
          if (price < 0.00000001) return price.toExponential(2);
          if (price < 0.000001) return price.toFixed(10);
          if (price < 0.01) return price.toFixed(8);
          return price.toFixed(8);
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
        secondsVisible: false,
        borderColor: "#222",
        rightOffset: RIGHT_PADDING_BARS,
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderVisible: false,
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
      priceFormat: { type: "price", precision: 10, minMove: 0.0000000001 },
      priceScaleId: "right",
    });
    candleSeriesRef.current = candleSeries;

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

  // Data update
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || bars.length === 0) return;

    const chartData: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
    const volumeData: Array<{ time: UTCTimestamp; value: number; color: string }> = [];

    for (const b of bars) {
      chartData.push({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      });
      volumeData.push({
        time: b.time,
        value: Math.max(0, b.volume),
        color: b.buyVolume >= b.sellVolume
          ? "rgba(34,197,94,0.25)"
          : "rgba(239,68,68,0.20)",
      });
    }

    candleSeries.setData(chartData);
    if (showVolume) {
      volumeSeries.setData(volumeData);
    } else {
      volumeSeries.setData([]);
    }

    // Price line
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

    // Right-anchored viewport like Codex chart
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      chart.timeScale().applyOptions({ barSpacing: BAR_SPACING, minBarSpacing: MIN_BAR_SPACING });
      if (bars.length <= 10) {
        // Few bars — fit content for best visibility
        chart.timeScale().fitContent();
      } else {
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, bars.length - 120),
          to: bars.length + RIGHT_PADDING_BARS,
        });
      }
    } else {
      chart.timeScale().scrollToRealTime();
    }
  }, [bars, showVolume]);

  const hasTrades = trades && trades.length > 0;

  return (
    <div
      className="flex flex-col w-full rounded-2xl overflow-hidden border border-border/20"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Toolbar — matches Codex style */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-border/10"
        style={{ backgroundColor: "#0d0d0d" }}
      >
        <div className="flex items-center gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                resolution === r.value
                  ? "bg-primary/20 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {r.label}
            </button>
          ))}
          <div className="w-px h-4 bg-border/20 mx-1" />
          <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">BTC</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowVolume((p) => !p)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded transition-colors ${
              showVolume ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            Vol
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors"
            title="Toggle fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!hasTrades ? (
        <div className="flex flex-col items-center justify-center gap-3" style={{ height }}>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-lg">📊</span>
            <div>
              <p className="text-[11px] font-mono text-white/60 font-medium">No trading activity yet</p>
              <p className="text-[9px] font-mono text-white/30 mt-0.5">Chart will appear after the first trade</p>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="w-full overflow-hidden"
          style={{ height: isFullscreen ? "calc(100vh - 40px)" : height }}
        />
      )}
    </div>
  );
}
