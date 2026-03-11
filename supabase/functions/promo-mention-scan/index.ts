import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BOT_USERNAMES = new Set([
  "saturntrade", "moltbook", "saturntrade",
]);

interface Tweet {
  id: string;
  text: string;
  authorUsername: string;
  authorId: string;
  createdAt?: string;
  conversationId?: string;
  inReplyToTweetId?: string;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Search using Official X API v2 with Bearer Token (same as agent-scan-twitter)
async function searchMentions(bearerToken: string): Promise<Tweet[]> {
  const searchUrl = new URL("https://api.x.com/2/tweets/search/recent");
  // Search for mentions of our accounts - no -is:reply so we catch reply mentions too
  searchUrl.searchParams.set("query", "(@moltbook OR @saturntrade OR @saturntrade) -is:retweet");
  searchUrl.searchParams.set("max_results", "20");
  searchUrl.searchParams.set("tweet.fields", "created_at,author_id,conversation_id,in_reply_to_user_id,referenced_tweets");
  searchUrl.searchParams.set("expansions", "author_id");
  searchUrl.searchParams.set("user.fields", "username");

  try {
    const response = await fetchWithTimeout(
      searchUrl.toString(),
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      20000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[promo-mention-scan] X API error:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    const rawTweets = data.data || [];
    const users = data.includes?.users || [];

    // Build username map from includes
    const userMap: Record<string, string> = {};
    for (const user of users) {
      userMap[user.id] = user.username;
    }

    // Map to our Tweet interface
    return rawTweets.map((t: any) => ({
      id: t.id,
      text: t.text,
      authorUsername: userMap[t.author_id] || "",
      authorId: t.author_id || "",
      createdAt: t.created_at,
      conversationId: t.conversation_id || t.id,
      inReplyToTweetId: t.referenced_tweets?.find((r: any) => r.type === "replied_to")?.id || null,
    }));
  } catch (e) {
    console.error("[promo-mention-scan] Search error:", e);
    return [];
  }
}

function determineMentionType(text: string): string {
  const hasMoltbook = text.toLowerCase().includes("@moltbook");
  const hasOpenclaw = text.toLowerCase().includes("@saturntrade");
  const hasClawmode = text.toLowerCase().includes("@saturntrade");
  
  const count = [hasMoltbook, hasOpenclaw, hasClawmode].filter(Boolean).length;
  if (count > 2) return "multiple";
  if (hasMoltbook && hasOpenclaw) return "both";
  if (hasMoltbook) return "moltbook";
  if (hasOpenclaw) return "saturntrade";
  if (hasClawmode) return "saturntrade";
  return "saturntrade";
}

// Check if tweet has meaningful text beyond just mentions/URLs/whitespace
function hasMeaningfulText(text: string): boolean {
  // Strip @mentions, URLs, hashtags, and whitespace
  const stripped = text
    .replace(/@\w+/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\w+/g, "")
    .replace(/[!\?\.\,\s]+/g, "")
    .trim();
  return stripped.length >= 3;
}

function isRecentTweet(createdAt: string | undefined, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  return Date.now() - tweetTime < maxAgeMinutes * 60 * 1000;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = { tweetsSearched: 0, queued: 0, skipped: 0, errors: [] as string[], searchMethod: "official_x_api" };

  try {

    const ENABLE_PROMO_MENTIONS = Deno.env.get("ENABLE_PROMO_MENTIONS");
    const ENABLE_X_POSTING = Deno.env.get("ENABLE_X_POSTING");

    if (ENABLE_X_POSTING !== "true" || ENABLE_PROMO_MENTIONS !== "true") {
      return new Response(JSON.stringify({ ok: true, reason: "Kill switch disabled", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const X_BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!X_BEARER_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "Missing X_BEARER_TOKEN" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Skip scan if queue already has 5+ pending items
    const { count: pendingCount } = await supabase
      .from("promo_mention_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (pendingCount && pendingCount >= 5) {
      return new Response(JSON.stringify({ ok: true, reason: "Queue has 5+ pending items, skipping scan", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Acquire lock
    const lockName = "promo-mention-scan";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 110000).toISOString(),
    }, { onConflict: "lock_name" });

    // Cleanup old queue entries
    await supabase.from("promo_mention_queue").delete().lt("created_at", new Date(Date.now() - 3600000).toISOString());

    // Search for mentions using Official X API
    const tweets = await searchMentions(X_BEARER_TOKEN);
    debug.tweetsSearched = tweets.length;
    console.log(`[promo-mention-scan] Found ${tweets.length} tweets via Official X API`);

    for (const tweet of tweets) {
      // Skip old tweets (only last 30 minutes)
      if (!isRecentTweet(tweet.createdAt, 30)) {
        debug.skipped++;
        continue;
      }

      const username = tweet.authorUsername.toLowerCase();
      if (BOT_USERNAMES.has(username)) {
        debug.skipped++;
        continue;
      }

      // Skip tweets with no meaningful text (just mentions, images, URLs)
      if (!hasMeaningfulText(tweet.text)) {
        debug.skipped++;
        console.log(`[promo-mention-scan] Skipped tweet ${tweet.id} — no meaningful text`);
        continue;
      }

      // Check if already in queue or already replied
      const { data: existingQueue } = await supabase
        .from("promo_mention_queue")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (existingQueue) continue;

      const { data: existingReply } = await supabase
        .from("promo_mention_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (existingReply) continue;

      const { data: botReplied } = await supabase
        .from("twitter_bot_replies")
        .select("id")
        .eq("tweet_id", tweet.id)
        .single();

      if (botReplied) continue;

      // Add to queue
      const { error: insertError } = await supabase.from("promo_mention_queue").insert({
        tweet_id: tweet.id,
        tweet_author: tweet.authorUsername || null,
        tweet_author_id: tweet.authorId || null,
        tweet_text: tweet.text.substring(0, 500),
        conversation_id: tweet.conversationId || tweet.id,
        mention_type: determineMentionType(tweet.text),
        follower_count: 0, // Official API doesn't return follower count in search
        is_verified: false, // Not available in basic search response
        tweet_created_at: tweet.createdAt || null,
        status: "pending",
      });

      if (!insertError) {
        debug.queued++;
        console.log(`[promo-mention-scan] Queued tweet ${tweet.id} from @${tweet.authorUsername}`);
      } else {
        debug.errors.push(`Insert error for ${tweet.id}: ${insertError.message}`);
      }
    }

    // Release lock
    await supabase.from("cron_locks").delete().eq("lock_name", lockName);

    return new Response(JSON.stringify({ ok: true, debug }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    debug.errors.push(e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ ok: false, debug }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
