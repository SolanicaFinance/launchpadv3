import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'bnb_price_cache';
const CACHE_TTL = 30000;

interface CachedPrice {
  price: number;
  timestamp: number;
}

export function useBnbPrice() {
  const [bnbPrice, setBnbPrice] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedPrice = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 120_000) {
          return parsed.price;
        }
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {}
    return 0;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase.functions.invoke('bnb-price');
        if (!error && data?.price) {
          setBnbPrice(data.price);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ price: data.price, timestamp: Date.now() }));
        }
      } catch {
        console.debug('[useBnbPrice] Error fetching price');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  return { bnbPrice, isLoading };
}
