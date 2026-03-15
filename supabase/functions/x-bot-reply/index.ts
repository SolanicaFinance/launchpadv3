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

// Banned words — never reply TO tweets containing these, and never OUTPUT them
const BANNED_WORDS = ["rug", "rugpull", "rug pull", "scam", "scammer", "ponzi", "fraud", "honeypot", "honey pot"];
const BANNED_REGEX = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "gi");

function containsBannedWords(text: string): boolean {
  return BANNED_REGEX.test(text);
}

function stripBannedWords(text: string): string {
  return text.replace(BANNED_REGEX, "").replace(/\s{2,}/g, " ").trim();
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

// Generate reply text using AI
async function generateReply(
  tweetText: string,
  tweetAuthor: string,
  personaPrompt: string | null,
  accountName: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[x-bot-reply] LOVABLE_API_KEY not configured");
    return "";
  }

  const systemPrompt = personaPrompt || 
    `You are ${accountName}, a sharp crypto native / KOL on X (Twitter). ` +
    `You speak like a real degen trader — confident, opinionated, direct. ` +
    `Your replies sound like they come from someone who actually trades and follows the market closely.\n\n` +
    `STRICT RULES:\n` +
    `- NEVER use emojis. Zero emojis. Not a single one.\n` +
    `- NEVER use hashtags.\n` +
    `- NEVER use the words: rug, rugpull, scam, scammer, ponzi, fraud, honeypot. These words are completely banned.\n` +
    `- Keep it under 200 characters. Shorter is better.\n` +
    `- Sound like a real person, not a chatbot or customer service rep.\n` +
    `- Use lowercase when it feels natural. Don't over-capitalize.\n` +
    `- Be opinionated. Take a stance. Agree, disagree, add context.\n` +
    `- Reference specific things from the tweet to show you actually read it.\n` +
    `- Use slang naturally: "ngl", "tbh", "fr", "imo", "lowkey" — but don't force it.\n` +
    `- Sometimes be contrarian. Not every reply should agree.\n` +
    `- Vary your style: sometimes a quick one-liner, sometimes a short take with reasoning.\n` +
    `- Never start with "Great point" or "Interesting" or any generic opener.\n` +
    `- Never sound promotional or like you're trying to sell something.\n` +
    `- Stay positive or neutral about crypto projects. Never spread FUD or negativity.\n` +
    `- Write like you're texting a friend who's also in crypto, not writing a blog post.`;

  const userPrompt = `Tweet by @${tweetAuthor}:\n"${tweetText}"\n\nReply as a real crypto KOL would. No emojis. No negativity. Keep it raw and authentic:`;

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
        max_tokens: 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error [${response.status}]: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    let reply = data?.choices?.[0]?.message?.content?.trim() || "";

    // Clean up quotes if AI wraps in quotes
    if (reply.startsWith('"') && reply.endsWith('"')) {
      reply = reply.slice(1, -1);
    }

    // Strip ALL emojis as a hard safety net
    reply = reply.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "").trim();

    // Strip hashtags
    reply = reply.replace(/#\w+/g, "").trim();

    // Strip banned words as hard safety net
    reply = stripBannedWords(reply);

    // If after stripping the reply is too short or empty, discard
    if (reply.length < 5) return "";

    // Clean up double spaces left behind
    reply = reply.replace(/\s{2,}/g, " ").trim();

    // Truncate to 280 chars
    if (reply.length > 280) {
      reply = reply.substring(0, 277) + "...";
    }

    return reply;
  } catch (err) {
    console.error("[x-bot-reply] AI generation failed:", err);
    return "";
  }
}

