const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache the partner access token in memory (7-day expiry, we refresh at 6 days)
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const TRANSAK_ENV = Deno.env.get("TRANSAK_ENV") || "PRODUCTION";
const isProduction = TRANSAK_ENV === "PRODUCTION";
const API_BASE = isProduction
  ? "https://api.transak.com"
  : "https://api-stg.transak.com";
const GATEWAY_BASE = isProduction
  ? "https://api-gateway.transak.com"
  : "https://api-gateway-stg.transak.com";

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const apiKey = Deno.env.get("VITE_TRANSAK_API_KEY") || Deno.env.get("TRANSAK_API_KEY") || "";
  const apiSecret = Deno.env.get("TRANSAK_API_SECRET") || "";

  if (!apiKey || !apiSecret) {
    throw new Error("Transak API key or secret not configured");
  }

  const res = await fetch(`${API_BASE}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[transak-widget-url] refresh-token failed:", res.status, text);
    throw new Error(`Failed to refresh Transak access token: ${res.status}`);
  }

  const json = await res.json();
  const accessToken = json?.data?.accessToken;
  if (!accessToken) {
    throw new Error("No accessToken in refresh-token response");
  }

  cachedAccessToken = accessToken;
  // Token expires in 7 days, refresh at 6 days
  tokenExpiresAt = Date.now() + 6 * 24 * 60 * 60 * 1000;

  return accessToken;
}

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

    const apiKey = Deno.env.get("VITE_TRANSAK_API_KEY") || Deno.env.get("TRANSAK_API_KEY") || "";
    const accessToken = await getAccessToken();

    const widgetParams: Record<string, unknown> = {
      apiKey,
      referrerDomain: referrerDomain || "saturntrade.lovable.app",
      cryptoCurrencyCode: cryptoCurrency || "SOL",
      network: "solana",
      walletAddress,
      defaultPaymentMethod: "credit_debit_card",
      disableWalletAddressForm: true,
      themeColor: "7c3aed",
      hideMenu: true,
    };

    if (fiatAmount) widgetParams.defaultFiatAmount = fiatAmount;
    if (fiatCurrency) widgetParams.defaultFiatCurrency = fiatCurrency;

    console.log("[transak-widget-url] Creating widget URL for wallet:", walletAddress);

    const sessionRes = await fetch(`${GATEWAY_BASE}/api/v2/auth/session`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "access-token": accessToken,
      },
      body: JSON.stringify({ widgetParams }),
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      console.error("[transak-widget-url] create session failed:", sessionRes.status, errText);

      // If access token expired, clear cache and retry once
      if (sessionRes.status === 401) {
        cachedAccessToken = null;
        tokenExpiresAt = 0;
        const freshToken = await getAccessToken();
        const retryRes = await fetch(`${GATEWAY_BASE}/api/v2/auth/session`, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "access-token": freshToken,
          },
          body: JSON.stringify({ widgetParams }),
        });

        if (!retryRes.ok) {
          const retryErr = await retryRes.text();
          throw new Error(`Transak session creation failed after retry: ${retryRes.status} ${retryErr}`);
        }

        const retryJson = await retryRes.json();
        return new Response(JSON.stringify({ widgetUrl: retryJson?.data?.widgetUrl || retryJson?.widgetUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Transak session creation failed: ${sessionRes.status} ${errText}`);
    }

    const sessionJson = await sessionRes.json();
    const widgetUrl = sessionJson?.data?.widgetUrl || sessionJson?.widgetUrl;

    if (!widgetUrl) {
      console.error("[transak-widget-url] No widgetUrl in response:", JSON.stringify(sessionJson));
      throw new Error("No widgetUrl returned from Transak");
    }

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
