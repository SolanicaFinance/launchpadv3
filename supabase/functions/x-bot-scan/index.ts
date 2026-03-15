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

interface TweetResult {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  follower_count: number;
  is_verified: boolean;
  conversation_id: string;
  created_at: string;
}

async function searchTweets(
  query: string,
  apiKey: string
): Promise<TweetResult[]> {
  const searchUrl = new URL(`${TWITTERAPI_BASE}/twitter/tweet/advanced_search`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("queryType", "Latest");
  searchUrl.searchParams.set("count", "50");

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(searchUrl.toString(), {
      headers: { "X-API-Key": apiKey },
    });

    if (response.status === 429) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      console.warn(`[x-bot-scan] Rate limited, retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    const raw = await response.text();
    let data: any;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!response.ok || !data) {
      throw new Error(`twitterapi.io search failed [${response.status}]: ${raw?.slice(0, 200)}`);
    }

    const tweets: any[] = data?.tweets || [];
    return tweets.map((t: any) => ({
      id: t.id,
      text: t.text || "",
      author_id: t.author?.id || "",
      author_username: t.author?.userName || "",
      follower_count: t.author?.followers || 0,
      is_verified: !!(t.author?.isBlueVerified || t.author?.isVerified),
      conversation_id: t.conversationId || t.id,
      created_at: t.createdAt || new Date().toISOString(),
    }));
  }

  throw new Error("twitterapi.io rate limited after 3 retries");
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

    // Get active accounts with enabled rules
    const { data: accounts, error: accError } = await supabase
      .from("x_bot_accounts")
      .select("id, username, name")
      .eq("is_active", true);

    if (accError) throw accError;
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No active accounts", debug: { queued: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: allRules, error: rulesError } = await supabase
      .from("x_bot_account_rules")
      .select("*")
      .eq("enabled", true);

    if (rulesError) throw rulesError;

    const rulesMap = new Map<string, any>();
    for (const r of (allRules || [])) {
      rulesMap.set(r.account_id, r);
    }

    let totalQueued = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const rules = rulesMap.get(account.id);
      if (!rules) {
        console.log(`[x-bot-scan] Skipping ${account.username} - no enabled rules`);
        continue;
      }

      try {
        // Build search queries from rules
        const queries: string[] = [];

        const mentions: string[] = rules.monitored_mentions || [];
        for (const mention of mentions) {
          const clean = mention.startsWith("@") ? mention : `@${mention}`;
          queries.push(`${clean} -is:retweet`);
        }

        const cashtags: string[] = rules.tracked_cashtags || [];
        for (const tag of cashtags) {
          const clean = tag.startsWith("$") ? tag : `$${tag}`;
          queries.push(`${clean} -is:retweet`);
        }

        const keywords: string[] = rules.tracked_keywords || [];
        for (const kw of keywords) {
          queries.push(`${kw} -is:retweet`);
        }

        if (queries.length === 0) {
          console.log(`[x-bot-scan] Skipping ${account.username} - no search terms configured`);
          continue;
        }

        console.log(`[x-bot-scan] Scanning for ${account.username}: ${queries.length} queries`);

        // Get existing queued tweet IDs to avoid duplicates
        const { data: existingQueue } = await supabase
          .from("x_bot_account_queue")
          .select("tweet_id")
          .eq("account_id", account.id)
          .in("status", ["pending", "processing"]);

        const { data: existingReplies } = await supabase
          .from("x_bot_account_replies")
          .select("tweet_id")
          .eq("account_id", account.id);

        const existingIds = new Set([
          ...(existingQueue || []).map((q: any) => q.tweet_id),
          ...(existingReplies || []).map((r: any) => r.tweet_id),
        ]);

        // Check author cooldown
        const cooldownMinutes = rules.author_cooldown_minutes ?? (rules.author_cooldown_hours * 60) ?? 360;
        const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

        const { data: recentReplies } = await supabase
          .from("x_bot_account_replies")
          .select("tweet_author_id")
          .eq("account_id", account.id)
          .gte("created_at", cooldownCutoff);

        const cooledDownAuthors = new Set(
          (recentReplies || []).map((r: any) => r.tweet_author_id).filter(Boolean)
        );

        let accountQueued = 0;

        for (const query of queries) {
          try {
            const tweets = await searchTweets(query, twitterApiIoKey);
            console.log(`[x-bot-scan] Query "${query}" returned ${tweets.length} tweets`);

            for (const tweet of tweets) {
              // Skip already processed
              if (existingIds.has(tweet.id)) continue;

              // Skip own tweets
              if (tweet.author_username.toLowerCase() === account.username.toLowerCase()) continue;

              // Apply follower filter
              if (rules.min_follower_count && tweet.follower_count < rules.min_follower_count) continue;

              // Apply verification filter
              if (rules.require_blue_verified && !tweet.is_verified) continue;

              // Apply author cooldown
              if (tweet.author_id && cooledDownAuthors.has(tweet.author_id)) continue;

              // Check max replies per thread
              if (rules.max_replies_per_thread > 0) {
                const { count } = await supabase
                  .from("x_bot_account_replies")
                  .select("id", { count: "exact", head: true })
                  .eq("account_id", account.id)
                  .eq("conversation_id", tweet.conversation_id);

                if ((count || 0) >= rules.max_replies_per_thread) continue;
              }

              // Determine match type
              let matchType = "keyword";
              const textLower = tweet.text.toLowerCase();
              for (const m of mentions) {
                if (textLower.includes(m.toLowerCase().replace("@", ""))) {
                  matchType = "mention";
                  break;
                }
              }
              for (const c of cashtags) {
                if (textLower.includes(c.toLowerCase().replace("$", ""))) {
                  matchType = "cashtag";
                  break;
                }
              }

              // Queue the tweet
              const { error: insertError } = await supabase
                .from("x_bot_account_queue")
                .insert({
                  account_id: account.id,
                  tweet_id: tweet.id,
                  tweet_author: tweet.author_username,
                  tweet_author_id: tweet.author_id,
                  tweet_text: tweet.text.substring(0, 1000),
                  conversation_id: tweet.conversation_id,
                  follower_count: tweet.follower_count,
                  is_verified: tweet.is_verified,
                  match_type: matchType,
                  status: "pending",
                });

              if (insertError) {
                // Likely duplicate
                if (!insertError.message.includes("duplicate")) {
                  console.error(`[x-bot-scan] Queue insert error: ${insertError.message}`);
                }
              } else {
                existingIds.add(tweet.id);
                accountQueued++;
                totalQueued++;
              }
            }

            // Small delay between queries to avoid rate limiting
            await sleep(300);
          } catch (queryErr) {
            const msg = queryErr instanceof Error ? queryErr.message : String(queryErr);
            console.error(`[x-bot-scan] Query "${query}" failed: ${msg}`);
            errors.push(`${account.username}/${query}: ${msg}`);
          }
        }

        // Log scan result
        await supabase.from("x_bot_account_logs").insert({
          account_id: account.id,
          log_type: "scan",
          level: "info",
          message: `Scan completed: queued ${accountQueued} tweets from ${queries.length} queries`,
          details: { queued: accountQueued, queries: queries.length },
        });

        console.log(`[x-bot-scan] ${account.username}: queued ${accountQueued} tweets`);
      } catch (accountErr) {
        const msg = accountErr instanceof Error ? accountErr.message : String(accountErr);
        console.error(`[x-bot-scan] Account ${account.username} error: ${msg}`);
        errors.push(`${account.username}: ${msg}`);

        await supabase.from("x_bot_account_logs").insert({
          account_id: account.id,
          log_type: "scan",
          level: "error",
          message: `Scan failed: ${msg}`,
        });
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[x-bot-scan] Done in ${elapsed}ms: queued ${totalQueued} total`);

    return new Response(
      JSON.stringify({
        ok: true,
        debug: {
          queued: totalQueued,
          accounts: accounts.length,
          elapsed,
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[x-bot-scan] Fatal error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