// Post reply via twitterapi.io
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

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data: any;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

      console.log(`[x-bot-reply] Reply response: ${response.status} - ${rawText.slice(0, 300)}`);

      if (!response.ok || data.status === "error") {
        const apiMsg = data?.message || data?.error || rawText?.slice(0, 300);
        const isTransient = /429|5\d{2}/.test(String(response.status));
        if (!isTransient || attempt === 2) {
          return { success: false, error: apiMsg || `HTTP ${response.status}` };
        }
        await sleep(1000 * attempt);
        continue;
      }

      const replyId = data?.tweet_id || data?.data?.id;
      if (replyId) {
        return { success: true, replyId };
      }
      return { success: false, error: `No reply ID: ${rawText.slice(0, 200)}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
  return { success: false, error: "Retry exhausted" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");

    if (!twitterApiIoKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "TWITTERAPI_IO_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending queue items (oldest first, limit to 5 per invocation)
    const { data: queueItems, error: queueError } = await supabase
      .from("x_bot_account_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    if (queueError) throw queueError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No pending items", debug: { repliesSent: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique account IDs
    const accountIds = [...new Set(queueItems.map((q: any) => q.account_id))];

    // Fetch accounts and rules
    const { data: accounts } = await supabase
      .from("x_bot_accounts")
      .select("*")
      .in("id", accountIds)
      .eq("is_active", true);

    const { data: rules } = await supabase
      .from("x_bot_account_rules")
      .select("*")
      .in("account_id", accountIds)
      .eq("enabled", true);

    const accountMap = new Map<string, any>();
    for (const a of (accounts || [])) accountMap.set(a.id, a);
    const rulesMap = new Map<string, any>();
    for (const r of (rules || [])) rulesMap.set(r.account_id, r);

    let repliesSent = 0;
    let repliesFailed = 0;
    const postedThisRun = new Set<string>();

    for (const item of queueItems) {
      const account = accountMap.get(item.account_id);
      if (!account) {
        await supabase.from("x_bot_account_queue")
          .update({ status: "skipped", processed_at: new Date().toISOString() })
          .eq("id", item.id);
        continue;
      }

      // Hard cap: never allow more than one successful post per account in a single run
      if (postedThisRun.has(account.id)) {
        console.log(`[x-bot-reply] ⏭️ Already posted once this run for ${account.username}, deferring`);
        continue; // Keep pending
      }

      // ── Rate limit: max 1 successful reply per minute per account ──
      const { data: latestSent, error: latestSentError } = await supabase
        .from("x_bot_account_replies")
        .select("created_at")
        .eq("account_id", account.id)
        .eq("status", "sent")
        .not("created_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSentError) {
        console.error(`[x-bot-reply] Rate-limit lookup failed for ${account.username}:`, latestSentError.message);
        continue; // fail-safe: skip posting if we can't verify rate limit
      }

      if (latestSent?.created_at) {
        const msSinceLastSent = Date.now() - new Date(latestSent.created_at).getTime();
        if (msSinceLastSent < 60_000) {
          const waitMs = 60_000 - msSinceLastSent;
          console.log(`[x-bot-reply] ⏳ Rate limited ${account.username} — wait ${Math.ceil(waitMs / 1000)}s`);
          continue; // Keep pending so next invocation can process
        }
      }

      const accountRules = rulesMap.get(item.account_id);
      const loginCookiesB64 = buildLoginCookiesBase64(account);

      if (!loginCookiesB64) {
        console.error(`[x-bot-reply] No credentials for ${account.username}`);
        await supabase.from("x_bot_account_queue")
          .update({ status: "failed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        await supabase.from("x_bot_account_replies").insert({
          account_id: account.id,
          tweet_id: item.tweet_id,
          tweet_author: item.tweet_author,
          tweet_author_id: item.tweet_author_id,
          tweet_text: item.tweet_text,
          conversation_id: item.conversation_id,
          reply_type: item.match_type || "keyword",
          status: "failed",
          error_message: "No login credentials configured",
        });
        repliesFailed++;
        continue;
      }

      // Atomically claim queue item (prevents overlapping invocations from processing the same item)
      const { data: claimedItem, error: claimError } = await supabase
        .from("x_bot_account_queue")
        .update({ status: "processing" })
        .eq("id", item.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error(`[x-bot-reply] Failed to claim queue item ${item.id}:`, claimError.message);
        continue;
      }

      if (!claimedItem) {
        console.log(`[x-bot-reply] Queue item ${item.id} already claimed by another run`);
        continue;
      }

      // Skip tweets containing banned/toxic words — don't engage with negativity
      if (containsBannedWords(item.tweet_text || "")) {
        console.log(`[x-bot-reply] 🚫 Skipping toxic tweet from @${item.tweet_author}`);
        await supabase.from("x_bot_account_queue")
          .update({ status: "skipped", processed_at: new Date().toISOString() })
          .eq("id", item.id);
        continue;
      }

      // Generate reply text
      const replyText = await generateReply(
        item.tweet_text || "",
        item.tweet_author || "someone",
        accountRules?.persona_prompt || null,
        account.name
      );

      if (!replyText) {
        await supabase.from("x_bot_account_queue")
          .update({ status: "failed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        await supabase.from("x_bot_account_replies").insert({
          account_id: account.id,
          tweet_id: item.tweet_id,
          tweet_author: item.tweet_author,
          tweet_author_id: item.tweet_author_id,
          tweet_text: item.tweet_text,
          conversation_id: item.conversation_id,
          reply_type: item.match_type || "keyword",
          status: "failed",
          error_message: "AI reply generation failed",
        });
        repliesFailed++;
        continue;
      }

      // Pick proxy (support socks5 rotation)
      let proxy = account.proxy_url || undefined;
      const socks5Urls: string[] = account.socks5_urls || [];
      if (socks5Urls.length > 0) {
        const idx = account.current_socks5_index % socks5Urls.length;
        proxy = socks5Urls[idx];
        // Rotate index
        await supabase.from("x_bot_accounts")
          .update({ current_socks5_index: (idx + 1) % socks5Urls.length })
          .eq("id", account.id);
      }

      // Post the reply
      const result = await postReply(
        item.tweet_id,
        replyText,
        loginCookiesB64,
        twitterApiIoKey,
        proxy
      );

      const now = new Date().toISOString();

      if (result.success) {
        await supabase.from("x_bot_account_queue")
          .update({ status: "completed", processed_at: now })
          .eq("id", item.id);

        await supabase.from("x_bot_account_replies").insert({
          account_id: account.id,
          tweet_id: item.tweet_id,
          tweet_author: item.tweet_author,
          tweet_author_id: item.tweet_author_id,
          tweet_text: item.tweet_text,
          conversation_id: item.conversation_id,
          reply_id: result.replyId,
          reply_text: replyText,
          reply_type: item.match_type || "keyword",
          status: "sent",
        });

        await supabase.from("x_bot_account_logs").insert({
          account_id: account.id,
          log_type: "reply",
          level: "info",
          message: `Replied to @${item.tweet_author}: "${replyText.substring(0, 80)}..."`,
          details: { tweet_id: item.tweet_id, reply_id: result.replyId },
        });

        postedThisRun.add(account.id);
        repliesSent++;
        console.log(`[x-bot-reply] ✅ ${account.username} replied to @${item.tweet_author}`);
      } else {
        await supabase.from("x_bot_account_queue")
          .update({ status: "failed", processed_at: now })
          .eq("id", item.id);

        await supabase.from("x_bot_account_replies").insert({
          account_id: account.id,
          tweet_id: item.tweet_id,
          tweet_author: item.tweet_author,
          tweet_author_id: item.tweet_author_id,
          tweet_text: item.tweet_text,
          conversation_id: item.conversation_id,
          reply_text: replyText,
          reply_type: item.match_type || "keyword",
          status: "failed",
          error_message: result.error?.substring(0, 500),
        });

        await supabase.from("x_bot_account_logs").insert({
          account_id: account.id,
          log_type: "reply",
          level: "error",
          message: `Failed to reply to @${item.tweet_author}: ${result.error?.substring(0, 200)}`,
          details: { tweet_id: item.tweet_id, error: result.error },
        });

        repliesFailed++;
        console.error(`[x-bot-reply] ❌ ${account.username} failed: ${result.error}`);
      }

      // Delay between replies to avoid rate limiting
      await sleep(2000 + Math.random() * 1000);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[x-bot-reply] Done in ${elapsed}ms: ${repliesSent} sent, ${repliesFailed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        debug: { repliesSent, repliesFailed, processed: queueItems.length, elapsed },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[x-bot-reply] Fatal error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
