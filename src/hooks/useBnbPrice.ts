import { useState, useEffect } from 'react';

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
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        const data = await res.json();
        const price = data?.binancecoin?.usd;
        if (price && typeof price === 'number') {
          setBnbPrice(price);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ price, timestamp: Date.now() }));
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
