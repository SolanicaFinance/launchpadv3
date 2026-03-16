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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Unwrap SplitNow's { success, data } envelope. Returns the inner data. */
function unwrap(response: any): any {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }
  return response;
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
      const raw = await res.json();
      return json(unwrap(raw), res.ok ? 200 : res.status);
    }

    // ─── GET EXCHANGERS ──────────────────────────────────────────
    if (action === "exchangers") {
      const res = await fetch(`${SPLITNOW_API}/exchangers/`, { headers });
      const raw = await res.json();
      return json(unwrap(raw), res.ok ? 200 : res.status);
    }

    // ─── GET LIMITS ──────────────────────────────────────────────
    if (action === "limits") {
      const res = await fetch(`${SPLITNOW_API}/assets/limits`, { headers });
      const raw = await res.json();
      return json(unwrap(raw), res.ok ? 200 : res.status);
    }

    // ─── CREATE QUOTE ────────────────────────────────────────────
    // POST /quotes/ → { success: true, data: "quote-id-string" }
    // GET  /quotes/{id} → { success: true, data: { quoteLegs: [...] } }
    if (action === "quote") {
      const {
        fromAssetId = "sol",
        fromNetworkId = "solana",
        toAssetId = "sol",
        toNetworkId = "solana",
        fromAmount,
        type: quoteType = "floating_rate",
      } = params;

      const body = {
        type: quoteType,
        quoteInput: {
          fromAmount: typeof fromAmount === "string" ? parseFloat(fromAmount) : Number(fromAmount),
          fromAssetId,
          fromNetworkId,
        },
        quoteOutputs: [
          {
            toPctBips: 10000,
            toAssetId,
            toNetworkId,
          },
        ],
      };

      console.log("[splitnow-proxy] Quote request:", JSON.stringify(body));

      const createRes = await fetch(`${SPLITNOW_API}/quotes/`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const createRaw = await createRes.json();

      if (!createRes.ok) {
        console.error("[splitnow-proxy] Quote create error:", createRes.status, JSON.stringify(createRaw));
        return json(createRaw, createRes.status);
      }

      // POST returns { success: true, data: "quoteId-string" }
      const quoteId = unwrap(createRaw);
      console.log("[splitnow-proxy] Quote created, id:", quoteId);

      // Wait then fetch full quote with rates
      await sleep(1500);

      const getRes = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, { headers });
      const getRaw = await getRes.json();

      if (!getRes.ok) {
        console.error("[splitnow-proxy] Quote GET error:", getRes.status, JSON.stringify(getRaw));
        return json(getRaw, getRes.status);
      }

      // GET returns { success: true, data: { quoteLegs: [...], ... } }
      const quoteData = unwrap(getRaw);
      console.log("[splitnow-proxy] Quote fetched:", JSON.stringify(quoteData));
      return json({ ...quoteData, quoteId });
    }

    // ─── GET QUOTE ───────────────────────────────────────────────
    if (action === "get_quote") {
      const { quoteId } = params;
      const res = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, { headers });
      const raw = await res.json();
      return json(unwrap(raw), res.ok ? 200 : res.status);
    }

    // ─── CREATE ORDER ────────────────────────────────────────────
    // POST /orders/ → { success: true, data: { shortId: "xxx" } }
    // GET  /orders/{shortId} → { success: true, data: { depositWalletAddress, status, ... } }
    if (action === "order") {
      const {
        quoteId,
        fromAmount,
        fromAssetId = "sol",
        fromNetworkId = "solana",
        orderOutputs,
        type: orderType = "floating_rate",
      } = params;

      const body = {
        type: orderType,
        quoteId,
        orderInput: {
          fromAmount: typeof fromAmount === "string" ? parseFloat(fromAmount) : Number(fromAmount),
          fromAssetId,
          fromNetworkId,
        },
        orderOutputs,
      };

      console.log("[splitnow-proxy] Order request:", JSON.stringify(body));

      const createRes = await fetch(`${SPLITNOW_API}/orders/`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const createRaw = await createRes.json();

      if (!createRes.ok) {
        console.error("[splitnow-proxy] Order create error:", createRes.status, JSON.stringify(createRaw));
        return json(createRaw, createRes.status);
      }

      // POST returns { success: true, data: { shortId: "xxx" } }
      const orderMeta = unwrap(createRaw);
      const shortId = orderMeta?.shortId || orderMeta;
      console.log("[splitnow-proxy] Order created, shortId:", shortId);

      // Wait then fetch full order with deposit details
      await sleep(1500);

      const getRes = await fetch(`${SPLITNOW_API}/orders/${shortId}`, { headers });
      const getRaw = await getRes.json();

      if (!getRes.ok) {
        console.error("[splitnow-proxy] Order GET error:", getRes.status, JSON.stringify(getRaw));
        return json(getRaw, getRes.status);
      }

      // GET returns { success: true, data: { shortId, depositWalletAddress, ... } }
      const orderData = unwrap(getRaw);
      console.log("[splitnow-proxy] Order fetched:", JSON.stringify(orderData));
      return json({ ...orderData, shortId });
    }

    // ─── GET ORDER STATUS ────────────────────────────────────────
    if (action === "status") {
      const { orderId } = params;
      const res = await fetch(`${SPLITNOW_API}/orders/${orderId}`, { headers });
      const raw = await res.json();
      return json(unwrap(raw), res.ok ? 200 : res.status);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("splitnow-proxy error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
