import { useState, useEffect } from 'react';
import { subscribeSolPrice, getCachedSolPrice } from '@/lib/solPriceService';

export function useSolPrice() {
  const [solPrice, setSolPrice] = useState<number>(() => getCachedSolPrice()?.price ?? 0);
  const [isLoading, setIsLoading] = useState(solPrice === 0);

  useEffect(() => {
    const unsubscribe = subscribeSolPrice((data) => {
      setSolPrice(data.price);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return { solPrice, isLoading };
}
