import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'btc_usd_price';
const CACHE_TTL = 30000;

export function useBtcUsdPrice(): number {
  const [price, setPrice] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < CACHE_TTL * 2) return parsed.price;
      }
      // Also try the shared crypto_prices_cache
      const shared = localStorage.getItem('crypto_prices_cache');
      if (shared) {
        const parsed = JSON.parse(shared);
        if (parsed.btc?.price) return parsed.btc.price;
      }
    } catch {}
    return 0;
  });

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const shared = localStorage.getItem('crypto_prices_cache');
        if (shared) {
          const parsed = JSON.parse(shared);
          if (parsed.btc?.price && Date.now() - parsed.timestamp < CACHE_TTL * 2) {
            setPrice(parsed.btc.price);
            return;
          }
        }
        const { data, error } = await supabase.functions.invoke('crypto-prices');
        if (!error && data?.btc?.price) {
          setPrice(data.btc.price);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ price: data.btc.price, ts: Date.now() }));
        }
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, CACHE_TTL);
    return () => clearInterval(iv);
  }, []);

  return price;
}
