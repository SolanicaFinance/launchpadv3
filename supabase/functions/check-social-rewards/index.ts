import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io/twitter";

const KEYWORDS = {
  cashtag: "$saturn",
  handle: "@saturnterminal",
};

const POINTS = {
  view: 0.2,
  retweet: 0.5,
  comment: 0.3,
  mention: 5, // base mention reward
};

function hasKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes(KEYWORDS.cashtag) || lower.includes(KEYWORDS.handle);
}

async function fetchUserTweets(
  username: string,
  sinceId: string | null,
  apiKey: string
): Promise<any[]> {
  const url = new URL(`${TWITTERAPI_BASE}/user/last_tweets`);
  url.searchParams.set("userName", username);
  url.searchParams.set("count", "20");

  console.log(`[check-social-rewards] Fetching tweets for @${username}${sinceId ? ` since ${sinceId}` : ""}`);

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    console.error(`[check-social-rewards] API error for @${username}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const tweets = data?.tweets || data?.data || [];

  if (!Array.isArray(tweets)) {
    console.log(`[check-social-rewards] No tweets array for @${username}`);
    return [];
  }

  if (sinceId) {
    return tweets.filter((t: any) => {
      const tweetId = t.id || t.id_str;
      return tweetId && BigInt(tweetId) > BigInt(sinceId);
    });
  }

  return tweets;
}

function calculateEngagementPoints(tweet: any): {
  viewPoints: number;
  retweetPoints: number;
  commentPoints: number;
  views: number;
  retweets: number;
  comments: number;
} {
  const views = Number(tweet.viewCount || tweet.view_count || tweet.views || 0);
  const retweets = Number(tweet.retweetCount || tweet.retweet_count || tweet.retweets || 0);
  const comments = Number(tweet.replyCount || tweet.reply_count || tweet.replies || 0);

  return {
    viewPoints: Math.round(views * POINTS.view * 100) / 100,
    retweetPoints: Math.round(retweets * POINTS.retweet * 100) / 100,
    commentPoints: Math.round(comments * POINTS.comment * 100) / 100,
    views,
    retweets,
    comments,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
  if (!apiKey) {
    console.error("[check-social-rewards] TWITTERAPI_IO_KEY not set");
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: users, error: usersError } = await supabase
      .from("social_rewards")
      .select("*")
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(50);

    if (usersError || !users?.length) {
      console.log(`[check-social-rewards] No users to check (${usersError?.message || "empty"})`);
      return new Response(JSON.stringify({ checked: 0, rewarded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[check-social-rewards] Checking ${users.length} users...`);

    let totalRewarded = 0;

    for (const user of users) {
      try {
        const tweets = await fetchUserTweets(
          user.twitter_username,
          user.last_checked_post_id,
          apiKey
        );

        let newLastPostId = user.last_checked_post_id;
        let pointsEarned = 0;

        for (const tweet of tweets) {
          const tweetId = tweet.id || tweet.id_str;
          const text = tweet.text || tweet.full_text || "";
          const tweetUrl = `https://x.com/${user.twitter_username}/status/${tweetId}`;

          if (!newLastPostId || BigInt(tweetId) > BigInt(newLastPostId)) {
            newLastPostId = tweetId;
          }

          if (!hasKeywords(text)) continue;

          // Base mention reward
          const { error: mentionErr } = await supabase
            .from("social_reward_events")
            .insert({
              social_reward_id: user.id,
              post_id: tweetId,
              post_url: tweetUrl,
              reward_type: "mention",
              points: POINTS.mention,
            })
            .select("id")
            .maybeSingle();

          if (!mentionErr) {
            pointsEarned += POINTS.mention;
            console.log(`[check-social-rewards] @${user.twitter_username} +${POINTS.mention} pts (mention) tweet:${tweetId}`);
          }

          // Engagement-based rewards (views, retweets, comments)
          const engagement = calculateEngagementPoints(tweet);

          if (engagement.viewPoints > 0) {
            const { error: viewErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: `${tweetId}_views`,
                post_url: tweetUrl,
                reward_type: "views",
                points: engagement.viewPoints,
              })
              .select("id")
              .maybeSingle();

            if (!viewErr) {
              pointsEarned += engagement.viewPoints;
              console.log(`[check-social-rewards] @${user.twitter_username} +${engagement.viewPoints} pts (${engagement.views} views) tweet:${tweetId}`);
            }
          }

          if (engagement.retweetPoints > 0) {
            const { error: rtErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: `${tweetId}_retweets`,
                post_url: tweetUrl,
                reward_type: "retweets",
                points: engagement.retweetPoints,
              })
              .select("id")
              .maybeSingle();

            if (!rtErr) {
              pointsEarned += engagement.retweetPoints;
              console.log(`[check-social-rewards] @${user.twitter_username} +${engagement.retweetPoints} pts (${engagement.retweets} RTs) tweet:${tweetId}`);
            }
          }

          if (engagement.commentPoints > 0) {
            const { error: cmtErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: `${tweetId}_comments`,
                post_url: tweetUrl,
                reward_type: "comments",
                points: engagement.commentPoints,
              })
              .select("id")
              .maybeSingle();

            if (!cmtErr) {
              pointsEarned += engagement.commentPoints;
              console.log(`[check-social-rewards] @${user.twitter_username} +${engagement.commentPoints} pts (${engagement.comments} comments) tweet:${tweetId}`);
            }
          }
        }

        // Update user record
        const updatePayload: any = {
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (newLastPostId) {
          updatePayload.last_checked_post_id = newLastPostId;
        }
        if (pointsEarned > 0) {
          updatePayload.points = Math.round(((user.points || 0) + pointsEarned) * 100) / 100;
          totalRewarded++;
        }

        await supabase
          .from("social_rewards")
          .update(updatePayload)
          .eq("id", user.id);

      } catch (userErr) {
        console.error(`[check-social-rewards] Error for @${user.twitter_username}:`, (userErr as Error).message?.slice(0, 100));
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[check-social-rewards] Done. Checked: ${users.length}, Rewarded: ${totalRewarded}`);

    return new Response(
      JSON.stringify({ checked: users.length, rewarded: totalRewarded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-social-rewards] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
