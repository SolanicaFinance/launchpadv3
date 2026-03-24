import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

interface Trade {
  id: string;
  created_at: string;
  price_btc: number;
  trade_type: string;
  btc_amount: number;
  token_amount: number;
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

function buildBars(trades: Trade[], resolutionMinutes: number): Bar[] {
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

  return Array.from(bars.values()).sort((a, b) => a.time - b.time);
}

export function BtcMemeChart({ trades, currentPrice, height = 360 }: BtcMemeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const [resolution, setResolution] = useState<Resolution>("5");
  const [showVolume, setShowVolume] = useState(true);

  const bars = useMemo(
    () => buildBars(trades, parseInt(resolution)),
    [trades, resolution]
  );

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
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#888",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
      },
      localization: {
        priceFormatter: (price: number): string => {
          if (price === 0) return "0";
          if (price < 0.000001) return price.toExponential(2);
          if (price < 0.01) return price.toPrecision(4);
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
        rightOffset: 4,
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
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height, showVolume]);

  // Data update
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    if (bars.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }

    candleSeries.setData(bars.map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    })));

    if (showVolume) {
      volumeSeries.setData(bars.map((b) => ({
        time: b.time,
        value: b.volume,
        color: b.buyVolume >= b.sellVolume ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.20)",
      })));
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

    chart.timeScale().fitContent();
  }, [bars, showVolume]);

  const hasTrades = trades && trades.length > 0;

  return (
    <div className="flex flex-col w-full rounded-xl overflow-hidden border border-border/20" style={{ backgroundColor: "#0a0a0a" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/10" style={{ backgroundColor: "#0d0d0d" }}>
        <div className="flex items-center gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResolution(r.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                resolution === r.value
                  ? "bg-primary/20 text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowVolume((p) => !p)}
          className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
            showVolume ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Vol
        </button>
      </div>

      {!hasTrades ? (
        <div className="flex items-center justify-center gap-2" style={{ height }}>
          <span className="text-lg">📊</span>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">No trading activity yet</p>
            <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">Chart will appear after the first trade</p>
          </div>
        </div>
      ) : bars.length < 2 ? (
        <div className="flex items-center justify-center gap-2" style={{ height }}>
          <span className="text-lg">📊</span>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">Not enough data for candles</p>
            <p className="text-[9px] font-mono text-muted-foreground/50 mt-0.5">
              Current price: {currentPrice.toFixed(8)} BTC
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full overflow-hidden" style={{ height }} />
      )}
    </div>
  );
}
