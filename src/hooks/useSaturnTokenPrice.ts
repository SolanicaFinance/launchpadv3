import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SATURN_CA = '0x27a51c96b84c6d9f24d5d054c396ae0e1c96ffff';
const CACHE_KEY = 'saturn_token_price_cache';
const CACHE_TTL = 30000;

interface SaturnPriceData {
  price: number;
  change24h: number;
}

function getCached(): SaturnPriceData | null {
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
}

export function useSaturnTokenPrice() {
  const [priceData, setPriceData] = useState<SaturnPriceData | null>(getCached);
  const [isLoading, setIsLoading] = useState(!priceData);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // Use DexScreener API via edge function or directly
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SATURN_CA}`);
        const data = await res.json();
        
        if (data?.pairs?.length > 0) {
          // Get the pair with highest liquidity
          const pair = data.pairs.sort((a: any, b: any) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];
          
          const price = parseFloat(pair.priceUsd || '0');
          // Only trust 24h change when pair has tracked liquidity
          const hasReliableData = pair.liquidity?.usd != null && pair.liquidity.usd > 0;
          const change24h = hasReliableData ? (pair.priceChange?.h24 || 0) : 0;
          
          const newData = { price, change24h };
          setPriceData(newData);
          setIsLoading(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...newData, timestamp: Date.now() }));
        }
      } catch (error) {
        console.debug('[SaturnTokenPrice] Error:', error);
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  return { priceData, isLoading };
}
