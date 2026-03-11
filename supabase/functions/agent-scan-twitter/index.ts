import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

// --- Cookie helpers (for using X_FULL_COOKIE without re-login) ---
const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
}

function buildLoginCookiesBase64FromEnv(args: {
  xFullCookie?: string | null;
  xAuthToken?: string | null;
  xCt0Token?: string | null;
}): string | null {
  // twitterapi.io expects login_cookies as base64(JSON cookies)
  if (args.xFullCookie) {
    const cookies = parseCookieString(args.xFullCookie);
    if (Object.keys(cookies).length === 0) return null;
    return btoa(JSON.stringify(cookies));
  }

  if (args.xAuthToken && args.xCt0Token) {
    return btoa(
      JSON.stringify({
        auth_token: stripQuotes(args.xAuthToken),
        ct0: stripQuotes(args.xCt0Token),
      })
    );
  }

  return null;
}

// OAuth 1.0a signing for official X.com API
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBase);
  return hmac.digest("base64");
}

function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessTokenSecret
  );

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    )
    .join(", ");

  return `OAuth ${headerParts}`;
}

// Reply to tweet using official X.com API v2 with OAuth 1.0a
async function replyViaOfficialApi(
  tweetId: string,
  text: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const url = "https://api.x.com/2/tweets";

  const body = JSON.stringify({
    text,
    reply: { in_reply_to_tweet_id: tweetId },
  });

  const oauthHeader = generateOAuthHeader(
    "POST",
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader,
        "Content-Type": "application/json",
      },
      body,
    });

    const responseText = await response.text();
    console.log(`[agent-scan-twitter] 📥 Official X API reply response: ${response.status} - ${responseText.slice(0, 300)}`);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    const data = JSON.parse(responseText);
    const replyId = data.data?.id;
    
    if (replyId) {
      return { success: true, replyId };
    }
    return { success: false, error: `No reply ID in response: ${responseText}` };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeTotpSecret = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  if (trimmed.toLowerCase().startsWith("otpauth://")) {
    try {
      const url = new URL(trimmed);
      const secretParam = url.searchParams.get("secret");
      if (secretParam) {
        return secretParam.replace(/\s|-/g, "").toUpperCase();
      }
    } catch {
      // fall through
    }
  }

  const secretMatch = trimmed.match(/secret\s*=\s*([A-Za-z2-7\s-]+)/i);
  const candidate = (secretMatch?.[1] ?? trimmed).replace(/\s|-/g, "").toUpperCase();
  return candidate || undefined;
};

const base32ToBytes = (input: string): Uint8Array => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const generateTotpCode = async (secretBase32: string, digits = 6, stepSec = 30): Promise<string> => {
  const keyBytes = base32ToBytes(secretBase32);
  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const counter = Math.floor(Date.now() / 1000 / stepSec);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(msg)));
  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binCode % mod).padStart(digits, "0");
};

type TweetResult = {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  created_at: string;
  media_url?: string; // Attached image URL from tweet
};

