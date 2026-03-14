const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cached: { data: Record<string, number>; timestamp: number } | null = null;
const CACHE_TTL = 60000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd",
      { headers: { Accept: "application/json" } }
    );

    if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
    const d = await r.json();

    const prices = {
      btc: d.bitcoin?.usd ?? 0,
      eth: d.ethereum?.usd ?? 0,
      bnb: d.binancecoin?.usd ?? 0,
    };

    cached = { data: prices, timestamp: Date.now() };

    return new Response(JSON.stringify(prices), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Failed to fetch prices" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
