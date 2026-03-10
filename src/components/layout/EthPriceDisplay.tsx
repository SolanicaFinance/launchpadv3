import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  price: number;
  change24h: number;
}

const CACHE_KEY = 'eth_price_display_cache';
const CACHE_TTL = 30000; // 30 seconds

export function EthPriceDisplay() {
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
        const { data, error } = await supabase.functions.invoke('base-eth-price');
        
        if (error) throw error;
        
        if (data?.price) {
          const newData = {
            price: data.price,
            change24h: data.change24h || 0,
          };
          setPriceData(newData);
          setIsLoading(false);
          
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            ...newData,
            timestamp: Date.now(),
          }));
        }
      } catch (error) {
        console.debug('[EthPriceDisplay] Error:', error);
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
        <svg viewBox="0 0 256 417" className="h-4 w-4 opacity-50" fill="none">
          <path fill="#627EEA" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
          <path fill="#627EEA" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
          <path fill="#627EEA" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"/>
          <path fill="#627EEA" d="M127.962 416.905v-104.72L0 236.585z"/>
        </svg>
        <span className="text-xs text-muted-foreground">---</span>
      </div>
    );
  }

  const isPositive = priceData.change24h >= 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md">
      {/* Ethereum Logo */}
      <svg viewBox="0 0 256 417" className="h-4 w-4" fill="none">
        <path fill="#627EEA" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
        <path fill="#8C8C8C" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
        <path fill="#627EEA" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"/>
        <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z"/>
        <path fill="#3C3C3B" d="M127.961 287.958l127.96-75.637-127.96-58.162z"/>
        <path fill="#8C8C8C" d="M0 212.32l127.96 75.638v-133.8z"/>
      </svg>
      
      <span className="text-xs font-medium text-foreground">
        ${priceData.price.toFixed(2)}
      </span>
      
      <div className={`flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-success' : 'text-destructive'
      }`}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
