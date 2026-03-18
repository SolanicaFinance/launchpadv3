import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io/twitter";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

const KEYWORDS = {
  cashtag: "$saturn",
  handle: "@saturnterminal",
};

const POINTS = {
  mention: 5,
  view: 0.2,
  retweet: 0.5,
  comment: 0.3,
};

function hasKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes(KEYWORDS.cashtag) || lower.includes(KEYWORDS.handle);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
  if (!apiKey) {
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
    const { twitterUsername, socialRewardId } = await req.json();

    if (!twitterUsername || !socialRewardId) {
      return new Response(
        JSON.stringify({ error: "Missing twitterUsername or socialRewardId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user record
    const { data: user, error: userErr } = await supabase
      .from("social_rewards")
      .select("*")
      .eq("id", socialRewardId)
      .single();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cooldown
    const lastChecked = user.last_checked_at ? new Date(user.last_checked_at).getTime() : 0;
    const now = Date.now();
    const remaining = COOLDOWN_MS - (now - lastChecked);

    if (remaining > 0) {
      const nextUpdateAt = new Date(lastChecked + COOLDOWN_MS).toISOString();
      return new Response(
        JSON.stringify({
          success: false,
          cooldown: true,
          remainingMs: remaining,
          nextUpdateAt,
          message: `Please wait ${Math.ceil(remaining / 60000)} minutes before scanning again.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch last 10 tweets
    const url = new URL(`${TWITTERAPI_BASE}/user/last_tweets`);
    url.searchParams.set("userName", twitterUsername);
    url.searchParams.set("count", "10");

    const res = await fetch(url.toString(), {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      const status = res.status;
      console.error(`[check-social-rewards-user] API error: ${status}`);
      return new Response(
        JSON.stringify({ error: `Twitter API error (${status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const tweets = data?.tweets || data?.data || [];

    if (!Array.isArray(tweets)) {
      return new Response(
        JSON.stringify({ success: true, pointsEarned: 0, tweetsChecked: 0, newEvents: [], nextUpdateAt: new Date(now + COOLDOWN_MS).toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only new tweets
    const sinceId = user.last_checked_post_id;
    const newTweets = sinceId
      ? tweets.filter((t: any) => {
          const tid = t.id || t.id_str;
          try { return tid && BigInt(tid) > BigInt(sinceId); } catch { return false; }
        })
      : tweets;

    let pointsEarned = 0;
    let newLastPostId = user.last_checked_post_id;
    const newEvents: any[] = [];

    for (const tweet of newTweets) {
      const tweetId = tweet.id || tweet.id_str;
      const text = tweet.text || tweet.full_text || "";
      const tweetUrl = `https://x.com/${twitterUsername}/status/${tweetId}`;

      if (!newLastPostId || BigInt(tweetId) > BigInt(newLastPostId)) {
        newLastPostId = tweetId;
      }

      if (!hasKeywords(text)) continue;

      // Mention reward
      const { error: mentionErr } = await supabase
        .from("social_reward_events")
        .insert({
          social_reward_id: socialRewardId,
          post_id: tweetId,
          post_url: tweetUrl,
          reward_type: "mention",
          points: POINTS.mention,
        })
        .select("id")
        .maybeSingle();

      if (!mentionErr) {
        pointsEarned += POINTS.mention;
        newEvents.push({ type: "mention", points: POINTS.mention, postUrl: tweetUrl });
      }

      // Engagement
      const views = Number(tweet.viewCount || tweet.view_count || tweet.views || 0);
      const retweets = Number(tweet.retweetCount || tweet.retweet_count || tweet.retweets || 0);
      const comments = Number(tweet.replyCount || tweet.reply_count || tweet.replies || 0);

      const engagements = [
        { key: "views", count: views, rate: POINTS.view },
        { key: "retweets", count: retweets, rate: POINTS.retweet },
        { key: "comments", count: comments, rate: POINTS.comment },
      ];

      for (const eng of engagements) {
        const pts = Math.round(eng.count * eng.rate * 100) / 100;
        if (pts <= 0) continue;

        const { error: engErr } = await supabase
          .from("social_reward_events")
          .insert({
            social_reward_id: socialRewardId,
            post_id: `${tweetId}_${eng.key}`,
            post_url: tweetUrl,
            reward_type: eng.key,
            points: pts,
          })
          .select("id")
          .maybeSingle();

        if (!engErr) {
          pointsEarned += pts;
          newEvents.push({ type: eng.key, points: pts, count: eng.count, postUrl: tweetUrl });
        }
      }
    }

    // Update user record
    const updatePayload: any = {
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (newLastPostId) updatePayload.last_checked_post_id = newLastPostId;
    if (pointsEarned > 0) {
      updatePayload.points = Math.round(((user.points || 0) + pointsEarned) * 100) / 100;
    }

    await supabase.from("social_rewards").update(updatePayload).eq("id", socialRewardId);

    return new Response(
      JSON.stringify({
        success: true,
        pointsEarned: Math.round(pointsEarned * 100) / 100,
        tweetsChecked: newTweets.length,
        newEvents,
        nextUpdateAt: new Date(Date.now() + COOLDOWN_MS).toISOString(),
        totalPoints: updatePayload.points ?? user.points ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-social-rewards-user] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
