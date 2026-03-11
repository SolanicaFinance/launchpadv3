import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

// Get authenticated user ID
async function getAuthenticatedUserId(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): Promise<string | null> {
  const url = "https://api.x.com/2/users/me";
  
  const oauthHeader = generateOAuthHeader(
    "GET",
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  const response = await fetch(url, {
    headers: { Authorization: oauthHeader },
  });

  if (!response.ok) {
    console.error("[agent-scan-mentions] Failed to get user ID:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.data?.id || null;
}

// Fetch mentions of @saturntrade using official X.com API
async function fetchMentions(
  userId: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
  sinceId?: string
): Promise<Array<{
  id: string;
  text: string;
  author_id: string;
  author_username?: string;
}>> {
  const baseUrl = `https://api.x.com/2/users/${userId}/mentions`;
  const params = new URLSearchParams({
    max_results: "100",
    "tweet.fields": "author_id,created_at,text",
    expansions: "author_id",
    "user.fields": "username",
  });
  
  if (sinceId) {
    params.set("since_id", sinceId);
  }

  const url = `${baseUrl}?${params.toString()}`;
  
  const oauthHeader = generateOAuthHeader(
    "GET",
    baseUrl,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  const response = await fetch(url, {
    headers: { Authorization: oauthHeader },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[agent-scan-mentions] Mentions fetch failed:", error);
    return [];
  }

  const data = await response.json();
  const tweets = data.data || [];
  const users = data.includes?.users || [];

  return tweets.map((tweet: { id: string; text: string; author_id: string }) => {
    const author = users.find((u: { id: string }) => u.id === tweet.author_id);
    return {
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      author_username: author?.username,
    };
  });
}

// Reply to a tweet
async function replyToTweet(
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

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json();
    return { success: true, replyId: data.data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Official X.com API credentials
    const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      console.log("[agent-scan-mentions] Twitter credentials not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twitter credentials not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Emergency kill-switch: disable ALL X posting/replying unless explicitly enabled.
    const postingEnabled = Deno.env.get("ENABLE_X_POSTING") === "true";
    if (!postingEnabled) {
      console.log("[agent-scan-mentions] 🚫 X posting disabled (ENABLE_X_POSTING != true) - skipping entirely");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "posting_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      console.warn(`[agent-scan-mentions] ⚠️ Burst limit reached: ${repliesLastMinute} replies in last minute (max 20)`);
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
      console.warn(`[agent-scan-mentions] ⚠️ Hourly limit reached: ${repliesLastHour} replies in last hour (max 300)`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "hourly_rate_limit", repliesLastHour }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-scan-mentions] 📊 Rate check: ${repliesLastMinute || 0}/20 per min, ${repliesLastHour || 0}/300 per hour`);

    // Acquire lock to prevent concurrent runs
    const lockName = "agent-scan-mentions-lock";
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Clean up expired locks
    await supabase.from("cron_locks").delete().lt("expires_at", new Date().toISOString());

    const { error: lockError } = await supabase.from("cron_locks").insert({
      lock_name: lockName,
      expires_at: lockExpiry,
    });

    if (lockError) {
      console.log("[agent-scan-mentions] Another instance running, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "lock held" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      // Get our bot's user ID
      const userId = await getAuthenticatedUserId(
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      );

      if (!userId) {
        throw new Error("Failed to get authenticated user ID");
      }

      // ===== STANDALONE CATCH-UP: completed launches missing replies =====
      {
        const catchUpCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: unrepliedPosts } = await supabase
          .from("agent_social_posts")
          .select("id, post_id, post_author, fun_token_id, parsed_name, parsed_symbol")
          .eq("platform", "twitter")
          .eq("status", "completed")
          .gt("created_at", catchUpCutoff)
          .not("fun_token_id", "is", null)
          .limit(5);

        if (unrepliedPosts && unrepliedPosts.length > 0) {
          console.log(`[agent-scan-mentions] 🔍 Checking ${unrepliedPosts.length} completed posts for missing replies`);
          for (const post of unrepliedPosts) {
            const { data: alreadyReplied } = await supabase
              .from("twitter_bot_replies")
              .select("id")
              .eq("tweet_id", post.post_id)
              .maybeSingle();

            if (alreadyReplied) continue;

            const { data: tokenData } = await supabase
              .from("fun_tokens")
              .select("mint_address, name, ticker")
              .eq("id", post.fun_token_id!)
              .single();

            if (!tokenData?.mint_address) continue;

            const tokenName = tokenData.name || post.parsed_name || "Token";
            const tokenTicker = tokenData.ticker || post.parsed_symbol || "TOKEN";
            const catchUpReplyText = `🦞 Token launched on $SOL!\n\n$${tokenTicker} - ${tokenName}\nCA: ${tokenData.mint_address}\n\nPowered by Claw Agents - 80% of fees go to you! Launch your token on saturn.trade`;

            const catchUpResult = await replyToTweet(
              post.post_id,
              catchUpReplyText,
              consumerKey,
              consumerSecret,
              accessToken,
              accessTokenSecret,
            );

            if (catchUpResult.success && catchUpResult.replyId) {
              await supabase.from("twitter_bot_replies").insert({
                tweet_id: post.post_id,
                tweet_author: post.post_author,
                tweet_text: "(standalone catch-up)",
                reply_text: catchUpReplyText.slice(0, 500),
                reply_id: catchUpResult.replyId,
              });
              console.log(`[agent-scan-mentions] ✅ STANDALONE catch-up reply sent for ${post.post_id}`);
            } else {
              console.warn(`[agent-scan-mentions] ❌ Standalone catch-up reply failed for ${post.post_id}: ${catchUpResult.error}`);
            }
          }
        }
      }

      console.log(`[agent-scan-mentions] Fetching mentions for user ${userId}`);

      // Fetch recent mentions
      const mentions = await fetchMentions(
        userId,
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret
      );

      console.log(`[agent-scan-mentions] Found ${mentions.length} mentions`);

      const results: Array<{
        tweetId: string;
        status: string;
        mintAddress?: string;
        error?: string;
      }> = [];

      for (const mention of mentions) {
        const username = mention.author_username;
        const tweetId = mention.id;
        const tweetText = mention.text;
        const authorId = mention.author_id;
        
        // Layer 2: Expanded bot username blocklist
        const botUsernames = ["buildtuna", "tunalaunch", "tunabot", "tuna_launch", "build_tuna", "tunaagent", "saturntrade", "buildclaw", "saturntrade", "saturntrade_bot"];
        if (username && botUsernames.includes(username.toLowerCase())) {
          console.log(`[agent-scan-mentions] ⏭️ Skipping ${tweetId} - from bot account @${username}`);
          continue;
        }

        // Layer 3: Reply content signature filter - skip tweets that look like our own replies
        const botReplySignatures = [
          "🐟 Hey @",
          "🐟 Token launched!",
          "🐟 To launch a token",
          "🐟 To launch your token",
          "Powered by Claw Agents",
          "Powered by TUNA Agents",
          "is now live on Saturn!",
          "is now live on TUNA!",
          "80% of fees go to you",
        ];
        if (botReplySignatures.some(sig => tweetText.includes(sig))) {
          console.log(`[agent-scan-mentions] ⏭️ Skipping ${tweetId} - looks like a bot reply`);
          continue;
        }

        // Check if contains launch command (!saturntrade only)
        const hasLaunchCommand = tweetText.toLowerCase().includes("!saturntrade");
        const saturntradeMatch = tweetText.match(/!saturntrade\s+(.+?)(?:\n|$)/i);
        const isAutoLaunch = !!saturntradeMatch;
        const autoLaunchPrompt = isAutoLaunch ? saturntradeMatch[1].trim() : null;
        
        if (!hasLaunchCommand) {
          continue;
        }

        // Layer 6: Per-author daily launch limit (max 3 per day)
        const DAILY_LAUNCH_LIMIT_PER_AUTHOR = 3;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: authorLaunchesToday } = await supabase
          .from("agent_social_posts")
          .select("id", { count: "exact", head: true })
          .eq("platform", "twitter")
          .eq("post_author_id", authorId)
          .eq("status", "completed")
          .gte("processed_at", oneDayAgo);

        if ((authorLaunchesToday || 0) >= DAILY_LAUNCH_LIMIT_PER_AUTHOR) {
          console.log(`[agent-scan-mentions] @${username} (${authorId}) hit daily limit: ${authorLaunchesToday}/${DAILY_LAUNCH_LIMIT_PER_AUTHOR}`);

          // Record the attempt as rate-limited
          await supabase.from("agent_social_posts").insert({
            platform: "twitter",
            post_id: tweetId,
            post_url: `https://x.com/${username || "i"}/status/${tweetId}`,
            post_author: username,
            post_author_id: authorId,
            raw_content: tweetText.slice(0, 1000),
            status: "failed",
            error_message: "Daily limit of 3 Agent launches per X account reached",
            processed_at: new Date().toISOString(),
          });

          results.push({ tweetId, status: "rate_limited", error: "Daily limit reached" });

          // Reply with rate limit message
          const { data: existingRateLimitReply } = await supabase
            .from("twitter_bot_replies")
            .select("id")
            .eq("tweet_id", tweetId)
            .maybeSingle();

          if (!existingRateLimitReply) {
            const rateLimitText = `🦞 Hey @${username}! There is a daily limit of 3 Agent launches per X account.\n\nPlease try again tomorrow! 🌅`;
            const rateLimitReply = await replyToTweet(
              tweetId,
              rateLimitText,
              consumerKey,
              consumerSecret,
              accessToken,
              accessTokenSecret
            );

            if (rateLimitReply.success && rateLimitReply.replyId) {
              await supabase.from("twitter_bot_replies").insert({
                tweet_id: tweetId,
                tweet_author: username,
                tweet_text: tweetText.slice(0, 500),
                reply_text: rateLimitText.slice(0, 500),
                reply_id: rateLimitReply.replyId,
              });
              console.log(`[agent-scan-mentions] ✅ Sent rate limit reply to ${tweetId}`);
            }
          }
          continue;
        }

        // Check if already processed (deduplication with primary scanner)
        const { data: existing } = await supabase
          .from("agent_social_posts")
          .select("id, status")
          .eq("platform", "twitter")
          .eq("post_id", tweetId)
          .maybeSingle();

        if (existing) {
          // Catch-up: completed launch but reply was never sent (e.g. base64 bug killed reply)
          if (existing.status === "completed" && username) {
            const { data: alreadyReplied } = await supabase
              .from("twitter_bot_replies")
              .select("id")
              .eq("tweet_id", tweetId)
              .maybeSingle();

            if (!alreadyReplied) {
              const { data: postData } = await supabase
                .from("agent_social_posts")
                .select("fun_token_id, parsed_name, parsed_symbol, parsed_image_url")
                .eq("id", existing.id)
                .single();

              let mintAddress: string | null = null;
              if (postData?.fun_token_id) {
                const { data: tokenData } = await supabase
                  .from("fun_tokens")
                  .select("mint_address, name, ticker, image_url")
                  .eq("id", postData.fun_token_id)
                  .single();
                mintAddress = tokenData?.mint_address || null;

                if (mintAddress) {
                  const tokenName = tokenData?.name || postData?.parsed_name || "Token";
                  const tokenTicker = tokenData?.ticker || postData?.parsed_symbol || "TOKEN";
                  const catchUpReplyText = `🦞 Token launched on $SOL!\n\n$${tokenTicker} - ${tokenName}\nCA: ${mintAddress}\n\nPowered by Claw Agents - 80% of fees go to you! Launch your token on saturn.trade`;

                  const catchUpReply = await replyToTweet(
                    tweetId,
                    catchUpReplyText,
                    consumerKey,
                    consumerSecret,
                    accessToken,
                    accessTokenSecret
                  );

                  if (catchUpReply.success && catchUpReply.replyId) {
                    await supabase.from("twitter_bot_replies").insert({
                      tweet_id: tweetId,
                      tweet_author: username,
                      tweet_text: tweetText.slice(0, 500),
                      reply_text: catchUpReplyText.slice(0, 500),
                      reply_id: catchUpReply.replyId,
                    });
                    console.log(`[agent-scan-mentions] ✅ Catch-up SUCCESS reply sent to @${username} for ${tweetId} (CA: ${mintAddress})`);
                  } else {
                    console.error(`[agent-scan-mentions] ❌ FAILED catch-up success reply to @${username}:`, catchUpReply.error);
                  }
                }
              }
            }
          }

          results.push({ tweetId, status: "already_processed" });
          continue;
        }

        console.log(`[agent-scan-mentions] Processing mention ${tweetId} (backup catch)`);

        // Process the tweet
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
              content: tweetText,
              source: "mentions_backup",
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
            status: "launched_via_backup",
            mintAddress: processResult.mintAddress,
          });

          // CRITICAL: Check if we already replied before sending
          const { data: existingReply } = await supabase
            .from("twitter_bot_replies")
            .select("id")
            .eq("tweet_id", tweetId)
            .maybeSingle();

          if (existingReply) {
            console.log(`[agent-scan-mentions] ⏭️ Skipping reply to ${tweetId} - already replied`);
          } else {
            // New format: full CA, no links, token name/symbol
            const replyText = `🦞 Token launched on $SOL!\n\n$${processResult.tokenSymbol || "TOKEN"} - ${processResult.tokenName || "Token"}\nCA: ${processResult.mintAddress}\n\nPowered by Claw Agents - 80% of fees go to you! Launch your token on saturn.trade`;

            const replyResult = await replyToTweet(
              tweetId,
              replyText,
              consumerKey,
              consumerSecret,
              accessToken,
              accessTokenSecret
            );

            if (!replyResult.success) {
              console.warn(
                `[agent-scan-mentions] Failed to reply to ${tweetId}:`,
                replyResult.error
              );
            } else if (replyResult.replyId) {
              // Record reply to prevent duplicates
              await supabase.from("twitter_bot_replies").insert({
                tweet_id: tweetId,
                tweet_author: username,
                tweet_text: tweetText.slice(0, 500),
                reply_text: replyText.slice(0, 500),
                reply_id: replyResult.replyId,
              });
              console.log(`[agent-scan-mentions] ✅ Sent success reply to ${tweetId}`);
            }
          }
        } else if (processResult.error) {
          results.push({
            tweetId,
            status: "failed",
            error: processResult.error,
          });

          // CRITICAL: Check if we already replied before sending
          const { data: existingReply } = await supabase
            .from("twitter_bot_replies")
            .select("id")
            .eq("tweet_id", tweetId)
            .maybeSingle();

          if (existingReply) {
            console.log(`[agent-scan-mentions] ⏭️ Skipping error reply to ${tweetId} - already replied`);
          } else if (processResult.shouldReply && processResult.replyText) {
            const blockedReply = await replyToTweet(
              tweetId,
              processResult.replyText,
              consumerKey,
              consumerSecret,
              accessToken,
              accessTokenSecret
            );

            if (!blockedReply.success) {
              console.warn(
                `[agent-scan-mentions] Failed to send blocked launch reply to ${tweetId}:`,
                blockedReply.error
              );
            } else {
              console.log(`[agent-scan-mentions] ✅ Sent blocked launch reply to ${tweetId}`);
              if (blockedReply.replyId) {
                await supabase.from("twitter_bot_replies").insert({
                  tweet_id: tweetId,
                  tweet_author: username,
                  tweet_text: tweetText.slice(0, 500),
                  reply_text: processResult.replyText.slice(0, 500),
                  reply_id: blockedReply.replyId,
                });
              }
            }
          }
        }
      }

      const launchCount = results.filter(r => r.status === "launched_via_backup").length;
      console.log(
        `[agent-scan-mentions] Completed in ${Date.now() - startTime}ms. Backup catches: ${launchCount}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          mentionsFound: mentions.length,
          saturntradeMentions: results.length,
          backupLaunches: launchCount,
          results,
          durationMs: Date.now() - startTime,
          mode: "backup_mentions_api",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } finally {
      // Release lock
      await supabase.from("cron_locks").delete().eq("lock_name", lockName);
    }
  } catch (error) {
    console.error("[agent-scan-mentions] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
