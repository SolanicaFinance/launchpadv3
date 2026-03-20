const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRANSAK_ENV = Deno.env.get("TRANSAK_ENV") || "PRODUCTION";
const isProduction = TRANSAK_ENV === "PRODUCTION";
const WIDGET_BASE = isProduction
  ? "https://global.transak.com"
  : "https://global-stg.transak.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { walletAddress, fiatAmount, fiatCurrency, cryptoCurrency, referrerDomain } = body;

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "walletAddress is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TRANSAK_API_KEY") || Deno.env.get("VITE_TRANSAK_API_KEY") || "";

    if (!apiKey) {
      throw new Error("Transak API key not configured");
    }

    // Build widget URL with query parameters directly
    const params = new URLSearchParams();
    params.set("apiKey", apiKey);
    params.set("referrerDomain", referrerDomain || "saturn.trade");
    params.set("cryptoCurrencyCode", cryptoCurrency || "SOL");
    params.set("network", "solana");
    params.set("walletAddress", walletAddress);
    params.set("defaultPaymentMethod", "credit_debit_card");
    params.set("disableWalletAddressForm", "true");
    params.set("themeColor", "7c3aed");
    params.set("hideMenu", "true");
    params.set("productsAvailed", "BUY");

    if (fiatAmount) params.set("defaultFiatAmount", String(fiatAmount));
    if (fiatCurrency) params.set("defaultFiatCurrency", fiatCurrency);

    const widgetUrl = `${WIDGET_BASE}?${params.toString()}`;

    console.log("[transak-widget-url] Built widget URL for wallet:", walletAddress);

    return new Response(JSON.stringify({ widgetUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[transak-widget-url] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
