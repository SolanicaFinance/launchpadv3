import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY")!;
    const xAccountUsername = Deno.env.get("X_ACCOUNT_USERNAME")!;
    const xAccountEmail = Deno.env.get("X_ACCOUNT_EMAIL")!;
    const xAccountPassword = Deno.env.get("X_ACCOUNT_PASSWORD")!;
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    const proxyUrl = Deno.env.get("TWITTER_PROXY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { promotionId } = await req.json();

    if (!promotionId) {
      return new Response(
        JSON.stringify({ error: "promotionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get promotion with token details
    const { data: promotion, error: promotionError } = await supabase
      .from("token_promotions")
      .select(`
        id,
        fun_token_id,
        status,
        fun_tokens (
          id,
          name,
          ticker,
          mint_address,
          image_url,
          description
        )
      `)
      .eq("id", promotionId)
      .single();

    if (promotionError || !promotion) {
      return new Response(
        JSON.stringify({ error: "Promotion not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (promotion.status === "posted") {
      return new Response(
        JSON.stringify({ success: true, message: "Already posted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = promotion.fun_tokens as any;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token data not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use pre-authenticated cookies instead of login flow
    console.log("[promote-post] 🔐 Using pre-authenticated cookies...");
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0");
    
    if (!xAuthToken || !xCt0) {
      throw new Error("Missing X_AUTH_TOKEN or X_CT0 - please add pre-authenticated cookies");
    }

    const cookieObj = {
      auth_token: xAuthToken,
      ct0: xCt0,
    };
    const loginCookies = btoa(JSON.stringify(cookieObj));

    console.log("[promote-post] ✅ Using pre-auth cookies");

    // Build tweet text
    const description = token.description 
      ? token.description.slice(0, 100) + (token.description.length > 100 ? "..." : "")
      : "";
    
    const tradeLink = `https://axiom.trade/t/${token.mint_address}`;
    
    const tweetText = `🚀 PROMOTED TOKEN: ${token.name} ($${token.ticker})

${description}

📈 Trade now: ${tradeLink}
📋 CA: ${token.mint_address}

This is a paid promotion. DYOR.

#Solana #Memecoin #TUNA`;

    console.log("[promote-post] 📝 Posting tweet...");

    // Post tweet with image if available
    let tweetId: string | null = null;

    if (token.image_url) {
      // Post with image using post_tweets_media endpoint
      const mediaPostBody = {
        text: tweetText,
        medias: [
          {
            type: "image",
            url: token.image_url,
          },
        ],
        auth_session: {
          auth_token: xAuthToken,
          ct0: xCt0,
        },
        proxy: proxyUrl,
      };

      const postResponse = await fetch(`${TWITTERAPI_BASE}/twitter/tweets/post_tweets_media`, {
        method: "POST",
        headers: {
          "X-API-Key": twitterApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mediaPostBody),
      });

      const postText = await postResponse.text();
      const postData = safeJsonParse(postText);
      console.log("[promote-post] Media tweet response:", postText.slice(0, 500));

      if (postResponse.ok && postData?.tweet_id) {
        tweetId = postData.tweet_id;
      } else if (postResponse.ok && postData?.data?.tweet_id) {
        tweetId = postData.data.tweet_id;
      }
    }

    // Fallback to text-only tweet if image posting failed
    if (!tweetId) {
      const textPostBody = {
        text: tweetText,
        auth_session: {
          auth_token: xAuthToken,
          ct0: xCt0,
        },
        proxy: proxyUrl,
      };

      const postResponse = await fetch(`${TWITTERAPI_BASE}/twitter/post_tweet`, {
        method: "POST",
        headers: {
          "X-API-Key": twitterApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(textPostBody),
      });

      const postText = await postResponse.text();
      const postData = safeJsonParse(postText);
      console.log("[promote-post] Text tweet response:", postText.slice(0, 500));

      if (postResponse.ok) {
        tweetId = postData?.tweet_id || postData?.data?.rest_id || postData?.data?.id;
      }
    }

    if (tweetId) {
      // Update promotion status to posted
      await supabase.rpc("backend_update_promotion_status", {
        p_promotion_id: promotionId,
        p_status: "posted",
        p_twitter_post_id: tweetId,
      });

      console.log(`[promote-post] ✅ Tweet posted: ${tweetId}`);

      return new Response(
        JSON.stringify({
          success: true,
          tweetId,
          tweetUrl: `https://twitter.com/saturntrade/status/${tweetId}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Mark as failed
      await supabase.rpc("backend_update_promotion_status", {
        p_promotion_id: promotionId,
        p_status: "failed",
      });

      return new Response(
        JSON.stringify({ success: false, error: "Failed to post tweet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("[promote-post] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
