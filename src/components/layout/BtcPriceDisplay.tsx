import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  price: number;
  change24h: number;
}

const CACHE_KEY = "btc_price_display_cache";
const CACHE_TTL = 30000;

export function BtcPriceDisplay() {
  const [priceData, setPriceData] = useState<PriceData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL * 2) {
          return { price: parsed.price, change24h: parsed.change24h };
        }
      }
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState(!priceData);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Use the same crypto-prices footer cache or Binance directly
        const cached = localStorage.getItem("crypto_prices_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.btc && Date.now() - parsed.timestamp < CACHE_TTL * 2) {
            const newData = { price: parsed.btc.price, change24h: parsed.btc.change24h || 0 };
            setPriceData(newData);
            setIsLoading(false);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ...newData, timestamp: Date.now() }));
            return;
          }
        }

        const { data, error } = await supabase.functions.invoke("crypto-prices");
        if (!error && data?.btc) {
          const newData = {
            price: data.btc.price,
            change24h: data.btc.change24h || 0,
          };
          setPriceData(newData);
          setIsLoading(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...newData, timestamp: Date.now() }));
        }
      } catch (error) {
        console.debug("[BtcPriceDisplay] Error:", error);
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !priceData) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md animate-pulse">
        <span className="text-sm">₿</span>
        <span className="text-xs text-muted-foreground">---</span>
      </div>
    );
  }

  const isPositive = priceData.change24h >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md">
      <span className="text-sm font-bold text-[hsl(30,100%,50%)]">₿</span>
      <span className="text-xs font-medium text-foreground">
        ${priceData.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </span>
      <div className={`flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-success" : "text-destructive"
      }`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{isPositive ? "+" : ""}{priceData.change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
