import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BoostToken {
  chainId: string;
  tokenAddress: string;
  amount?: number;
  totalAmount?: number;
  icon?: string;
  name?: string;
  symbol?: string;
  description?: string;
  links?: { type?: string; label?: string; url?: string }[];
}

interface TrendingToken {
  rank: number;
  address: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  marketCap: number | null;
  volume24h: number | null;
  priceChange6h: number | null;
  priceUsd: string | null;
  liquidity: number | null;
  boostAmount: number;
  pairAddress: string | null;
  socialLinks: { type: string; url: string }[];
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Fetch top boosted tokens
    const boostRes = await fetchWithRetry('https://api.dexscreener.com/token-boosts/top/v1');
    const boostData: BoostToken[] = await boostRes.json();

    // 2. Filter to Solana only, deduplicate by address, take top 50
    const seen = new Set<string>();
    const solanaTokens: BoostToken[] = [];
    for (const t of boostData) {
      if (t.chainId === 'solana' && !seen.has(t.tokenAddress)) {
        seen.add(t.tokenAddress);
        solanaTokens.push(t);
        if (solanaTokens.length >= 50) break;
      }
    }

    if (solanaTokens.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Batch fetch pair data (30 addresses per request)
    const chunkSize = 30;
    const pairDataMap = new Map<string, any>();

    const chunks: string[][] = [];
    for (let i = 0; i < solanaTokens.length; i += chunkSize) {
      chunks.push(solanaTokens.slice(i, i + chunkSize).map(t => t.tokenAddress));
    }

    await Promise.all(chunks.map(async (chunk) => {
      try {
        const addresses = chunk.join(',');
        const pairRes = await fetchWithRetry(`https://api.dexscreener.com/tokens/v1/solana/${addresses}`);
        const pairs: any[] = await pairRes.json();

        if (Array.isArray(pairs)) {
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (addr && !pairDataMap.has(addr)) {
              pairDataMap.set(addr, pair);
            }
          }
        }
      } catch (e) {
        console.error('Chunk fetch error:', e);
      }
    }));

    // 4. Merge and build response
    const results: TrendingToken[] = solanaTokens.map((token, idx) => {
      const pair = pairDataMap.get(token.tokenAddress);

      const socialLinks: { type: string; url: string }[] = [];
      if (token.links) {
        for (const l of token.links) {
          if (l.url) socialLinks.push({ type: l.type || l.label || 'link', url: l.url });
        }
      }

      return {
        rank: idx + 1,
        address: token.tokenAddress,
        name: pair?.baseToken?.name || token.name || 'Unknown',
        symbol: pair?.baseToken?.symbol || token.symbol || '???',
        imageUrl: pair?.info?.imageUrl || token.icon || null,
        marketCap: pair?.marketCap ?? pair?.fdv ?? null,
        volume24h: pair?.volume?.h24 ?? null,
        priceChange6h: pair?.priceChange?.h6 ?? null,
        priceUsd: pair?.priceUsd ?? null,
        liquidity: pair?.liquidity?.usd ?? null,
        boostAmount: token.totalAmount || token.amount || 0,
        pairAddress: pair?.pairAddress ?? null,
        socialLinks,
      };
    });

    // 5. Filter out rugged tokens (priceChange6h <= -50%) and re-rank
    const filtered = results
      .filter(t => t.priceChange6h === null || t.priceChange6h > -50)
      .map((t, idx) => ({ ...t, rank: idx + 1 }));

    return new Response(JSON.stringify(filtered), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
