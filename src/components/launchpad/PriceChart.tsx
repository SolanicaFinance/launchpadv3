import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSolAmount } from "@/hooks/useLaunchpad";
import { formatChange24h } from "@/lib/formatters";
import { ExternalLink, BarChart3, CandlestickChart, TrendingUp } from "lucide-react";
import { LightweightChart } from "./LightweightChart";

interface PriceChartProps {
  tokenId: string;
  currentPrice: number;
  priceChange24h?: number;
  mintAddress?: string;
  poolAddress?: string;
  status?: string;
}

type TimeRange = "1h" | "24h" | "7d" | "30d" | "all";
type ChartType = "candle" | "area";
type ChartView = "internal" | "dextools";

interface PricePoint {
  timestamp: string;
  price_sol: number;
  volume_sol: number;
}

// Aggregate price data into OHLCV candles
function aggregateToCandles(data: PricePoint[], intervalMs: number) {
  if (data.length === 0) return [];
  
  const candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  
  let currentBucket = Math.floor(new Date(data[0].timestamp).getTime() / intervalMs) * intervalMs;
  let currentCandle = {
    time: Math.floor(currentBucket / 1000), // lightweight-charts uses seconds
    open: data[0].price_sol,
    high: data[0].price_sol,
    low: data[0].price_sol,
    close: data[0].price_sol,
    volume: data[0].volume_sol || 0,
  };

  for (let i = 1; i < data.length; i++) {
    const pointTime = new Date(data[i].timestamp).getTime();
    const bucket = Math.floor(pointTime / intervalMs) * intervalMs;
    
    if (bucket === currentBucket) {
      // Same candle - update OHLC
      currentCandle.high = Math.max(currentCandle.high, data[i].price_sol);
      currentCandle.low = Math.min(currentCandle.low, data[i].price_sol);
      currentCandle.close = data[i].price_sol;
      currentCandle.volume += data[i].volume_sol || 0;
    } else {
      // New candle
      candles.push(currentCandle);
      currentBucket = bucket;
      currentCandle = {
        time: Math.floor(bucket / 1000),
        open: data[i].price_sol,
        high: data[i].price_sol,
        low: data[i].price_sol,
        close: data[i].price_sol,
        volume: data[i].volume_sol || 0,
      };
    }
  }
  
  candles.push(currentCandle);
  return candles;
}

