const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cache the partner access token in memory
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

async function getAccessToken(apiKey: string, apiSecret: string): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  console.log("[transak] Refreshing token via:", `${API_BASE}/partners/api/v2/refresh-token`);

  const res = await fetch(`${API_BASE}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`refresh-token failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);
  const accessToken = json?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`No accessToken in response: ${text.substring(0, 200)}`);
  }

  cachedAccessToken = accessToken;
  tokenExpiresAt = Date.now() + 6 * 24 * 60 * 60 * 1000;
  return accessToken;
}

async function createSession(accessToken: string, widgetParams: Record<string, unknown>): Promise<string> {
  console.log("[transak] Creating session via:", `${GATEWAY_BASE}/api/v2/auth/session`);

  const res = await fetch(`${GATEWAY_BASE}/api/v2/auth/session`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "access-token": accessToken,
    },
    body: JSON.stringify({ widgetParams }),
  });

  const text = await res.text();
  console.log("[transak] Session response:", res.status, text.substring(0, 500));

  if (!res.ok) {
    throw new Error(`session failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);
  const widgetUrl = json?.data?.widgetUrl || json?.widgetUrl;
  if (!widgetUrl) {
    throw new Error(`No widgetUrl in response: ${text.substring(0, 200)}`);
  }
  return widgetUrl;
}
