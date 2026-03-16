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

    // ─── GET LIMITS ──────────────────────────────────────────────
    if (action === "limits") {
      const res = await fetch(`${SPLITNOW_API}/assets/limits`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── CREATE QUOTE ────────────────────────────────────────────
    // SDK format: POST /quotes/ with nested quoteInput + quoteOutputs
    // Then wait ~1s and GET /quotes/{id} to retrieve rates
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
      const createData = await createRes.json();

      if (!createRes.ok) {
        console.error("[splitnow-proxy] Quote create error:", createRes.status, JSON.stringify(createData));
        return json(createData, createRes.status);
      }

      const quoteId = createData?.quoteId || createData?.id;
      console.log("[splitnow-proxy] Quote created, id:", quoteId);

      // Wait then fetch full quote with rates
      await sleep(1500);

      const getRes = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, { headers });
      const getData = await getRes.json();

      if (!getRes.ok) {
        console.error("[splitnow-proxy] Quote GET error:", getRes.status, JSON.stringify(getData));
        return json(getData, getRes.status);
      }

      console.log("[splitnow-proxy] Quote fetched:", JSON.stringify(getData));
      return json({ ...getData, quoteId }, getRes.status);
    }

    // ─── GET QUOTE ───────────────────────────────────────────────
    if (action === "get_quote") {
      const { quoteId } = params;
      const res = await fetch(`${SPLITNOW_API}/quotes/${quoteId}`, { headers });
      const data = await res.json();
      return json(data, res.status);
    }

    // ─── CREATE ORDER ────────────────────────────────────────────
    // SDK format: POST /orders/ with nested orderInput + orderOutputs
    // Then wait ~1s and GET /orders/{shortId} to get deposit details
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
      const createData = await createRes.json();

      if (!createRes.ok) {
        console.error("[splitnow-proxy] Order create error:", createRes.status, JSON.stringify(createData));
        return json(createData, createRes.status);
      }

      const shortId = createData?.shortId || createData?.id;
      console.log("[splitnow-proxy] Order created, shortId:", shortId);

      // Wait then fetch full order with deposit details
      await sleep(1500);

      const getRes = await fetch(`${SPLITNOW_API}/orders/${shortId}`, { headers });
      const getData = await getRes.json();

      if (!getRes.ok) {
        console.error("[splitnow-proxy] Order GET error:", getRes.status, JSON.stringify(getData));
        return json(getData, getRes.status);
      }

      console.log("[splitnow-proxy] Order fetched:", JSON.stringify(getData));
      return json({ ...getData, shortId }, getRes.status);
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