export function PriceChart({ 
  tokenId, 
  currentPrice, 
  priceChange24h = 0,
  mintAddress,
  poolAddress,
  status
}: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const queryClient = useQueryClient();
  
  // Show DEXTools by default for graduated tokens with pool address
  const isGraduated = status === 'graduated' && !!poolAddress;
  const [chartView, setChartView] = useState<ChartView>(isGraduated ? "dextools" : "internal");

  // Real-time subscription for price updates
  useEffect(() => {
    if (!tokenId) return;

    const channel = supabase
      .channel(`price-history-${tokenId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'token_price_history',
          filter: `token_id=eq.${tokenId}`
        },
        () => {
          // Invalidate query to fetch new data
          queryClient.invalidateQueries({ queryKey: ["token-price-history", tokenId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tokenId, queryClient]);

  const { data: priceHistory = [], isLoading } = useQuery({
    queryKey: ["token-price-history", tokenId, timeRange],
    queryFn: async () => {
      let timeFilter = new Date();
      switch (timeRange) {
        case "1h":
          timeFilter.setHours(timeFilter.getHours() - 1);
          break;
        case "24h":
          timeFilter.setDate(timeFilter.getDate() - 1);
          break;
        case "7d":
          timeFilter.setDate(timeFilter.getDate() - 7);
          break;
        case "30d":
          timeFilter.setDate(timeFilter.getDate() - 30);
          break;
        case "all":
          timeFilter = new Date(0);
          break;
      }

      const { data, error } = await supabase
        .from("token_price_history")
        .select("timestamp, price_sol, volume_sol")
        .eq("token_id", tokenId)
        .gte("timestamp", timeFilter.toISOString())
        .order("timestamp", { ascending: true });

      if (error) throw error;
      return (data || []) as PricePoint[];
    },
    enabled: !!tokenId && chartView === "internal",
    staleTime: 30000,
    refetchInterval: 60000, // Refresh every minute
  });

  // Get candle interval based on time range
  const candleInterval = useMemo(() => {
    switch (timeRange) {
      case "1h": return 60 * 1000; // 1 minute candles
      case "24h": return 5 * 60 * 1000; // 5 minute candles
      case "7d": return 60 * 60 * 1000; // 1 hour candles
      case "30d": return 4 * 60 * 60 * 1000; // 4 hour candles
      case "all": return 24 * 60 * 60 * 1000; // Daily candles
      default: return 5 * 60 * 1000;
    }
  }, [timeRange]);

  const chartData = useMemo(() => {
    if (priceHistory.length === 0) {
      // Return empty array - show "No trades yet" message instead of fake data
      return [];
    }

    if (chartType === "candle") {
      return aggregateToCandles(priceHistory, candleInterval);
    }

    // Area chart data
    return priceHistory.map((point) => ({
      time: Math.floor(new Date(point.timestamp).getTime() / 1000),
      value: Number(point.price_sol),
    }));
  }, [priceHistory, currentPrice, chartType, candleInterval]);

  const hasNoTrades = priceHistory.length === 0 && chartView === "internal";

  const isPositive = priceChange24h >= 0;

  const timeRanges: TimeRange[] = ["1h", "24h", "7d", "30d", "all"];

  // DEXTools embed URL - using pool address for graduated tokens
  const dextoolsUrl = poolAddress 
    ? `https://www.dextools.io/widget-chart/en/solana/pe-light/${poolAddress}?theme=dark&chartType=1&chartResolution=15&drawingToolbars=false`
    : null;

  // External link to DEXTools full page
  const dextoolsPageUrl = poolAddress
    ? `https://www.dextools.io/app/en/solana/pair-explorer/${poolAddress}`
    : mintAddress
    ? `https://www.dextools.io/app/en/solana/pair-explorer/${mintAddress}`
    : null;

  if (isLoading && chartView === "internal") {
    return (
      <Card className="p-4">
        <Skeleton className="h-[350px] w-full" />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-2xl font-bold">{formatSolAmount(currentPrice)} SOL</p>
          <p className={`text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {formatChange24h(priceChange24h)} (24h)
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Source Toggle - only show if graduated with pool */}
          {isGraduated && (
            <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
              <TabsList className="h-8">
                <TabsTrigger value="dextools" className="h-7 px-2 text-xs gap-1">
                  <BarChart3 className="h-3 w-3" />
                  DEXTools
                </TabsTrigger>
                <TabsTrigger value="internal" className="h-7 px-2 text-xs gap-1">
                  <CandlestickChart className="h-3 w-3" />
                  Internal
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Chart Type Toggle - for internal chart */}
          {chartView === "internal" && (
            <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <TabsList className="h-8">
                <TabsTrigger value="candle" className="h-7 px-2 text-xs gap-1">
                  <CandlestickChart className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="area" className="h-7 px-2 text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Time Range - only for internal chart */}
          {chartView === "internal" && (
            <div className="flex gap-1">
              {timeRanges.map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTimeRange(range)}
                >
                  {range.toUpperCase()}
                </Button>
              ))}
            </div>
          )}

          {/* External Link */}
          {dextoolsPageUrl && (
            <a href={dextoolsPageUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartView === "dextools" && dextoolsUrl ? (
        <div className="relative w-full" style={{ height: "400px" }}>
          <iframe
            src={dextoolsUrl}
            title="DEXTools Chart"
            className="w-full h-full rounded-lg border-0"
            style={{ 
              backgroundColor: "transparent",
              colorScheme: "dark"
            }}
            allow="clipboard-read; clipboard-write"
          />
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
            Powered by DEXTools
          </div>
        </div>
      ) : hasNoTrades ? (
        <div className="h-[300px] flex flex-col items-center justify-center bg-secondary/20 rounded-lg border border-dashed border-border">
          <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No trades yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Be the first to trade this token!</p>
        </div>
      ) : (
        <LightweightChart
          data={chartData}
          chartType={chartType === "candle" ? "candlestick" : "area"}
          height={300}
          showVolume={chartType === "candle"}
          isPositive={isPositive}
        />
      )}

      {/* Info banner for bonding tokens */}
      {!isGraduated && (
        <div className="mt-3 text-xs text-muted-foreground text-center bg-secondary/50 rounded-lg py-2">
          📊 Professional TradingView-style charts • Real-time updates
        </div>
      )}
    </Card>
  );
}
