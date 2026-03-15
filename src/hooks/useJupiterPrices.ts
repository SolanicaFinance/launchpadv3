import { useQuery } from "@tanstack/react-query";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface JupiterPriceMap {
  [mint: string]: { priceSol: number; priceUsd: number };
}

/**
 * Fetch live USD prices from Jupiter Price API v2 for a list of mints,
 * then derive SOL price using the SOL/USD rate from the same response.
 */
export function useJupiterPrices(mints: string[]) {
  return useQuery<JupiterPriceMap>({
    queryKey: ["jupiter-prices", mints.sort().join(",")],
    enabled: mints.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      // Always include SOL mint so we can derive SOL prices
      const allMints = [...new Set([SOL_MINT, ...mints])];
      // Jupiter allows up to 100 ids per request
      const chunks: string[][] = [];
      for (let i = 0; i < allMints.length; i += 100) {
        chunks.push(allMints.slice(i, i + 100));
      }

      const result: JupiterPriceMap = {};
      let solUsdPrice = 0;

      for (const chunk of chunks) {
        try {
          const resp = await fetch(
            `https://api.jup.ag/price/v2?ids=${chunk.join(",")}`
          );
          if (!resp.ok) continue;
          const json = await resp.json();
          const data = json.data as Record<string, { id: string; price: string } | undefined>;

          // Extract SOL price first
          if (data[SOL_MINT]?.price) {
            solUsdPrice = parseFloat(data[SOL_MINT].price);
          }

          for (const mint of chunk) {
            const entry = data[mint];
            if (!entry?.price) continue;
            const usd = parseFloat(entry.price);
            result[mint] = { priceUsd: usd, priceSol: 0 }; // priceSol filled below
          }
        } catch {
          // skip failed chunks
        }
      }

      // Convert USD prices to SOL prices
      if (solUsdPrice > 0) {
        for (const mint of Object.keys(result)) {
          result[mint].priceSol = result[mint].priceUsd / solUsdPrice;
        }
      }

      return result;
    },
  });
}
