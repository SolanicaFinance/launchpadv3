import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Generate a conversational reply-back using AI
async function generateConvoReply(
  originalTweetText: string,
  theirReplyText: string,
  theirUsername: string,
  personaPrompt: string | null,
  accountName: string,
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "";

  const systemPrompt = personaPrompt ||
    `You are ${accountName}, a sharp crypto commentator. Someone replied to your tweet and you need to reply back naturally.`;

  const userPrompt = `Your original context was about a crypto topic. @${theirUsername} replied to you:
"${theirReplyText}"

Write a short, natural reply back (50-90 characters). Be conversational, keep the debate going. Ask a follow-up question or double down on your point. No emojis, no hashtags, no slang.

IMPORTANT: If their reply doesn't make sense, is gibberish, is just emojis, is completely off-topic, or the conversation has nowhere productive to go, respond with exactly "SKIP" and nothing else. Only continue conversations that are meaningful.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 80,
        temperature: 0.9,
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    let reply = data?.choices?.[0]?.message?.content?.trim() || "";

    // Clean quotes
    if (reply.startsWith('"') && reply.endsWith('"')) reply = reply.slice(1, -1);

    // Strip emojis and hashtags
    reply = reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();
    reply = reply.replace(/#\w+/g, "").trim();
    reply = reply.replace(/\s{2,}/g, " ").trim();

    if (reply.length < 10 || reply.length > 150) return "";
    return reply;
  } catch {
    return "";
  }
}

async function postReply(
  tweetId: string,
  text: string,
  loginCookiesB64: string,
  apiKey: string,
  proxy?: string
): Promise<{ success: boolean; replyId?: string; error?: string }> {
  const body: Record<string, string> = {
    tweet_text: text,
    reply_to_tweet_id: tweetId,
    login_cookies: loginCookiesB64,
  };
  if (proxy) body.proxy = proxy;

  try {
    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let data: any;
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!response.ok || data.status === "error") {
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }

    const replyId = data?.tweet_id || data?.data?.id;
    return replyId ? { success: true, replyId } : { success: false, error: "No reply ID" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");

    if (!twitterApiIoKey) {
      return new Response(JSON.stringify({ ok: false, error: "No API key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check global pause
    const { data: settings } = await supabase
      .from("x_bot_settings")
      .select("is_paused")
      .eq("id", "global")
      .maybeSingle();

    if (settings?.is_paused) {
      return new Response(JSON.stringify({ ok: true, paused: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active accounts with credentials
    const { data: accounts } = await supabase
      .from("x_bot_accounts")
      .select("*")
      .eq("is_active", true);

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allRules } = await supabase
      .from("x_bot_account_rules")
      .select("account_id, persona_prompt")
      .eq("enabled", true);

    const rulesMap = new Map<string, any>();
    for (const r of (allRules || [])) rulesMap.set(r.account_id, r);

    let repliedBack = 0;

    for (const account of accounts) {
      const loginCookiesB64 = buildLoginCookiesBase64(account);
      if (!loginCookiesB64) continue;

      const rules = rulesMap.get(account.id);

      // Find our recent sent replies (last 2 hours) that we haven't checked for responses yet
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: ourReplies } = await supabase
        .from("x_bot_account_replies")
        .select("id, tweet_id, reply_id, tweet_author, conversation_id")
        .eq("account_id", account.id)
        .eq("status", "sent")
        .not("reply_id", "is", null)
        .gte("created_at", cutoff)
        .limit(10);

      if (!ourReplies || ourReplies.length === 0) continue;

      // Count how many convo replies we've made per conversation (cap at 3-5)
      const MAX_CONVO_REPLIES = 4; // stop after ~4 reply-backs per thread
      const { data: existingConvoReplies } = await supabase
        .from("x_bot_account_replies")
        .select("conversation_id")
        .eq("account_id", account.id)
        .eq("reply_type", "convo_reply");

      // Count per conversation
      const convoReplyCounts = new Map<string, number>();
      for (const r of (existingConvoReplies || [])) {
        convoReplyCounts.set(r.conversation_id, (convoReplyCounts.get(r.conversation_id) || 0) + 1);
      }

      for (const ourReply of ourReplies) {
        if (!ourReply.reply_id) continue;
        // Skip if we've hit the max convo replies for this thread (3-5 cap)
        const convoCount = convoReplyCounts.get(ourReply.conversation_id) || 0;
        if (convoCount >= MAX_CONVO_REPLIES) {
          console.log(`[convo-monitor] ⏭️ Thread ${ourReply.conversation_id} capped at ${convoCount} replies`);
          continue;
        }

        try {
          // Fetch replies to our reply tweet
          const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
          searchUrl.searchParams.set("query", `conversation_id:${ourReply.conversation_id} to:${account.username}`);
          searchUrl.searchParams.set("queryType", "Latest");
          searchUrl.searchParams.set("count", "10");

          const searchResp = await fetch(searchUrl.toString(), {
            headers: { "X-API-Key": twitterApiIoKey },
          });

          if (!searchResp.ok) continue;

          const searchData = await searchResp.json();
          const replies = searchData?.tweets || [];

          // Find replies that are TO our reply (not from us)
          const theirReplies = replies.filter((t: any) =>
            t.author?.userName?.toLowerCase() !== account.username.toLowerCase() &&
            t.inReplyToId === ourReply.reply_id
          );

          if (theirReplies.length === 0) continue;

          // Take the first reply to respond to
          const targetReply = theirReplies[0];

          console.log(`[convo-monitor] Found reply from @${targetReply.author?.userName} to ${account.username}'s reply`);

          // Generate and post a reply-back
          const replyText = await generateConvoReply(
            "", // original context
            targetReply.text || "",
            targetReply.author?.userName || "",
            rules?.persona_prompt || null,
            account.name,
          );

          if (!replyText) continue;

          // Pick proxy
          let proxy = account.proxy_url || undefined;
          const socks5Urls: string[] = account.socks5_urls || [];
          if (socks5Urls.length > 0) {
            const idx = account.current_socks5_index % socks5Urls.length;
            proxy = socks5Urls[idx];
          }

          const result = await postReply(
            targetReply.id,
            replyText,
            loginCookiesB64,
            twitterApiIoKey,
            proxy,
          );

          if (result.success) {
            // Record the convo reply
            await supabase.from("x_bot_account_replies").insert({
              account_id: account.id,
              tweet_id: targetReply.id,
              tweet_author: targetReply.author?.userName || "",
              tweet_author_id: targetReply.author?.id || "",
              tweet_text: (targetReply.text || "").substring(0, 1000),
              conversation_id: ourReply.conversation_id,
              reply_id: result.replyId,
              reply_text: replyText,
              reply_type: "convo_reply",
              status: "sent",
            });

            await supabase.from("x_bot_account_logs").insert({
              account_id: account.id,
              log_type: "convo_reply",
              level: "info",
              message: `Replied back to @${targetReply.author?.userName} in conversation (thread deepening)`,
              details: { reply_id: result.replyId, their_tweet_id: targetReply.id },
            });

            repliedBack++;
            console.log(`[convo-monitor] ✅ ${account.username} replied back to @${targetReply.author?.userName}`);
          }

          // Rate limit: max 1 convo reply per account per run
          break;
        } catch (err) {
          console.error(`[convo-monitor] Error checking replies for ${account.username}:`, err);
        }

        await sleep(500);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, repliedBack }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error("[convo-monitor] Fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
