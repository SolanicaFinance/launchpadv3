import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
}

function buildLoginCookiesBase64(account: any): string | null {
  if (account.full_cookie_encrypted) {
    const cookies = parseCookieString(account.full_cookie_encrypted);
    if (Object.keys(cookies).length > 0) return btoa(JSON.stringify(cookies));
  }
  if (account.auth_token_encrypted && account.ct0_token_encrypted) {
    return btoa(JSON.stringify({
      auth_token: stripQuotes(account.auth_token_encrypted),
      ct0: stripQuotes(account.ct0_token_encrypted),
    }));
  }
  return null;
}

async function generateAnnouncementText(tweetAuthor: string, tokenName: string, tokenTicker: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return getDefaultText(tweetAuthor, tokenName, tokenTicker);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You write short, exciting crypto announcements for Saturn Terminal on X (Twitter). 
Keep it under 240 characters. No emojis. No hashtags. Professional but exciting tone.
You must convey these key points naturally:
- This tweet has been tokenized by Saturn Terminal
- The tweet owner gets 25% of all swap fees
- Every reply to this tweet also earns 25% of swap fees split among repliers
- Visit saturn.trade/meteorite to learn more

Vary the wording each time. Don't be robotic. Sound like a confident crypto founder announcing something cool.
Never use the exact same structure twice.`,
          },
          {
            role: "user",
            content: `Write an announcement reply for a tweet by @${tweetAuthor} that was just tokenized as $${tokenTicker} (${tokenName}). Keep it natural and varied.`,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text && text.length > 10 && text.length <= 280) return text;
    }
  } catch (e) {
    console.error("[meteorite-tweet-announce] AI generation failed:", e);
  }

  return getDefaultText(tweetAuthor, tokenName, tokenTicker);
}

function getDefaultText(author: string, name: string, ticker: string): string {
  const templates = [
    `This tweet by @${author} is now live as $${ticker} on Saturn Terminal.\n\nTweet owner earns 25% of swap fees. Every reply earns a share of another 25%.\n\nsaturn.trade/meteorite`,
    `$${ticker} just launched from this tweet.\n\n@${author} gets 25% of all trading fees. Repliers split another 25%.\n\nTokenize any tweet at saturn.trade/meteorite`,
    `${name} ($${ticker}) is now a tradeable token on Saturn Terminal.\n\nSwap fees flow back: 25% to @${author}, 25% split among repliers.\n\nsaturn.trade/meteorite`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tokenId } = await req.json();
    if (!tokenId) throw new Error("tokenId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get token details
    const { data: token, error } = await supabase
      .from("meteorite_tokens")
      .select("id, tweet_url, tweet_id, tweet_author, token_name, token_ticker, mint_address, status, announcement_tweet_id")
      .eq("id", tokenId)
      .single();

    if (error || !token) throw new Error("Token not found");
    if (token.status !== "live") throw new Error("Token not live yet");
    if (token.announcement_tweet_id) {
      return new Response(
        JSON.stringify({ alreadyAnnounced: true, tweetId: token.announcement_tweet_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!token.tweet_id) throw new Error("No tweet_id on token");

    // Get Saturnterminal bot account
    const { data: botAccount } = await supabase
      .from("x_bot_accounts")
      .select("*")
      .ilike("username", "saturnterminal")
      .eq("is_active", true)
      .single();

    if (!botAccount) throw new Error("Saturnterminal bot account not found or inactive");

    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!twitterApiKey) throw new Error("TWITTERAPI_IO_KEY not set");

    const loginCookiesB64 = buildLoginCookiesBase64(botAccount);
    if (!loginCookiesB64) throw new Error("No valid login cookies for Saturnterminal");

    // Generate announcement text
    const announcementText = await generateAnnouncementText(
      token.tweet_author || "the author",
      token.token_name || "Token",
      token.token_ticker || "TOKEN"
    );

    console.log(`[meteorite-tweet-announce] Replying to tweet ${token.tweet_id}: "${announcementText}"`);

    // Build proxy
    let proxy: string | undefined;
    if (botAccount.socks5_urls) {
      try {
        const socks5Urls = JSON.parse(botAccount.socks5_urls);
        if (Array.isArray(socks5Urls) && socks5Urls.length > 0) {
          const idx = botAccount.current_socks5_index || 0;
          proxy = socks5Urls[idx % socks5Urls.length];
        }
      } catch { /* no proxy */ }
    }

    // Post reply
    const body: Record<string, string> = {
      tweet_text: announcementText,
      reply_to_tweet_id: token.tweet_id,
      login_cookies: loginCookiesB64,
    };
    if (proxy) body.proxy = proxy;

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    console.log(`[meteorite-tweet-announce] Reply response: ${response.status} - ${rawText.slice(0, 300)}`);

    let replyTweetId: string | null = null;
    try {
      const data = JSON.parse(rawText);
      replyTweetId = data?.tweet_id || data?.data?.create_tweet?.tweet_results?.result?.rest_id || data?.data?.id || data?.id;
    } catch { /* parse error */ }

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} - ${rawText.slice(0, 200)}`);
    }

    // Save announcement tweet ID
    if (replyTweetId) {
      await supabase
        .from("meteorite_tokens")
        .update({ announcement_tweet_id: replyTweetId, updated_at: new Date().toISOString() })
        .eq("id", tokenId);
    }

    console.log(`[meteorite-tweet-announce] ✅ Announced token ${token.token_name} on tweet ${token.tweet_id}, reply: ${replyTweetId}`);

    return new Response(
      JSON.stringify({ success: true, replyTweetId, text: announcementText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-tweet-announce] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
