const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mints } = await req.json();
    if (!Array.isArray(mints) || mints.length === 0) {
      return new Response(JSON.stringify({ prices: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prices: Record<string, number> = {};
    const changes24h: Record<string, number> = {};

    // Try Jupiter first for prices
    const jupApiKey = Deno.env.get("JUPITER_API_KEY") || Deno.env.get("VITE_JUPITER_API_KEY");
    const ids = mints.join(",");
    const headers: Record<string, string> = {};
    if (jupApiKey) {
      headers["x-api-key"] = jupApiKey;
    }

    try {
      const res = await fetch(`https://lite-api.jup.ag/price/v2?ids=${ids}`, { headers });
      if (res.ok) {
        const json = await res.json();
        for (const mint of mints) {
          const entry = json?.data?.[mint];
          if (entry?.price) {
            prices[mint] = Number(entry.price);
          }
        }
      } else {
        console.error("Jupiter price API error:", res.status, await res.text());
      }
    } catch (e) {
      console.error("Jupiter fetch error:", e);
    }

    // Always hit DexScreener for 24h change data (and fallback prices)
    try {
      const dsRes = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${mints.join(",")}`
      );
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        if (Array.isArray(dsData)) {
          for (const mint of mints) {
            const pairs = dsData.filter(
              (p: any) => p.baseToken?.address === mint
            );
            if (pairs.length > 0) {
              pairs.sort(
                (a: any, b: any) =>
                  (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
              );
              const best = pairs[0];
              // Fallback price
              if (!prices[mint]) {
                const price = parseFloat(best.priceUsd);
                if (price > 0) prices[mint] = price;
              }
              // 24h change
              if (best.priceChange?.h24 !== undefined) {
                changes24h[mint] = Number(best.priceChange.h24);
              }
            }
          }
        }
      } else {
        console.error("DexScreener API error:", dsRes.status);
      }
    } catch (e) {
      console.error("DexScreener fetch error:", e);
    }

    return new Response(JSON.stringify({ prices, changes24h }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-token-prices error:", e);
    return new Response(JSON.stringify({ prices: {} }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