// Search for mentions using Official X API v2 with Bearer Token (App-only auth)
async function searchMentionsViaOfficialApi(
  query: string,
  bearerToken: string
): Promise<TweetResult[]> {
  const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("max_results", "100");
  searchUrl.searchParams.set("tweet.fields", "created_at,author_id,attachments");
  searchUrl.searchParams.set("expansions", "author_id,attachments.media_keys");
  searchUrl.searchParams.set("user.fields", "username");
  searchUrl.searchParams.set("media.fields", "url,preview_image_url,type");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[agent-scan-twitter] X API error:", response.status, errorText);
    throw new Error(`X_API_ERROR [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const tweets = data.data || [];
  const users = data.includes?.users || [];
  const media = data.includes?.media || [];

  // Build username map
  const userMap: Record<string, string> = {};
  for (const user of users) {
    userMap[user.id] = user.username;
  }

  // Build media map (media_key -> url)
  const mediaMap: Record<string, string> = {};
  for (const m of media) {
    // For photos, use url; for videos, use preview_image_url
    const mediaUrl = m.url || m.preview_image_url;
    if (m.media_key && mediaUrl) {
      mediaMap[m.media_key] = mediaUrl;
    }
  }

  return tweets.map((t: any) => {
    // Get first media URL from attachments
    let mediaUrl: string | undefined;
    const mediaKeys = t.attachments?.media_keys || [];
    for (const key of mediaKeys) {
      if (mediaMap[key]) {
        mediaUrl = mediaMap[key];
        break;
      }
    }

    return {
      id: t.id,
      text: t.text,
      author_id: t.author_id || "",
      author_username: userMap[t.author_id] || "",
      created_at: t.created_at || "",
      media_url: mediaUrl,
    };
  });
}

// Fallback: Search using twitterapi.io (session-based)
async function searchMentionsViaTwitterApiIo(
  query: string,
  apiKey: string
): Promise<TweetResult[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("queryType", "Latest");
  searchUrl.searchParams.set("count", "50");

  let lastStatus = 0;
  let lastBody: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(searchUrl.toString(), {
      headers: { "X-API-Key": apiKey },
    });

    lastStatus = response.status;
    const raw = await response.text();
    try {
      lastBody = raw ? JSON.parse(raw) : null;
    } catch {
      lastBody = { raw };
    }

    if (response.ok) {
      const data = lastBody;
      const tweets: Array<{
        id: string;
        text: string;
        author?: { id: string; userName: string };
        createdAt?: string;
        extendedEntities?: { media?: Array<{ media_url_https?: string; type?: string }> };
        entities?: { media?: Array<{ media_url_https?: string; type?: string }> };
        mediaUrls?: string[];
      }> = data?.tweets || [];

      return tweets.map((t) => {
        // Extract media URL from various possible locations in twitterapi.io response
        let mediaUrl: string | undefined;
        
        // Try extendedEntities first (preferred for high quality)
        const extMedia = t.extendedEntities?.media || t.entities?.media || [];
        for (const m of extMedia) {
          if (m.media_url_https && (m.type === "photo" || !m.type)) {
            mediaUrl = m.media_url_https;
            break;
          }
        }
        
        // Fallback to mediaUrls array if present
        if (!mediaUrl && t.mediaUrls && t.mediaUrls.length > 0) {
          mediaUrl = t.mediaUrls[0];
        }

        return {
          id: t.id,
          text: t.text,
          author_id: t.author?.id || "",
          author_username: t.author?.userName || "",
          created_at: t.createdAt || "",
          media_url: mediaUrl,
        };
      });
    }

    if (response.status === 429) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`[agent-scan-twitter] twitterapi.io rate limited. Retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    throw new Error(`twitterapi.io search failed [${response.status}]`);
  }

  throw new Error(`TWITTERAPI_RATE_LIMITED [${lastStatus}]`);
}

// Dynamic login to get fresh cookies
interface LoginCredentials {
  apiKey: string;
  username: string;
  email: string;
  password: string;
  totpSecret?: string;
  proxyUrl: string;
}

