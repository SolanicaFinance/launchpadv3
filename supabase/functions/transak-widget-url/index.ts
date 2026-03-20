const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache the partner access token in memory
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

// Try BOTH environments — some keys only work in one
async function getAccessToken(apiKey: string, apiSecret: string, env: "prod" | "stg"): Promise<string> {
  const base = env === "prod"
    ? "https://api.transak.com"
    : "https://api-stg.transak.com";

  console.log(`[transak] Trying refresh-token on ${env}:`, `${base}/partners/api/v2/refresh-token`);

  const res = await fetch(`${base}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  });

  const text = await res.text();
  console.log(`[transak] refresh-token ${env} response:`, res.status);

  if (!res.ok) {
    throw new Error(`refresh-token ${env} failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);
  const accessToken = json?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`No accessToken in ${env} response`);
  }

  return accessToken;
}

async function createSession(
  accessToken: string,
  widgetParams: Record<string, unknown>,
  env: "prod" | "stg"
): Promise<string> {
  const base = env === "prod"
    ? "https://api-gateway.transak.com"
    : "https://api-gateway-stg.transak.com";

  console.log(`[transak] Creating session on ${env}:`, `${base}/api/v2/auth/session`);

  const res = await fetch(`${base}/api/v2/auth/session`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "access-token": accessToken,
    },
    body: JSON.stringify({ widgetParams }),
  });

  const text = await res.text();
  console.log(`[transak] session ${env} response:`, res.status, text.substring(0, 500));

  if (!res.ok) {
    throw new Error(`session ${env} failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);
  const widgetUrl = json?.data?.widgetUrl || json?.widgetUrl;
  if (!widgetUrl) {
    throw new Error(`No widgetUrl in ${env} response`);
  }
  return widgetUrl;
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

    const apiKey = Deno.env.get("TRANSAK_API_KEY") || Deno.env.get("VITE_TRANSAK_API_KEY") || "";
    const apiSecret = Deno.env.get("TRANSAK_API_SECRET") || "";

    if (!apiKey || !apiSecret) {
      throw new Error(`Transak credentials missing: apiKey=${!!apiKey}, apiSecret=${!!apiSecret}`);
    }

    const widgetParams: Record<string, unknown> = {
      apiKey,
      referrerDomain: referrerDomain || "saturn.trade",
      cryptoCurrencyCode: cryptoCurrency || "SOL",
      network: "solana",
      walletAddress,
      defaultPaymentMethod: "credit_debit_card",
      disableWalletAddressForm: true,
      themeColor: "7c3aed",
      hideMenu: true,
      productsAvailed: "BUY",
    };

    if (fiatAmount) widgetParams.defaultFiatAmount = fiatAmount;
    if (fiatCurrency) widgetParams.defaultFiatCurrency = fiatCurrency;

    console.log("[transak] Creating widget URL for wallet:", walletAddress);

    // Try production first, fall back to staging
    const envToTry = Deno.env.get("TRANSAK_ENV") === "STAGING" ? "stg" : "prod";
    let widgetUrl: string;

    try {
      const accessToken = await getAccessToken(apiKey, apiSecret, envToTry);
      widgetUrl = await createSession(accessToken, widgetParams, envToTry);
    } catch (primaryErr) {
      console.log(`[transak] ${envToTry} failed, trying other env...`, (primaryErr as Error).message);
      const fallbackEnv = envToTry === "prod" ? "stg" : "prod";
      const accessToken = await getAccessToken(apiKey, apiSecret, fallbackEnv);
      widgetUrl = await createSession(accessToken, widgetParams, fallbackEnv);
    }

    return new Response(JSON.stringify({ widgetUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[transak] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
