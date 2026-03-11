import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedCount: number | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    if (cachedCount !== null && now - cachedAt < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ count: cachedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId = Deno.env.get("PRIVY_APP_ID");
    const appSecret = Deno.env.get("PRIVY_APP_SECRET");
    if (!appId || !appSecret) {
      return new Response(JSON.stringify({ error: "Privy not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = btoa(`${appId}:${appSecret}`);

    let total = 0;
    let cursor: string | undefined;

    do {
      const url = new URL("https://auth.privy.io/api/v1/users");
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          "privy-app-id": appId,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Privy API error:", res.status, text);
        return new Response(JSON.stringify({ error: "Privy API error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const page = await res.json();
      total += page.data?.length ?? 0;
      cursor = page.next_cursor || undefined;
    } while (cursor);

    cachedCount = total;
    cachedAt = now;

    return new Response(JSON.stringify({ count: total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("privy-user-count error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