async function getLoginCookies(creds: LoginCredentials): Promise<string | null> {
  console.log("[agent-scan-twitter] 🔐 Attempting dynamic login...");

  const totpCode = creds.totpSecret ? await generateTotpCode(creds.totpSecret) : undefined;

  const loginBody: Record<string, string> = {
    user_name: creds.username,
    email: creds.email,
    password: creds.password,
    proxy: creds.proxyUrl,
  };
  if (totpCode) loginBody.totp_code = totpCode;

  const doLogin = async (endpoint: string, bodyOverrides?: Record<string, string>) => {
    const body = { ...loginBody, ...bodyOverrides };
    const res = await fetch(`${TWITTERAPI_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "X-API-Key": creds.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = safeJsonParse(text) ?? { raw: text };
    return { res, text, data };
  };

  // Try login v2 first
  let loginAttempt = await doLogin("/twitter/user_login_v2");
  console.log(`[agent-scan-twitter] 🔐 Login v2 response: ${loginAttempt.res.status}`);

  const loginIsAuthError = (payload: any): boolean => {
    const msg = String(payload?.message ?? payload?.msg ?? payload?.error ?? "").toLowerCase();
    return msg.includes("authentication error") || msg.includes("login failed") || msg.includes("challenge");
  };

  // Fallback to v3 if v2 fails
  if (!loginAttempt.res.ok || (loginAttempt.data?.status === "error" && loginIsAuthError(loginAttempt.data))) {
    console.log("[agent-scan-twitter] 🛟 Falling back to login v3...");
    const v3Body: Record<string, string> = totpCode ? { totp_code: totpCode } : {};
    loginAttempt = await doLogin("/twitter/user_login_v3", Object.keys(v3Body).length > 0 ? v3Body : undefined);
    console.log(`[agent-scan-twitter] 🔐 Login v3 response: ${loginAttempt.res.status}`);
  }

  if (!loginAttempt.res.ok) {
    console.error("[agent-scan-twitter] ❌ Login failed:", loginAttempt.text.slice(0, 500));
    return null;
  }

  const loginData = loginAttempt.data;
  const loginCookies =
    loginData.login_cookies ||
    loginData.cookies ||
    loginData.cookie ||
    loginData?.data?.login_cookies ||
    loginData?.data?.cookies;

  if (!loginCookies) {
    console.error("[agent-scan-twitter] ❌ No cookies in login response:", JSON.stringify(loginData).slice(0, 500));
    return null;
  }

  console.log("[agent-scan-twitter] ✅ Login successful, got cookies");
  return loginCookies;
}

// Send reply using twitterapi.io + cookie + proxy (same as promo-mention-reply)
async function replyToTweet(
  tweetId: string,
  text: string,
  cookieCreds: { apiKey: string; cookie: string; proxy?: string },
  username?: string,
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  try {
    console.log(`[agent-scan-twitter] 📤 Attempting reply via twitterapi.io to @${username || "unknown"} (tweet ${tweetId})`);

    const loginCookies = parseCookieString(cookieCreds.cookie);
    const loginCookiesB64 = btoa(JSON.stringify(loginCookies));

    const body: Record<string, string> = {
      tweet_text: text,
      reply_to_tweet_id: tweetId,
      login_cookies: loginCookiesB64,
    };

    if (cookieCreds.proxy) {
      body.proxy = cookieCreds.proxy;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "X-API-Key": cookieCreds.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

      console.log(`[agent-scan-twitter] 📥 twitterapi.io reply response: ${response.status} - ${rawText.slice(0, 300)}`);

      if (!response.ok || data.status === "error") {
        const apiMsg = data?.message || data?.error || data?.msg || rawText?.slice(0, 300);
        // Retry only on transient errors
        const isTransient = /429|5\d{2}/.test(String(response.status)) || /timeout|gateway/i.test(apiMsg || "");
        if (!isTransient || attempt === 2) {
          return { success: false, error: apiMsg || `HTTP ${response.status}` };
        }
        const backoffMs = 600 * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(`[agent-scan-twitter] 🔁 twitterapi.io transient failure (attempt ${attempt}/2): ${String(apiMsg).slice(0, 180)}; retrying in ~${Math.round(backoffMs)}ms`);
        await sleep(backoffMs);
        continue;
      }

      const replyId = data?.tweet_id || data?.data?.id;
      if (replyId) {
        console.log(`[agent-scan-twitter] ✅ Reply sent via twitterapi.io to @${username || "unknown"}: ${replyId}`);
        return { success: true, replyId };
      }
      return { success: false, error: `No reply ID in response: ${rawText.slice(0, 200)}` };
    }

    return { success: false, error: "Unknown retry error" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[agent-scan-twitter] ❌ REPLY EXCEPTION to @${username || "unknown"} (tweet ${tweetId}):`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

// Check how many launches an X author has done in last 24 hours
// deno-lint-ignore no-explicit-any
async function getAuthorLaunchesToday(
  supabase: any,
  postAuthorId: string
): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("agent_social_posts")
    .select("id", { count: "exact", head: true })
    .eq("platform", "twitter")
    .eq("post_author_id", postAuthorId)
    .eq("status", "completed")
    .gte("processed_at", oneDayAgo);
  
  return count || 0;
}

const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Official X API Bearer Token (preferred for searching)
    const xBearerToken = Deno.env.get("X_BEARER_TOKEN");
    
    // Official X API OAuth 1.0a credentials (preferred for replies)
    const twitterConsumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const twitterConsumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const twitterAccessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const twitterAccessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
    
    const oauthCreds = (twitterConsumerKey && twitterConsumerSecret && twitterAccessToken && twitterAccessTokenSecret)
      ? {
          consumerKey: twitterConsumerKey,
          consumerSecret: twitterConsumerSecret,
          accessToken: twitterAccessToken,
          accessTokenSecret: twitterAccessTokenSecret,
        }
      : undefined;
    
    // twitterapi.io credentials for posting via dynamic login (fallback)
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const xAccountUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    const proxyUrl = Deno.env.get("TWITTER_PROXY");

    // Preferred session cookie header (no re-login).
    const xFullCookie = Deno.env.get("X_FULL_COOKIE");

    // Legacy session tokens (fallback posting method)
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0Token = Deno.env.get("X_CT0_TOKEN");

    // Emergency kill-switch: disable ALL X posting/replying unless explicitly enabled.
    // Default behavior: OFF (prevents spam if credentials are present).
    const postingEnabled = Deno.env.get("ENABLE_X_POSTING") === "true";


    // Need at least one search method
    if (!xBearerToken && !twitterApiIoKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No search credentials configured. Need X_BEARER_TOKEN or TWITTERAPI_IO_KEY" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we can post replies (twitterapi.io + cookie)
    const cookieCreds = (twitterApiIoKey && xFullCookie)
      ? { apiKey: twitterApiIoKey, cookie: xFullCookie, proxy: proxyUrl || undefined }
      : undefined;
    const canPostRepliesRaw = !!(cookieCreds);
    const canPostReplies = postingEnabled && canPostRepliesRaw;
    
    if (!postingEnabled) {
      console.log("[agent-scan-twitter] 🚫 X posting disabled (ENABLE_X_POSTING != true) - will detect/process but skip replies");
    } else if (!canPostRepliesRaw) {
      console.log("[agent-scan-twitter] Reply credentials not configured (need TWITTERAPI_IO_KEY + X_FULL_COOKIE) - will detect/process but skip replies");
    } else {
      console.log("[agent-scan-twitter] Will use twitterapi.io + cookie for replies");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ========== GLOBAL RATE LIMIT CHECKS (6-layer spam protection) ==========
    // Layer 4: Per-minute burst protection (max 20 replies/minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: repliesLastMinute } = await supabase
      .from("twitter_bot_replies")
      .select("*", { count: "exact", head: true })
      .gt("created_at", oneMinuteAgo);
    
    if ((repliesLastMinute || 0) >= 20) {
      console.warn(`[agent-scan-twitter] ⚠️ Burst limit reached: ${repliesLastMinute} replies in last minute (max 20)`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "burst_rate_limit", repliesLastMinute }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Layer 5: Hourly rate limit (max 300 replies/hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: repliesLastHour } = await supabase
      .from("twitter_bot_replies")
      .select("*", { count: "exact", head: true })
      .gt("created_at", oneHourAgo);
    
    if ((repliesLastHour || 0) >= 300) {
      console.warn(`[agent-scan-twitter] ⚠️ Hourly limit reached: ${repliesLastHour} replies in last hour (max 300)`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "hourly_rate_limit", repliesLastHour }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-scan-twitter] 📊 Rate check: ${repliesLastMinute || 0}/20 per min, ${repliesLastHour || 0}/300 per hour`);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-twitter-lock";
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const rateLimitLockName = "agent-scan-twitter-rate-limit";

    // Clean up expired locks
    await supabase.from("cron_locks").delete().lt("expires_at", new Date().toISOString());

    const { error: lockError } = await supabase.from("cron_locks").insert({
      lock_name: lockName,
      expires_at: lockExpiry,
    });

    if (lockError) {
      console.log("[agent-scan-twitter] Another instance running, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "lock held" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Check rate-limit cooldown
      const nowIso = new Date().toISOString();
      const { data: rlLock } = await supabase
        .from("cron_locks")
        .select("lock_name, expires_at")
        .eq("lock_name", rateLimitLockName)
        .gt("expires_at", nowIso)
        .maybeSingle();

      if (rlLock) {
        console.warn(`[agent-scan-twitter] Skipping due to rate-limit cooldown until ${rlLock.expires_at}`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "rate_limit_cooldown",
            cooldownUntil: rlLock.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try Official X API first (Bearer Token), fallback to twitterapi.io
      const officialSearchQuery = "\"!saturntrade\" -is:retweet";
      const twitterApiIoMentionQuery = "\"!saturntrade\" -is:retweet";
      const twitterApiIoLaunchQuery = "\"!saturntrade\" -is:retweet -is:reply";
      let tweets: TweetResult[] = [];
      let rateLimited = false;
      let searchMethod = "none";

      if (xBearerToken) {
        try {
          console.log("[agent-scan-twitter] Searching via Official X API (Bearer Token)...");
          tweets = await searchMentionsViaOfficialApi(officialSearchQuery, xBearerToken);
          searchMethod = "official_x_api";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via Official X API`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[agent-scan-twitter] Official X API failed:", msg);
          
          // Check if rate limited
          if (msg.includes("[429]")) {
            rateLimited = true;
          }
          
          // Try fallback if twitterapi.io is configured
          if (twitterApiIoKey && !rateLimited) {
            try {
              console.log("[agent-scan-twitter] Falling back to twitterapi.io with mention query:", twitterApiIoMentionQuery);
              tweets = await searchMentionsViaTwitterApiIo(twitterApiIoMentionQuery, twitterApiIoKey);
              searchMethod = "twitterapi_io_fallback";
              console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io mention query`);
              tweets.forEach((t, i) => console.log(`  [${i}] @${t.author_username}: ${t.text.substring(0, 80)}`));

              // Secondary search: if mention query found few results, also search for "!launch" keyword
              if (tweets.length < 5) {
                console.log("[agent-scan-twitter] Few mention results, running secondary !launch keyword search...");
                const launchTweets = await searchMentionsViaTwitterApiIo(twitterApiIoLaunchQuery, twitterApiIoKey);
                console.log(`[agent-scan-twitter] Found ${launchTweets.length} tweets via !launch keyword search`);
                launchTweets.forEach((t, i) => console.log(`  [kw-${i}] @${t.author_username}: ${t.text.substring(0, 80)}`));
                // Merge, deduplicating by tweet ID
                const existingIds = new Set(tweets.map(t => t.id));
                for (const t of launchTweets) {
                  if (!existingIds.has(t.id)) {
                    tweets.push(t);
                    existingIds.add(t.id);
                  }
                }
                console.log(`[agent-scan-twitter] Total merged tweets: ${tweets.length}`);
              }
            } catch (fallbackErr) {
              const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              if (fallbackMsg.includes("RATE_LIMITED") || fallbackMsg.includes("[429]")) {
                rateLimited = true;
              } else {
                throw fallbackErr;
              }
            }
          }
        }
      } else if (twitterApiIoKey) {
        // No Bearer Token, use twitterapi.io directly
        try {
          console.log("[agent-scan-twitter] Searching via twitterapi.io with mention query:", twitterApiIoMentionQuery);
          tweets = await searchMentionsViaTwitterApiIo(twitterApiIoMentionQuery, twitterApiIoKey);
          searchMethod = "twitterapi_io";
          console.log(`[agent-scan-twitter] Found ${tweets.length} tweets via twitterapi.io mention query`);
          tweets.forEach((t, i) => console.log(`  [${i}] @${t.author_username}: ${t.text.substring(0, 80)}`));

          // Secondary search: if mention query found few results, also search for "!saturntrade" keyword
          if (tweets.length < 5) {
            console.log("[agent-scan-twitter] Few mention results, running secondary !saturntrade keyword search...");
            const launchTweets = await searchMentionsViaTwitterApiIo(twitterApiIoLaunchQuery, twitterApiIoKey);
            console.log(`[agent-scan-twitter] Found ${launchTweets.length} tweets via !saturntrade keyword search`);
            launchTweets.forEach((t, i) => console.log(`  [kw-${i}] @${t.author_username}: ${t.text.substring(0, 80)}`));
            const existingIds = new Set(tweets.map(t => t.id));
            for (const t of launchTweets) {
              if (!existingIds.has(t.id)) {
                tweets.push(t);
                existingIds.add(t.id);
              }
            }
            console.log(`[agent-scan-twitter] Total merged tweets: ${tweets.length}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("RATE_LIMITED") || msg.includes("[429]")) {
            rateLimited = true;
          } else {
            throw err;
          }
        }
      }

      // Set cooldown if rate-limited
      if (rateLimited) {
        const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await supabase.from("cron_locks").delete().eq("lock_name", rateLimitLockName);
        await supabase.from("cron_locks").insert({
          lock_name: rateLimitLockName,
          expires_at: cooldownUntil,
          acquired_at: new Date().toISOString(),
        });
        console.warn("[agent-scan-twitter] Rate limited, cooldown set until", cooldownUntil);
      }

      // Get the latest processed tweet timestamp to skip older ones
      const { data: latestProcessed } = await supabase
        .from("agent_social_posts")
        .select("post_id, created_at")
        .eq("platform", "twitter")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Strip any suffixes like _final, _retry from post_id for comparison
      const rawProcessedId = latestProcessed?.post_id;
      const latestProcessedId = rawProcessedId?.replace(/_(final|retry)$/i, '') || null;
      
      if (tweets.length > 0) {
        const tweetIds = tweets.map((t) => t.id).slice(0, 5);
        console.log(`[agent-scan-twitter] Latest tweet IDs: ${tweetIds.join(", ")}`);
        if (latestProcessedId) {
          console.log(`[agent-scan-twitter] Last processed tweet ID: ${latestProcessedId}`);
        }
      }

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      // No login cookies needed - replies use Official X API (OAuth 1.0a) only

      // Catch-up retry logic is at the end of the function (after main processing).
      // It uses pre-claim dedup: inserts pending reply record BEFORE attempting, preventing duplicates.

      // Sort tweets by ID descending (newest first) to process in order
      // Generate Claw's viral take on a launched token
      async function generateClawViralTake(tokenName: string, tokenSymbol: string, tweetText: string): Promise<string> {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) return "🦞 Snip snip. Trade it on saturntrade.com";

        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `You are Claw 🦞, a sentient blockchain lobster with dry humor. You just launched a token for someone.
Give a SHORT honest take (max 120 chars) on whether this meme/token idea can go viral or not.
Be opinionated - commit to a take. Use lobster humor. No hashtags. No emojis except 🦞.
Examples of good takes:
- "🦞 This has degen energy. Could catch a wave if CT picks it up"
- "🦞 Niche play. Viral? Doubtful. But the diamond claws will hold"
- "🦞 Pure chaos energy. This is either 100x or zero. I respect it"
- "🦞 Seen this pattern before. Needs a catalyst to break out"
Do NOT mention fees, panels, or platform features. Just your raw take on the meme.`,
                },
                {
                  role: "user",
                  content: `Token: $${tokenSymbol} - ${tokenName}\nOriginal tweet: "${tweetText.slice(0, 300)}"`,
                },
              ],
              max_tokens: 60,
              temperature: 0.9,
            }),
          });

          if (!response.ok) {
            console.error("[agent-scan-twitter] AI viral take error:", response.status);
            return "🦞 Snip snip. Trade it on saturntrade.com";
          }

          const data = await response.json();
          let take = data.choices?.[0]?.message?.content?.trim();
          if (!take) return "🦞 Snip snip. Trade it on saturntrade.com";

          // Ensure it starts with 🦞 and trim to 140 chars
          if (!take.startsWith("🦞")) take = "🦞 " + take;
          if (take.length > 140) take = take.slice(0, 137) + "...";
          return take;
        } catch (e) {
          console.error("[agent-scan-twitter] AI viral take exception:", e);
          return "🦞 Snip snip. Trade it on saturntrade.com";
        }
      }

      const sortedTweets = [...tweets].sort((a, b) => {
        // Tweet IDs are snowflake IDs - larger = newer
        return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
      });

      for (const tweet of sortedTweets) {
        const tweetId = tweet.id;
        const tweetText = tweet.text;
        const normalizedText = tweetText;
        
        // Detect !saturntrade <text> command (replaces !launch)
        const saturntradeMatch = tweetText.match(/!saturntrade\s+(.+?)(?:\n|$)/i);
        const isAutoLaunch = !!saturntradeMatch;
        const autoLaunchPrompt = isAutoLaunch ? saturntradeMatch[1].trim() : null;
        const username = tweet.author_username;
        const authorId = tweet.author_id;
        
        // Validate media URL - must be actual image URL, not t.co shortlink
        let mediaUrl = tweet.media_url; // Attached image from tweet
        if (mediaUrl) {
          // t.co links are redirects, not actual images - skip them
          if (mediaUrl.startsWith("https://t.co/") || mediaUrl.startsWith("http://t.co/")) {
            console.log(`[agent-scan-twitter] ⚠️ Skipping t.co shortlink for ${tweetId}: ${mediaUrl}`);
            mediaUrl = undefined;
          }
          // Only accept known image hosts
          else if (!mediaUrl.includes("pbs.twimg.com") && 
                   !mediaUrl.includes("abs.twimg.com") &&
                   !mediaUrl.includes("video.twimg.com") &&
                   !mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            console.log(`[agent-scan-twitter] ⚠️ Unknown image host for ${tweetId}: ${mediaUrl.slice(0, 60)}`);
            // Keep it but log warning - might still work
          }
        }

        // Layer 2: Expanded bot username blocklist
        const botUsernames = ["buildtuna", "tunalaunch", "tunabot", "tuna_launch", "build_tuna", "tunaagent", "saturntrade", "buildclaw", "saturntrade", "saturntrade_bot"];
        if (username && botUsernames.includes(username.toLowerCase())) {
          console.log(`[agent-scan-twitter] ⏭️ Skipping ${tweetId} - from bot account @${username}`);
          results.push({ tweetId, status: "skipped_bot_account" });
          continue;
        }

        // Layer 3: Reply content signature filter - skip tweets that look like our own replies
        const botReplySignatures = [
          "🐟 Hey @",
          "🐟 Token launched!",
          "🐟 To launch a token",
          "🐟 To launch your token",
          "🦞 Hey @",
          "🦞 Token launched!",
          "🦞 Trading Agent launched",
          "Powered by Saturn",
          "Trading-Fees goes to your Panel",
          "is now live on TUNA!",
          "claim them any time",
          "Trade it on saturntrade.com",
          "Snip snip",
        ];
        if (botReplySignatures.some(sig => tweetText.includes(sig))) {
          console.log(`[agent-scan-twitter] ⏭️ Skipping ${tweetId} - looks like a bot reply`);
          results.push({ tweetId, status: "skipped_bot_reply_content" });
          continue;
        }

        // Validate command presence - accept !saturntrade or auto-launch
        if (!normalizedText.toLowerCase().includes("!saturntrade") && !isAutoLaunch) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - no launch command`);
          results.push({ tweetId, status: "skipped_no_command" });
          continue;
        }

        // Check if already processed (double-check)
        const { data: existing } = await supabase
          .from("agent_social_posts")
          .select("id, status")
          .eq("platform", "twitter")
          .eq("post_id", tweetId)
          .maybeSingle();

        if (existing) {
          // ===== IN-LOOP CATCH-UP: DISABLED to prevent spam =====
          // Both "failed" help-reply catch-up and "completed" success-reply catch-up
          // have been disabled. The reply attempts fail (404/403) but never record
          // a twitter_bot_replies row, so they retry infinitely every scan cycle,
          // causing spam. If replies need to be retried, implement a separate
          // one-shot mechanism with a max-attempts counter.

          results.push({ tweetId, status: "already_processed" });
          continue;
        }

        // Skip tweets older than or equal to the last processed one (only if not already in DB)
        if (latestProcessedId && BigInt(tweetId) <= BigInt(latestProcessedId)) {
          console.log(`[agent-scan-twitter] Skipping ${tweetId} - older than last processed`);
          results.push({ tweetId, status: "skipped_already_seen" });
          continue;
        }

        // Check daily launch limit per X author (3 per day)
        if (authorId) {
          const launchesToday = await getAuthorLaunchesToday(supabase, authorId);
          if (launchesToday >= DAILY_LAUNCH_LIMIT_PER_AUTHOR) {
            console.log(`[agent-scan-twitter] @${username} (${authorId}) hit daily limit: ${launchesToday}/${DAILY_LAUNCH_LIMIT_PER_AUTHOR}`);
            
            // Record the attempt as rate-limited
            await supabase.from("agent_social_posts").insert({
              platform: "twitter",
              post_id: tweetId,
              post_url: `https://x.com/${username || "i"}/status/${tweetId}`,
              post_author: username,
              post_author_id: authorId,
              wallet_address: "unknown",
              raw_content: normalizedText.slice(0, 1000),
              status: "failed",
              error_message: "Daily limit of 3 Agent launches per X account reached",
              processed_at: new Date().toISOString(),
            });

            results.push({ tweetId, status: "rate_limited", error: "Daily limit reached" });

            // Reply with rate limit message
            if (canPostReplies) {
              const rateLimitText = `🦞 Hey @${username}! There is a daily limit of 3 Agent launches per X account.\n\nPlease try again tomorrow! 🌅`;
              
              const rateLimitReply = await replyToTweet(
                tweetId,
                rateLimitText,
                cookieCreds!,
                username
              );

              if (!rateLimitReply.success) {
                console.error(`[agent-scan-twitter] ❌ FAILED to send rate limit reply to @${username}:`, rateLimitReply.error);
              }
            }
            continue;
          }
        }

        // Process the tweet - include media URL if present
        if (mediaUrl) {
          console.log(`[agent-scan-twitter] 📷 Tweet ${tweetId} has attached image: ${mediaUrl.slice(0, 60)}...`);
        }
        
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/agent-process-post`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              platform: "twitter",
              postId: tweetId,
              postUrl: `https://x.com/${username || "i"}/status/${tweetId}`,
              postAuthor: username,
              postAuthorId: authorId,
              content: normalizedText,
              mediaUrl: mediaUrl || null,
              // !launch auto-generate fields
              ...(isAutoLaunch && autoLaunchPrompt ? {
                autoGenerate: true,
                generatePrompt: autoLaunchPrompt,
              } : {}),
            }),
          }
        );

        const processResult = await processResponse.json();

        if (processResult.success && processResult.mintAddress) {
          results.push({
            tweetId,
            status: "launched",
            mintAddress: processResult.mintAddress,
          });

          // Post success reply - PRE-CLAIM DEDUP (insert pending row first, unique constraint prevents race)
          if (canPostReplies) {
              const tokenSymbol = processResult.tokenSymbol || "TOKEN";
              const tokenName = processResult.tokenName || "Token";
              const viralTake = await generateClawViralTake(tokenName, tokenSymbol, normalizedText);
              const replyText = isAutoLaunch
                ? `🦞 Trading Agent launched on $SOL!\n\n$${tokenSymbol} - ${tokenName}\nCA: ${processResult.mintAddress}\n\n${viralTake}`
                : `🦞 Token launched on $SOL!\n\n$${tokenSymbol} - ${tokenName}\nCA: ${processResult.mintAddress}\n\n${viralTake}`;

              // PRE-CLAIM: Insert pending record BEFORE sending reply. Unique constraint on tweet_id prevents duplicates.
              const { error: claimError } = await supabase.from("twitter_bot_replies").insert({
                tweet_id: tweetId,
                tweet_author: username,
                tweet_text: normalizedText.slice(0, 500),
                reply_text: replyText.slice(0, 500),
                reply_id: `pending-${Date.now()}`,
              });

              if (claimError) {
                // Unique constraint violation = another function already claimed this tweet
                console.log(`[agent-scan-twitter] ⏭️ Skipping reply to ${tweetId} - already claimed (${claimError.code})`);
              } else {
                const replyResult = await replyToTweet(
                  tweetId,
                  replyText,
                  cookieCreds!,
                  username
                );

                if (!replyResult.success) {
                  console.error(`[agent-scan-twitter] ❌ FAILED to send launch success reply to @${username}:`, replyResult.error);
                } else if (replyResult.replyId) {
                  // Update with actual reply ID
                  await supabase.from("twitter_bot_replies").update({ reply_id: replyResult.replyId }).eq("tweet_id", tweetId);
                }
              }
          }
        } else {
          results.push({
            tweetId,
            status: "failed",
            error: processResult.error,
          });

          // Reply to user when launch is blocked (missing image, parse error, etc.)
          if (canPostReplies) {
            let errorReplyText: string | null = null;
            if (processResult.shouldReply && processResult.replyText) {
              errorReplyText = processResult.replyText;
            } else if (processResult.error?.includes("parse")) {
              errorReplyText = `🦞 Hey @${username}! To launch your token, please use this format:\n\n!saturntrade\nName: YourTokenName\nSymbol: $TICKER\n\nDon't forget to attach an image!`;
            }

            if (errorReplyText) {
              // PRE-CLAIM: Insert pending record first
              const { error: claimError } = await supabase.from("twitter_bot_replies").insert({
                tweet_id: tweetId,
                tweet_author: username,
                tweet_text: normalizedText.slice(0, 500),
                reply_text: errorReplyText.slice(0, 500),
                reply_id: `pending-${Date.now()}`,
              });

              if (claimError) {
                console.log(`[agent-scan-twitter] ⏭️ Skipping error reply to ${tweetId} - already claimed`);
              } else {
                const replyResult = await replyToTweet(tweetId, errorReplyText, cookieCreds!, username);
                if (!replyResult.success) {
                  console.error(`[agent-scan-twitter] ❌ FAILED to send error reply to @${username}:`, replyResult.error);
                } else {
                  console.log(`[agent-scan-twitter] ✅ Sent error reply to @${username}`);
                  if (replyResult.replyId) {
                    await supabase.from("twitter_bot_replies").update({ reply_id: replyResult.replyId }).eq("tweet_id", tweetId);
                  }
                }
              }
            }
          }
        }
      }

      // ========== CATCH-UP: Retry replies for completed launches that never got a reply ==========
      let catchUpReplied = 0;
      if (canPostReplies) {
        try {
          // Find completed launches from last 6 hours that have no twitter_bot_replies record
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
          const { data: unrepliedLaunches } = await supabase
            .from("agent_social_posts")
            .select("post_id, post_author, parsed_name, parsed_symbol, fun_token_id")
            .eq("status", "completed")
            .not("fun_token_id", "is", null)
            .gte("created_at", sixHoursAgo)
            .order("created_at", { ascending: true })
            .limit(5);

          if (unrepliedLaunches && unrepliedLaunches.length > 0) {
            for (const launch of unrepliedLaunches) {
              // Get mint address from fun_tokens
              const { data: tokenData } = await supabase
                .from("fun_tokens")
                .select("mint_address, name, ticker, image_url")
                .eq("id", launch.fun_token_id)
                .maybeSingle();

              if (!tokenData?.mint_address) continue;

              const catchupViralTake = await generateClawViralTake(tokenData.name || launch.parsed_name || "Token", tokenData.ticker || launch.parsed_symbol || "TOKEN", "!saturntrade catch-up launch");
              const replyText = `🦞 Token launched on $SOL!\n\n$${tokenData.ticker || launch.parsed_symbol || "TOKEN"} - ${tokenData.name || launch.parsed_name || "Token"}\nCA: ${tokenData.mint_address}\n\n${catchupViralTake}`;

              // PRE-CLAIM: Insert pending record first
              const { error: claimError } = await supabase.from("twitter_bot_replies").insert({
                tweet_id: launch.post_id,
                tweet_author: launch.post_author || "",
                tweet_text: `!saturntrade (catch-up)`,
                reply_text: replyText.slice(0, 500),
                reply_id: `pending-catchup-${Date.now()}`,
              });

              if (claimError) continue; // Already claimed

              console.log(`[agent-scan-twitter] 🔄 Catch-up reply for @${launch.post_author} tweet ${launch.post_id}`);

              const replyResult = await replyToTweet(
                launch.post_id,
                replyText,
                cookieCreds!,
                launch.post_author || ""
              );

              if (replyResult.success && replyResult.replyId) {
                await supabase.from("twitter_bot_replies").update({ reply_id: replyResult.replyId }).eq("tweet_id", launch.post_id);
                catchUpReplied++;
                console.log(`[agent-scan-twitter] ✅ Catch-up reply sent for ${launch.post_id}`);
              } else {
                console.error(`[agent-scan-twitter] ❌ Catch-up reply failed for ${launch.post_id}:`, replyResult.error);
              }
            }
          }
        } catch (catchUpErr) {
          console.error("[agent-scan-twitter] Catch-up error:", catchUpErr);
        }
      }

      console.log(`[agent-scan-twitter] Completed in ${Date.now() - startTime}ms (catch-up replies: ${catchUpReplied})`);

      return new Response(
        JSON.stringify({
          success: true,
          tweetsFound: tweets.length,
          results,
          rateLimited,
          searchMethod,
          catchUpReplied,
          durationMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      await supabase.from("cron_locks").delete().eq("lock_name", lockName);
    }
  } catch (error) {
    console.error("[agent-scan-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
