import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTER_BASE = "https://fapi.asterdex.com";

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function asterRequest(method: string, path: string, params: Record<string, string>, apiKey: string, apiSecret: string) {
  const timestamp = Date.now().toString();
  const queryParams = { ...params, timestamp, recvWindow: "5000" };
  const sortedQuery = Object.entries(queryParams).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
  const signature = await hmacSign(apiSecret, sortedQuery);
  const fullQuery = `${sortedQuery}&signature=${signature}`;

  const url = method === "GET" || method === "DELETE"
    ? `${ASTER_BASE}${path}?${fullQuery}`
    : `${ASTER_BASE}${path}`;

  const headers: Record<string, string> = { "X-MBX-APIKEY": apiKey };
  const options: RequestInit = { method, headers };

  if (method === "POST" || method === "PUT") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = fullQuery;
  }

  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.msg || `Aster API error ${res.status}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ASTER_API_KEY");
    const apiSecret = Deno.env.get("ASTER_API_SECRET");

    if (!apiKey || !apiSecret) {
      throw new Error("Aster API credentials not configured on server");
    }

    const body = await req.json();
    const { action, params = {} } = body;

    // check_key just confirms server has credentials
    if (action === "check_key") {
      return new Response(JSON.stringify({ hasKey: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    switch (action) {
      case "account":
        result = await asterRequest("GET", "/fapi/v4/account", {}, apiKey, apiSecret);
        break;

      case "balance":
        result = await asterRequest("GET", "/fapi/v3/balance", {}, apiKey, apiSecret);
        break;

      case "positions":
        result = await asterRequest("GET", "/fapi/v2/positionRisk", {}, apiKey, apiSecret);
        break;

      case "open_orders":
        result = await asterRequest("GET", "/fapi/v1/openOrders", params.symbol ? { symbol: params.symbol } : {}, apiKey, apiSecret);
        break;

      case "all_orders": {
        const orderParams: Record<string, string> = {};
        if (params.symbol) orderParams.symbol = params.symbol;
        if (params.limit) orderParams.limit = params.limit.toString();
        result = await asterRequest("GET", "/fapi/v1/allOrders", orderParams, apiKey, apiSecret);
        break;
      }

      case "trade_history": {
        const tradeParams: Record<string, string> = {};
        if (params.symbol) tradeParams.symbol = params.symbol;
        if (params.limit) tradeParams.limit = params.limit.toString();
        result = await asterRequest("GET", "/fapi/v1/userTrades", tradeParams, apiKey, apiSecret);
        break;
      }

      case "income_history": {
        const incomeParams: Record<string, string> = {};
        if (params.incomeType) incomeParams.incomeType = params.incomeType;
        if (params.limit) incomeParams.limit = params.limit.toString();
        result = await asterRequest("GET", "/fapi/v1/income", incomeParams, apiKey, apiSecret);
        break;
      }

      case "place_order": {
        const orderParams: Record<string, string> = {
          symbol: params.symbol,
          side: params.side,
          type: params.type,
          quantity: params.quantity,
        };
        if (params.price) orderParams.price = params.price;
        if (params.stopPrice) orderParams.stopPrice = params.stopPrice;
        if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
        result = await asterRequest("POST", "/fapi/v1/order", orderParams, apiKey, apiSecret);
        break;
      }

      case "cancel_order":
        result = await asterRequest("DELETE", "/fapi/v1/order", {
          symbol: params.symbol,
          orderId: params.orderId.toString(),
        }, apiKey, apiSecret);
        break;

      case "cancel_all_orders":
        result = await asterRequest("DELETE", "/fapi/v1/allOpenOrders", {
          symbol: params.symbol,
        }, apiKey, apiSecret);
        break;

      case "change_leverage":
        result = await asterRequest("POST", "/fapi/v1/leverage", {
          symbol: params.symbol,
          leverage: params.leverage.toString(),
        }, apiKey, apiSecret);
        break;

      case "change_margin_type":
        result = await asterRequest("POST", "/fapi/v1/marginType", {
          symbol: params.symbol,
          marginType: params.marginType,
        }, apiKey, apiSecret);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
