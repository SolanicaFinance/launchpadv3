import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meteoriteTokenId } = await req.json();
    if (!meteoriteTokenId) throw new Error("meteoriteTokenId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the meteorite token
    const { data: token, error: tokenErr } = await supabase
      .from("meteorite_tokens")
      .select("id, tweet_id, tweet_url, replies_last_refreshed_at, eligible_replies_count")
      .eq("id", meteoriteTokenId)
      .single();

    if (tokenErr || !token) throw new Error("Token not found");

    // Check cache TTL — if refreshed less than 5 min ago, return cached data
    const lastRefreshed = token.replies_last_refreshed_at
      ? new Date(token.replies_last_refreshed_at).getTime()
      : 0;
    const now = Date.now();

    if (now - lastRefreshed < CACHE_TTL_MS) {
      // Return cached replies
      const { data: cached } = await supabase
        .from("meteorite_eligible_replies")
        .select("*")
        .eq("meteorite_token_id", meteoriteTokenId)
        .order("twitter_username");

      const { data: claims } = await supabase
        .from("meteorite_reply_claims")
        .select("*")
        .eq("meteorite_token_id", meteoriteTokenId);

      return new Response(
        JSON.stringify({
          replies: cached || [],
          claims: claims || [],
          cached: true,
          lastRefreshedAt: token.replies_last_refreshed_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Need to refresh — fetch replies from twitterapi.io
    const tweetId = token.tweet_id || extractTweetId(token.tweet_url);
    if (!tweetId) throw new Error("Cannot extract tweet ID");

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) throw new Error("TWITTERAPI_IO_KEY not configured");

    console.log(`[meteorite-fetch-replies] Fetching replies for tweet ${tweetId}`);

    // Fetch replies using twitterapi.io
    const repliesRes = await fetch(
      `https://api.twitterapi.io/twitter/tweet/replies?tweetId=${tweetId}&cursor=`,
      { headers: { "X-API-Key": apiKey } }
    );

    if (!repliesRes.ok) {
      const errText = await repliesRes.text();
      console.error("[meteorite-fetch-replies] API error:", repliesRes.status, errText);
      throw new Error(`Twitter API error: ${repliesRes.status}`);
    }

    const repliesData = await repliesRes.json();
    const tweets = repliesData?.tweets || repliesData?.data || [];

    console.log(`[meteorite-fetch-replies] Got ${tweets.length} raw replies`);

    // Filter: only verified (blue or gold), not shadowbanned
    const eligibleReplies: Array<{
      twitter_username: string;
      twitter_display_name: string;
      twitter_avatar_url: string;
      verified_type: string;
      is_shadowbanned: boolean;
      reply_text: string;
      reply_id: string;
    }> = [];

    const seenUsernames = new Set<string>();

    for (const tweet of tweets) {
      const author = tweet.author || tweet.user || {};
      const username = (author.userName || author.username || author.screen_name || "").toLowerCase();
      
      if (!username || seenUsernames.has(username)) continue;
      
      // Check verification
      const isBlue = author.isBlueVerified === true || author.is_blue_verified === true;
      const isGold = author.isGoldVerified === true || author.is_gold_verified === true;
      const isVerified = isBlue || isGold || author.isVerified === true || author.verified === true;
      
      if (!isVerified) continue;

      // Check shadowban status — we consider users with no visibility issues as not shadowbanned
      // twitterapi.io doesn't directly provide shadowban info, so we check for suspended/protected
      const isSuspended = author.isSuspended === true || author.suspended === true;
      const isProtected = author.isProtected === true || author.protected === true;
      const isShadowbanned = isSuspended || isProtected;

      if (isShadowbanned) continue;

      seenUsernames.add(username);

      const verifiedType = isGold ? "gold" : "blue";
      const avatarUrl = (author.profilePicture || author.avatar || author.profile_image_url_https || "")
        .replace("_normal", "_200x200");

      eligibleReplies.push({
        twitter_username: username,
        twitter_display_name: author.name || author.displayName || username,
        twitter_avatar_url: avatarUrl,
        verified_type: verifiedType,
        is_shadowbanned: false,
        reply_text: tweet.text || tweet.full_text || "",
        reply_id: tweet.id || tweet.id_str || "",
      });
    }

    console.log(`[meteorite-fetch-replies] ${eligibleReplies.length} eligible verified replies`);

    // Upsert eligible replies (replace old data)
    // First delete existing for this token
    await supabase
      .from("meteorite_eligible_replies")
      .delete()
      .eq("meteorite_token_id", meteoriteTokenId);

    // Insert new ones
    if (eligibleReplies.length > 0) {
      const rows = eligibleReplies.map((r) => ({
        meteorite_token_id: meteoriteTokenId,
        ...r,
      }));

      const { error: insertErr } = await supabase
        .from("meteorite_eligible_replies")
        .insert(rows);

      if (insertErr) console.error("[meteorite-fetch-replies] Insert error:", insertErr);
    }

    // Ensure claim records exist for each eligible replier (unclaimed by default)
    for (const r of eligibleReplies) {
      await supabase
        .from("meteorite_reply_claims")
        .upsert(
          {
            meteorite_token_id: meteoriteTokenId,
            twitter_username: r.twitter_username,
            status: "unclaimed",
          },
          { onConflict: "meteorite_token_id,twitter_username" }
        );
    }

    // Update the token's refresh timestamp
    await supabase
      .from("meteorite_tokens")
      .update({
        replies_last_refreshed_at: new Date().toISOString(),
        eligible_replies_count: eligibleReplies.length,
      })
      .eq("id", meteoriteTokenId);

    // Fetch claims to return
    const { data: claims } = await supabase
      .from("meteorite_reply_claims")
      .select("*")
      .eq("meteorite_token_id", meteoriteTokenId);

    return new Response(
      JSON.stringify({
        replies: eligibleReplies.map((r) => ({
          ...r,
          meteorite_token_id: meteoriteTokenId,
        })),
        claims: claims || [],
        cached: false,
        lastRefreshedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-fetch-replies] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}
