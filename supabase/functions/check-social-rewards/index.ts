import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io/twitter";

async function fetchUserTweets(
  username: string,
  sinceId: string | null,
  apiKey: string
): Promise<any[]> {
  // Use user timeline endpoint
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

  // Filter only tweets newer than sinceId
  if (sinceId) {
    return tweets.filter((t: any) => {
      const tweetId = t.id || t.id_str;
      return tweetId && BigInt(tweetId) > BigInt(sinceId);
    });
  }

  return tweets;
}

function checkPostContent(text: string): { hasMoon: boolean; hasMoondexo: boolean } {
  const lower = text.toLowerCase();
  const hasMoon = lower.includes("$moon");
  const hasMoondexo = lower.includes("@moondexo");
  return { hasMoon, hasMoondexo };
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
    // Get all social reward users
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

          // Track the latest post ID
          if (!newLastPostId || BigInt(tweetId) > BigInt(newLastPostId)) {
            newLastPostId = tweetId;
          }

          const { hasMoon, hasMoondexo } = checkPostContent(text);

          if (!hasMoon && !hasMoondexo) continue;

          // Both in same post = only 5 points (one reward), pick one type
          if (hasMoon && hasMoondexo) {
            // Insert single event for "both"
            const { error: insertErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: tweetId,
                post_url: tweetUrl,
                reward_type: "moon_mention",
                points: 5,
              })
              .select("id")
              .maybeSingle();

            if (!insertErr) {
              pointsEarned += 5;
              console.log(`[check-social-rewards] @${user.twitter_username} +5 pts (both $MOON+@MoonDexo) tweet:${tweetId}`);
            }
          } else if (hasMoon) {
            const { error: insertErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: tweetId,
                post_url: tweetUrl,
                reward_type: "moon_mention",
                points: 5,
              })
              .select("id")
              .maybeSingle();

            if (!insertErr) {
              pointsEarned += 5;
              console.log(`[check-social-rewards] @${user.twitter_username} +5 pts ($MOON) tweet:${tweetId}`);
            }
          } else if (hasMoondexo) {
            const { error: insertErr } = await supabase
              .from("social_reward_events")
              .insert({
                social_reward_id: user.id,
                post_id: tweetId,
                post_url: tweetUrl,
                reward_type: "moondexo_tag",
                points: 5,
              })
              .select("id")
              .maybeSingle();

            if (!insertErr) {
              pointsEarned += 5;
              console.log(`[check-social-rewards] @${user.twitter_username} +5 pts (@MoonDexo) tweet:${tweetId}`);
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
          updatePayload.points = (user.points || 0) + pointsEarned;
          totalRewarded++;
        }

        await supabase
          .from("social_rewards")
          .update(updatePayload)
          .eq("id", user.id);

      } catch (userErr) {
        console.error(`[check-social-rewards] Error for @${user.twitter_username}:`, (userErr as Error).message?.slice(0, 100));
      }

      // Small delay between users to avoid rate limiting
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
