import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  price: number;
  change24h: number;
}

const CACHE_KEY = 'sol_price_display_cache';
const CACHE_TTL = 30000; // 30 seconds

export function SolPriceDisplay() {
  const [priceData, setPriceData] = useState<PriceData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only use cache if less than 2 minutes old (was 60s, tightened)
        if (Date.now() - parsed.timestamp < 120_000) {
          return { price: parsed.price, change24h: parsed.change24h };
        }
        // Clear stale cache
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {}
    return null;
  });
  const [isLoading, setIsLoading] = useState(!priceData);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Use edge function to avoid CORS/rate limiting
        const { data, error } = await supabase.functions.invoke('sol-price');
        
        if (error) throw error;
        
        if (data?.price && typeof data.price === 'number' && data.price > 0) {
          // Reject stale fallback data from edge function - only use fresh prices
          if (data.stale && data.source === 'fallback') {
            console.debug('[SolPriceDisplay] Ignoring stale fallback price:', data.price);
            return;
          }
          
          const newData = {
            price: data.price,
            change24h: data.change24h || 0,
          };
          setPriceData(newData);
          setIsLoading(false);
          
          // Cache
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            ...newData,
            timestamp: Date.now(),
          }));
        }
      } catch (error) {
        console.debug('[SolPriceDisplay] Error:', error);
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
        <svg viewBox="0 0 397.7 311.7" className="h-4 w-4 opacity-50" fill="none">
          <path fill="#9945FF" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
          <path fill="#9945FF" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
          <path fill="#9945FF" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
        </svg>
        <span className="text-xs text-muted-foreground">---</span>
      </div>
    );
  }

  const isPositive = priceData.change24h >= 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/20 backdrop-blur-sm border border-border/20 group hover:border-border/40 transition-all duration-300">
      {/* Solana Logo */}
      <svg viewBox="0 0 397.7 311.7" className="h-4 w-4 flex-shrink-0" fill="none">
        <linearGradient id="solGrad1" x1="360.879" x2="141.213" y1="351.455" y2="-69.294" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <linearGradient id="solGrad2" x1="264.829" x2="45.163" y1="401.601" y2="-19.148" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <linearGradient id="solGrad3" x1="312.548" x2="92.882" y1="376.688" y2="-44.061" gradientTransform="matrix(1 0 0 -1 0 314)" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00ffa3"/>
          <stop offset="1" stopColor="#dc1fff"/>
        </linearGradient>
        <path fill="url(#solGrad1)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
        <path fill="url(#solGrad2)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
        <path fill="url(#solGrad3)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
      </svg>
      
      <span className="text-sm md:text-base font-bold text-foreground font-mono tracking-tight tabular-nums">
        ${priceData.price.toFixed(2)}
      </span>
      
      <div className={`flex items-center gap-0.5 text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
        isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
      }`}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span className="tabular-nums">{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
      </div>
    </div>
  );
}
