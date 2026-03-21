import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tweetUrl, creatorWallet } = await req.json();

    if (!tweetUrl || (!tweetUrl.includes("x.com") && !tweetUrl.includes("twitter.com"))) {
      throw new Error("Invalid tweet URL");
    }

    const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already exists
    const { data: existing } = await supabase
      .from("meteorite_tokens")
      .select("id, status, dev_wallet_address, tweet_author, tweet_content")
      .eq("tweet_url", tweetUrl)
      .not("status", "eq", "failed")
      .maybeSingle();

    // Fetch tweet data from twitterapi.io
    let tweetData: { author: string; authorName: string; authorAvatar: string; content: string; createdAt: string; likes: number; retweets: number; replies: number; isVerified: boolean; verifiedType: string } | null = null;

    if (tweetId) {
      const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
      if (apiKey) {
        try {
          const res = await fetch(
            `https://api.twitterapi.io/twitter/tweet?tweetId=${tweetId}`,
            { headers: { "X-API-Key": apiKey } }
          );
          if (res.ok) {
            const data = await res.json();
            const tweet = data?.tweet || data;
            const author = tweet?.author || tweet?.user || {};
            tweetData = {
              author: author?.userName || author?.username || author?.screen_name || "",
              authorName: author?.name || author?.displayName || "",
              authorAvatar: (author?.profilePicture || author?.avatar || author?.profile_image_url_https || "").replace("_normal", "_200x200"),
              content: tweet?.text || tweet?.full_text || "",
              createdAt: tweet?.createdAt || tweet?.created_at || "",
              likes: Number(tweet?.likeCount || tweet?.favorite_count || 0),
              retweets: Number(tweet?.retweetCount || tweet?.retweet_count || 0),
              replies: Number(tweet?.replyCount || tweet?.reply_count || 0),
              isVerified: author?.isBlueVerified || author?.isVerified || author?.verified || false,
              verifiedType: author?.isGoldVerified ? "gold" : author?.isBlueVerified ? "blue" : "",
            };
            console.log(`[meteorite-init] Fetched tweet by @${tweetData.author}: "${tweetData.content.slice(0, 50)}..."`);
          }
        } catch (e) {
          console.error("[meteorite-init] Tweet fetch error (non-fatal):", e);
        }
      }
    }

    if (existing) {
      return new Response(
        JSON.stringify({
          alreadyExists: true,
          id: existing.id,
          status: existing.status,
          devWalletAddress: existing.dev_wallet_address,
          paymentAmount: 0.1,
          tweetData: tweetData || (existing.tweet_author ? {
            author: existing.tweet_author,
            content: existing.tweet_content,
          } : null),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate dev wallet
    const devKeypair = Keypair.generate();
    const devWalletAddress = devKeypair.publicKey.toBase58();
    const devWalletPrivateKey = bs58.encode(devKeypair.secretKey);

    // Save to database with tweet data
    const { data: token, error } = await supabase
      .from("meteorite_tokens")
      .insert({
        tweet_url: tweetUrl,
        tweet_id: tweetId,
        tweet_author: tweetData?.author || null,
        tweet_content: tweetData?.content || null,
        dev_wallet_address: devWalletAddress,
        dev_wallet_private_key: devWalletPrivateKey,
        creator_wallet: creatorWallet || null,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (error) throw error;

    console.log(`[meteorite-init] Created token ${token.id} for tweet ${tweetId}, dev wallet: ${devWalletAddress}`);

    return new Response(
      JSON.stringify({
        id: token.id,
        devWalletAddress,
        paymentAmount: 0.1,
        tweetId,
        tweetData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-init] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
