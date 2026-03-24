import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Trade {
  id: string;
  created_at: string;
  price_btc: number;
  trade_type: string;
  btc_amount: number;
}

interface BtcMemePriceChartProps {
  trades: Trade[];
  currentPrice: number;
}

function formatBtcPrice(v: number) {
  if (v >= 0.001) return `${v.toFixed(6)}`;
  return `${v.toFixed(8)}`;
}

export function BtcMemePriceChart({ trades, currentPrice }: BtcMemePriceChartProps) {
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Reverse to chronological order and map to chart points
    const sorted = [...trades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return sorted.map((t) => ({
      time: new Date(t.created_at).getTime(),
      price: t.price_btc,
      label: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [trades]);

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
        Price chart available after 2+ trades
      </div>
    );
  }

  const minPrice = Math.min(...chartData.map((d) => d.price));
  const maxPrice = Math.max(...chartData.map((d) => d.price));
  const isUp = chartData[chartData.length - 1].price >= chartData[0].price;
  const color = isUp ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="btcPriceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <YAxis domain={[minPrice * 0.95, maxPrice * 1.05]} hide />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "11px",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number) => [`${formatBtcPrice(value)} BTC`, "Price"]}
          labelFormatter={(label) => label}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#btcPriceGrad)"
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
