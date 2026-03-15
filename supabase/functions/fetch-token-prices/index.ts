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

    // Jupiter Price API v2 — free, supports batch
    const ids = mints.join(",");
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
    if (!res.ok) {
      console.error("Jupiter price API error:", res.status, await res.text());
      return new Response(JSON.stringify({ prices: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const prices: Record<string, number> = {};

    for (const mint of mints) {
      const entry = json?.data?.[mint];
      if (entry?.price) {
        prices[mint] = Number(entry.price);
      }
    }

    return new Response(JSON.stringify({ prices }), {
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
