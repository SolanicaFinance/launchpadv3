// DISABLED — @clawmode bot scanning fully suspended
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, message: "Bot scanning is disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

/* ORIGINAL CODE BELOW — kept for reference but never reached */
// import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
const corsHeaders_original = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
*/

const TWITTERAPI_BASE = "https://api.twitterapi.io";

interface Tweet {
  id: string;
  text: string;
  author?: {
    userName?: string;
    id?: string;
    isBlueVerified?: boolean;
    isGoldVerified?: boolean;
    verified?: boolean;
    verifiedType?: string;
    followers?: number;
    followersCount?: number;
  };
  createdAt?: string;
  conversationId?: string;
  inReplyToTweetId?: string;
}

interface AccountWithRules {
  id: string;
  username: string;
  is_active: boolean;
  rules: {
    monitored_mentions: string[];
    tracked_cashtags: string[];
    tracked_keywords: string[];
    min_follower_count: number;
    require_blue_verified: boolean;
    require_gold_verified: boolean;
    enabled: boolean;
  } | null;
}

// Logging helper
async function insertLog(
  supabase: SupabaseClient,
  accountId: string,
  logType: string,
  level: string,
  message: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from("x_bot_account_logs").insert({
      account_id: accountId,
      log_type: logType,
      level,
      message,
      details,
    });
  } catch (e) {
    console.error("Failed to insert log:", e);
  }
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

