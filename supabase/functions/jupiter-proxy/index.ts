import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const jupApiKey = Deno.env.get("JUPITER_API_KEY") || Deno.env.get("VITE_JUPITER_API_KEY");

    const { action, params, body } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (jupApiKey) {
      headers["x-api-key"] = jupApiKey;
    }

    let response: Response;

    if (action === "quote") {
      const qs = new URLSearchParams(params).toString();
      response = await fetch(`${JUPITER_API}/quote?${qs}`, { method: "GET", headers });
    } else if (action === "swap") {
      response = await fetch(`${JUPITER_API}/swap`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'quote' or 'swap'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`[jupiter-proxy] ${action} failed (${response.status}):`, JSON.stringify(data));
      return new Response(JSON.stringify({ error: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[jupiter-proxy] error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
