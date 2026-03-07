import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASTER_BASE = "https://fapi.asterdex.com";

const UUID_V5_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function uuidV5(name: string, namespace: string): Promise<string> {
  const nsBytes = hexToBytes(namespace.replace(/-/g, ""));
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(nsBytes.length + nameBytes.length);
  data.set(nsBytes);
  data.set(nameBytes, nsBytes.length);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = new Uint8Array(hashBuffer);
  hashArray[6] = (hashArray[6] & 0x0f) | 0x50;
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80;
  const hex2 = Array.from(hashArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex2.slice(0, 8)}-${hex2.slice(8, 12)}-${hex2.slice(12, 16)}-${hex2.slice(16, 20)}-${hex2.slice(20, 32)}`;
}

async function privyUserIdToUuid(privyUserId: string): Promise<string> {
  return uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
}

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
    const body = await req.json();
    const { action, params = {}, privyUserId } = body;

    if (!privyUserId) throw new Error("Authentication required (privyUserId missing)");

    const profileId = await privyUserIdToUuid(privyUserId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check API key action
    if (action === "check_key") {
      const { data: keys } = await supabase
        .from("user_api_keys")
        .select("id")
        .eq("profile_id", profileId)
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

      const { error: upsertErr } = await supabase
        .from("user_api_keys")
        .upsert({
          profile_id: profileId,
          exchange: "aster",
          api_key_encrypted: apiKey,
          api_secret_encrypted: apiSecret,
          updated_at: new Date().toISOString(),
        }, { onConflict: "profile_id,exchange" });

      if (upsertErr) throw new Error(upsertErr.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete API key
    if (action === "delete_key") {
      const { error: delErr } = await supabase
        .from("user_api_keys")
        .delete()
        .eq("profile_id", profileId)
        .eq("exchange", "aster");

      if (delErr) throw new Error(delErr.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require API keys
    const { data: keyData, error: keyErr } = await supabase
      .from("user_api_keys")
      .select("api_key_encrypted, api_secret_encrypted")
      .eq("profile_id", profileId)
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