async function searchTweets(apiKey: string, query: string): Promise<Tweet[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", `${query} -is:retweet -is:reply`);
  searchUrl.searchParams.set("queryType", "Latest");
  searchUrl.searchParams.set("count", "10"); // Limit to 10 results to save API credits

  try {
    const response = await fetchWithTimeout(
      searchUrl.toString(),
      { headers: { "X-API-Key": apiKey } },
      20000
    );

    if (!response.ok) {
      console.error("Search API error:", response.status);
      return [];
    }

    const data = await response.json();
    return data.tweets || [];
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

function isTweetAfterTimestamp(createdAt: string | undefined, lastScannedAt: string | null, maxAgeMinutes: number): boolean {
  if (!createdAt) return false;
  const tweetTime = new Date(createdAt).getTime();
  
  // If we have a last_scanned_at, only accept tweets after that time
  if (lastScannedAt) {
    const lastScanTime = new Date(lastScannedAt).getTime();
    return tweetTime > lastScanTime;
  }
  
  // Fallback: only tweets from last N minutes (for first scan)
  return Date.now() - tweetTime < maxAgeMinutes * 60 * 1000;
}

function isActuallyReply(tweet: Tweet, monitoredMentions: string[]): boolean {
  // If the API explicitly says it's a reply, trust that
  if (tweet.inReplyToTweetId) return true;
  
  const text = tweet.text.trim();
  // If tweet starts with @username, check if it's a monitored mention
  if (text.startsWith("@")) {
    const firstWord = text.split(/\s/)[0].toLowerCase();
    // It's NOT a reply if it starts with one of our monitored mentions
    const isMonitoredMention = monitoredMentions.some(m => 
      m.toLowerCase() === firstWord || m.toLowerCase() === firstWord.replace("@", "")
    );
    if (!isMonitoredMention) {
      return true; // Starting with @someone we don't monitor = probably a reply
    }
  }
  return false;
}

function hasVerificationBadge(tweet: Tweet, requireBlue: boolean, requireGold: boolean): boolean {
  const author = tweet.author;
  if (!author) return false;
  
  // If both are required, need to match at least one
  if (!requireBlue && !requireGold) return true; // No verification required
  
  const isBlue = author.isBlueVerified === true || author.verified === true;
  const isGold = author.isGoldVerified === true || 
    (author.verifiedType && ["gold", "business", "government"].includes(author.verifiedType.toLowerCase()));
  
  if (requireGold && isGold) return true;
  if (requireBlue && isBlue) return true;
  
  return false;
}

function getFollowerCount(tweet: Tweet): number {
  const author = tweet.author;
  if (!author) return 0;
  return author.followersCount || author.followers || 0;
}

function determineMentionType(text: string, mentions: string[], cashtags: string[], keywords: string[] = []): string {
  const textLower = text.toLowerCase();
  
  // Check cashtags first
  for (const tag of cashtags) {
    if (textLower.includes(tag.toLowerCase())) {
      return `cashtag:${tag}`;
    }
  }
  
  // Check mentions
  for (const mention of mentions) {
    if (textLower.includes(mention.toLowerCase())) {
      return `mention:${mention}`;
    }
  }
  
  // Check keywords
  for (const keyword of keywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      return `keyword:${keyword}`;
    }
  }
  
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const debug = { 
    accountsProcessed: 0, 
    tweetsSearched: 0, 
    queued: 0, 
    skipped: 0, 
    errors: [] as string[] 
  };

  let supabase: SupabaseClient | null = null;

  try {

    const ENABLE_PROMO_MENTIONS = Deno.env.get("ENABLE_PROMO_MENTIONS");
    const ENABLE_X_POSTING = Deno.env.get("ENABLE_X_POSTING");

    if (ENABLE_X_POSTING !== "true" || ENABLE_PROMO_MENTIONS !== "true") {
      return new Response(JSON.stringify({ ok: true, reason: "Kill switch disabled", debug }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWITTERAPI_IO_KEY = Deno.env.get("TWITTERAPI_IO_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!TWITTERAPI_IO_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Flush stale pending queue items older than 30 min so fresh tweets always get picked up
    await supabase
      .from("x_bot_account_queue")
      .delete()
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // Acquire lock
    const lockName = "x-bot-scan";
    await supabase.from("cron_locks").upsert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 110000).toISOString(),
    }, { onConflict: "lock_name" });

    // Get all active accounts with their rules
    const { data: accounts, error: accountsError } = await supabase
      .from("x_bot_accounts")
      .select(`
        id,
        username,
        is_active,
        last_scanned_at,
        x_bot_account_rules (
          monitored_mentions,
          tracked_cashtags,
          tracked_keywords,
          min_follower_count,
          require_blue_verified,
          require_gold_verified,
          enabled
        )
      `)
      .eq("is_active", true);

    if (accountsError) {
      debug.errors.push(`Accounts fetch error: ${accountsError.message}`);
      throw accountsError;
    }

    // Process each active account
    for (const account of accounts || []) {
      const rules = (account as any).x_bot_account_rules?.[0];
      if (!rules?.enabled) continue;

      debug.accountsProcessed++;
      const lastScannedAt = (account as any).last_scanned_at as string | null;
      const scanStartTime = new Date().toISOString();

      // Log scan start
      await insertLog(supabase, account.id, "scan", "info", `Starting scan for @${account.username}`);

      // Build search queries from mentions, cashtags, and keywords
      const mentions = rules.monitored_mentions || [];
      const cashtags = rules.tracked_cashtags || [];
      const keywords = rules.tracked_keywords || [];
      
      if (mentions.length === 0 && cashtags.length === 0 && keywords.length === 0) {
        await insertLog(supabase, account.id, "scan", "warn", "No mentions, cashtags, or keywords configured");
        continue;
      }

      // Build query parts - mentions and cashtags work as-is, keywords need quotes for exact matching
      const mentionQuery = mentions.map((m: string) => `(${m})`).join(" OR ");
      const cashtagQuery = cashtags.map((t: string) => `(${t})`).join(" OR ");
      const keywordQuery = keywords.map((k: string) => `("${k}")`).join(" OR ");
      const fullQuery = [mentionQuery, cashtagQuery, keywordQuery].filter(Boolean).join(" OR ");

      if (!fullQuery) continue;

      const tweets = await searchTweets(TWITTERAPI_IO_KEY, fullQuery);
      debug.tweetsSearched += tweets.length;

      await insertLog(supabase, account.id, "scan", "info", `Found ${tweets.length} tweets matching query`, {
        query: fullQuery.substring(0, 200),
        tweetCount: tweets.length,
      });

      let queuedCount = 0;
      let skippedCount = 0;

      for (const tweet of tweets) {
        const author = tweet.author?.userName || "unknown";
        const followers = getFollowerCount(tweet);

        // Determine if this tweet is a direct @clawmode mention (bypass filters)
        const isDirectMention = tweet.text.toLowerCase().includes("@clawmode");

        // Skip tweets older than last scan (or 30 min for first scan)
        if (!isTweetAfterTimestamp(tweet.createdAt, lastScannedAt, 30)) {
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Skip replies (pass monitored mentions to allow tweets starting with them)
        if (isActuallyReply(tweet, mentions)) {
          await insertLog(supabase, account.id, "skip", "info", `Skipped @${author}: tweet is a reply`, {
            tweetId: tweet.id,
            inReplyToTweetId: tweet.inReplyToTweetId || null,
          });
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Check verification requirements (skip for direct @clawmode mentions)
        if (!isDirectMention && !hasVerificationBadge(tweet, rules.require_blue_verified, rules.require_gold_verified)) {
          await insertLog(supabase, account.id, "skip", "info", `Skipped @${author}: verification not met`, {
            tweetId: tweet.id,
            requireBlue: rules.require_blue_verified,
            requireGold: rules.require_gold_verified,
          });
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Check follower count (skip for direct @clawmode mentions)
        if (!isDirectMention && followers < (rules.min_follower_count || 5000)) {
          await insertLog(supabase, account.id, "skip", "info", `Skipped @${author}: ${followers.toLocaleString()} followers < ${rules.min_follower_count.toLocaleString()} min`, {
            tweetId: tweet.id,
            followers,
            minRequired: rules.min_follower_count,
          });
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Skip own tweets
        const username = tweet.author?.userName?.toLowerCase() || "";
        if (username === account.username.toLowerCase()) {
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Skip tweets with !clawmode - those are token launches, not conversation targets
        if (tweet.text.toLowerCase().includes("!clawmode")) {
          await insertLog(supabase, account.id, "skip", "info", `Skipped @${author}: contains !clawmode launch command`, {
            tweetId: tweet.id,
          });
          debug.skipped++;
          skippedCount++;
          continue;
        }

        // Check if already in queue
        const { data: existingQueue } = await supabase
          .from("x_bot_account_queue")
          .select("id")
          .eq("account_id", account.id)
          .eq("tweet_id", tweet.id)
          .single();

        if (existingQueue) continue;

        // Check if already replied
        const { data: existingReply } = await supabase
          .from("x_bot_account_replies")
          .select("id")
          .eq("account_id", account.id)
          .eq("tweet_id", tweet.id)
          .single();

        if (existingReply) continue;

        // Add to queue
        const matchType = determineMentionType(tweet.text, mentions, cashtags, keywords);
        const { error: insertError } = await supabase.from("x_bot_account_queue").insert({
          account_id: account.id,
          tweet_id: tweet.id,
          tweet_author: tweet.author?.userName || null,
          tweet_author_id: tweet.author?.id || null,
          tweet_text: tweet.text.substring(0, 500),
          conversation_id: tweet.conversationId || tweet.id,
          follower_count: followers,
          is_verified: true,
          match_type: matchType,
          status: "pending",
        });

        if (!insertError) {
          debug.queued++;
          queuedCount++;
          await insertLog(supabase, account.id, "match", "info", `Queued @${author} tweet (${matchType})`, {
            tweetId: tweet.id,
            matchType,
            followers,
            tweetPreview: tweet.text.substring(0, 100),
          });
        } else {
          debug.errors.push(`Insert error: ${insertError.message}`);
          await insertLog(supabase, account.id, "error", "error", `Failed to queue tweet: ${insertError.message}`, {
            tweetId: tweet.id,
          });
        }
      }

      // Update last_scanned_at timestamp for this account
      await supabase
        .from("x_bot_accounts")
        .update({ last_scanned_at: scanStartTime })
        .eq("id", account.id);

      // Log scan summary
      await insertLog(supabase, account.id, "scan", "info", `Scan complete: ${queuedCount} queued, ${skippedCount} skipped`, {
        queued: queuedCount,
        skipped: skippedCount,
        lastScannedAt: scanStartTime,
      });
    }

    // Cleanup old queue entries (older than 2 hours)
    await supabase
      .from("x_bot_account_queue")
      .delete()
      .lt("created_at", new Date(Date.now() - 7200000).toISOString());

    // Cleanup old logs (older than 7 days)
    await supabase
      .from("x_bot_account_logs")
      .delete()
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

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
