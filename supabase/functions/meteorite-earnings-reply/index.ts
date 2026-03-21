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

// Check if a mention is asking about tweet earnings
function isEarningsQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const earningsKeywords = [
    "how much", "earned", "earnings", "fees", "revenue", "made",
    "profit", "generated", "collected", "accumulate", "total",
    "swap fees", "trading fees", "how many sol",
  ];
  return earningsKeywords.some(kw => lower.includes(kw));
}

// Check if someone is asking about a non-tokenized tweet  
function isTokenizeQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("tokenize") || lower.includes("tokenise") || lower.includes("token") || lower.includes("meteorite");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");

    if (!twitterApiKey) throw new Error("TWITTERAPI_IO_KEY not set");

    // This function is called by a cron or scanner that passes mention data
    const { mentionTweetId, mentionText, mentionAuthor, conversationTweetId, conversationTweetUrl } = await req.json();

    if (!mentionTweetId || !mentionText) {
      throw new Error("mentionTweetId and mentionText required");
    }

    console.log(`[meteorite-earnings-reply] Processing mention from @${mentionAuthor}: "${mentionText.slice(0, 100)}"`);

    // Check if this is an earnings query
    if (!isEarningsQuery(mentionText)) {
      console.log("[meteorite-earnings-reply] Not an earnings query, skipping");
      return new Response(
        JSON.stringify({ skipped: true, reason: "not_earnings_query" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the meteorite token for this conversation thread
    // The conversation tweet ID is the original tweet that was tokenized
    let token: any = null;

    if (conversationTweetId) {
      const { data } = await supabase
        .from("meteorite_tokens")
        .select("id, tweet_url, tweet_id, tweet_author, token_name, token_ticker, mint_address, total_fees_earned, status, owner_claimed_sol, eligible_replies_count")
        .eq("tweet_id", conversationTweetId)
        .eq("status", "live")
        .single();
      token = data;
    }

    if (!token && conversationTweetUrl) {
      const { data } = await supabase
        .from("meteorite_tokens")
        .select("id, tweet_url, tweet_id, tweet_author, token_name, token_ticker, mint_address, total_fees_earned, status, owner_claimed_sol, eligible_replies_count")
        .eq("tweet_url", conversationTweetUrl)
        .eq("status", "live")
        .single();
      token = data;
    }

    // Generate appropriate reply
    let replyText: string;

    if (!token) {
      // Tweet is not tokenized
      replyText = `This tweet hasn't been tokenized yet. You can tokenize any tweet and start earning swap fees at saturn.trade/meteorite`;
      console.log("[meteorite-earnings-reply] Tweet not tokenized, sending info reply");
    } else {
      // Tweet IS tokenized — show real data
      const totalFees = Number(token.total_fees_earned || 0);
      const ownerShare = (totalFees * 0.25).toFixed(4);
      const replierPool = (totalFees * 0.25).toFixed(4);
      const ownerClaimed = Number(token.owner_claimed_sol || 0).toFixed(4);
      const replierCount = token.eligible_replies_count || 0;

      // Use AI for natural response
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
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
                  content: `You are Saturn Terminal's assistant on X. Someone asked about the earnings of a tokenized tweet. 
Respond naturally with the real data provided. Keep it under 240 chars. No emojis. No hashtags. 
Be direct and data-driven. Sound like a confident crypto platform.`,
                },
                {
                  role: "user",
                  content: `@${mentionAuthor} asked about earnings for $${token.token_ticker} (${token.token_name}).
Real data:
- Total swap fees earned: ${totalFees.toFixed(4)} SOL
- Owner share (25%): ${ownerShare} SOL (claimed: ${ownerClaimed} SOL)
- Replier pool (25%): ${replierPool} SOL across ${replierCount} eligible repliers
- Token CA: ${token.mint_address}
- Trade at: pump.fun/${token.mint_address}

Write a concise reply with these real numbers.`,
                },
              ],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const aiText = data.choices?.[0]?.message?.content?.trim();
            if (aiText && aiText.length > 10 && aiText.length <= 280) {
              replyText = aiText;
            } else {
              replyText = `$${token.token_ticker} has earned ${totalFees.toFixed(4)} SOL in swap fees so far.\n\nOwner share: ${ownerShare} SOL\nReplier pool: ${replierPool} SOL (${replierCount} eligible)\n\npump.fun/${token.mint_address}`;
            }
          } else {
            replyText = `$${token.token_ticker} has earned ${totalFees.toFixed(4)} SOL in swap fees.\n\nOwner: ${ownerShare} SOL | Repliers: ${replierPool} SOL (${replierCount} eligible)\n\npump.fun/${token.mint_address}`;
          }
        } catch {
          replyText = `$${token.token_ticker}: ${totalFees.toFixed(4)} SOL in fees. Owner: ${ownerShare} SOL, Repliers: ${replierPool} SOL.\n\npump.fun/${token.mint_address}`;
        }
      } else {
        replyText = `$${token.token_ticker} has earned ${totalFees.toFixed(4)} SOL in swap fees.\n\nOwner: ${ownerShare} SOL | Repliers: ${replierPool} SOL\n\npump.fun/${token.mint_address}`;
      }

      console.log(`[meteorite-earnings-reply] Token found: ${token.token_name}, fees: ${totalFees} SOL`);
    }

    // Get Saturnterminal bot account
    const { data: botAccount } = await supabase
      .from("x_bot_accounts")
      .select("*")
      .ilike("username", "saturnterminal")
      .eq("is_active", true)
      .single();

    if (!botAccount) throw new Error("Saturnterminal bot account not found");

    const loginCookiesB64 = buildLoginCookiesBase64(botAccount);
    if (!loginCookiesB64) throw new Error("No valid login cookies");

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
      tweet_text: replyText,
      reply_to_tweet_id: mentionTweetId,
      login_cookies: loginCookiesB64,
    };
    if (proxy) body.proxy = proxy;

    console.log(`[meteorite-earnings-reply] Posting reply to ${mentionTweetId}: "${replyText.slice(0, 100)}..."`);

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": twitterApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    console.log(`[meteorite-earnings-reply] Reply response: ${response.status} - ${rawText.slice(0, 300)}`);

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} - ${rawText.slice(0, 200)}`);
    }

    let replyTweetId: string | null = null;
    try {
      const data = JSON.parse(rawText);
      replyTweetId = data?.tweet_id || data?.data?.create_tweet?.tweet_results?.result?.rest_id || data?.data?.id;
    } catch { /* */ }

    return new Response(
      JSON.stringify({ success: true, replyTweetId, replyText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-earnings-reply] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
