import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action, params = {} } = body;

    // Check API key action - no key needed
    if (action === "check_key") {
      const { data: keys } = await supabase
        .from("user_api_keys")
        .select("id")
        .eq("user_id", user.id)
        .eq("exchange", "aster")
        .limit(1);
      return new Response(JSON.stringify({ hasKey: (keys?.length || 0) > 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save API key
    if (action === "save_key") {
      const { apiKey, apiSecret } = params;
      if (!apiKey || !apiSecret) throw new Error("API key and secret required");

      // Simple XOR-based obfuscation (in production, use proper encryption)
      const { error: upsertErr } = await supabase
        .from("user_api_keys")
        .upsert({
          user_id: user.id,
          exchange: "aster",
          api_key_encrypted: apiKey,
          api_secret_encrypted: apiSecret,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,exchange" });

      if (upsertErr) throw new Error(upsertErr.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require API keys
    const { data: keyData, error: keyErr } = await supabase
      .from("user_api_keys")
      .select("api_key_encrypted, api_secret_encrypted")
      .eq("user_id", user.id)
      .eq("exchange", "aster")
      .single();

    if (keyErr || !keyData) throw new Error("No API key configured. Please add your Aster DEX API key.");

    const apiKey = keyData.api_key_encrypted;
    const apiSecret = keyData.api_secret_encrypted;

    let result;

    switch (action) {
      case "account":
        result = await asterRequest("GET", "/fapi/v4/account", {}, apiKey, apiSecret);
        break;

      case "positions":
        result = await asterRequest("GET", "/fapi/v2/positionRisk", {}, apiKey, apiSecret);
        break;

      case "open_orders":
        result = await asterRequest("GET", "/fapi/v1/openOrders", params.symbol ? { symbol: params.symbol } : {}, apiKey, apiSecret);
        break;

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
