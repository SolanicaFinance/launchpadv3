import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPLITNOW_API = "https://splitnow.io/api";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("SPLITNOW_API_KEY");
  if (!apiKey) {
    return json({ error: "SPLITNOW_API_KEY not configured" }, 500);
  }

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "Content-Type": "application/json",
  };

  try {
    const { action, ...params } = await req.json();

    // ─── GET ASSETS ──────────────────────────────────────────────
    if (action === "assets") {
      const res = await fetch(`${SPLITNOW_API}/assets/`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── GET EXCHANGERS ──────────────────────────────────────────
    if (action === "exchangers") {
      const res = await fetch(`${SPLITNOW_API}/exchangers/`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── CREATE QUOTE ────────────────────────────────────────────
    if (action === "quote") {
      const { fromAssetId, fromNetworkId, toAssetId, toNetworkId, fromAmount } = params;
      const numAmount = typeof fromAmount === "string" ? parseFloat(fromAmount) : Number(fromAmount);
      const body = {
        fromAssetId: fromAssetId || "sol",
        fromNetworkId: fromNetworkId || "solana",
        toAssetId: toAssetId || "sol",
        toNetworkId: toNetworkId || "solana",
        fromAmount: numAmount,
      };
      console.log("[splitnow-proxy] Quote request:", JSON.stringify(body));
      const res = await fetch(`${SPLITNOW_API}/quotes/`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[splitnow-proxy] Quote error:", res.status, JSON.stringify(data));
      }
      return json(data, res.status);
    }

    // ─── GET QUOTE ───────────────────────────────────────────────
    if (action === "get_quote") {
      const { quoteId } = params;
      const res = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── CREATE ORDER ────────────────────────────────────────────
    if (action === "order") {
      const { quoteId, fromAmount, fromAssetId, fromNetworkId, walletDistributions } = params;
      const res = await fetch(`${SPLITNOW_API}/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          quoteId,
          fromAmount,
          fromAssetId: fromAssetId || "sol",
          fromNetworkId: fromNetworkId || "solana",
          walletDistributions,
        }),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── GET ORDER STATUS ────────────────────────────────────────
    if (action === "status") {
      const { orderId } = params;
      const res = await fetch(`${SPLITNOW_API}/orders/${orderId}`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("splitnow-proxy error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
