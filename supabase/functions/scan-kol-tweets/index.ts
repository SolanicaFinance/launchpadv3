import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOLANA_CA_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_CA_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;

// Common false-positive base58 strings to skip
const SKIP_PATTERNS = new Set([
  "bitcoin", "solana", "ethereum", "Transaction", "confirmed",
]);

function isLikelyCA(candidate: string): boolean {
  if (candidate.length < 32) return false;
  if (/^[a-zA-Z]+$/.test(candidate)) return false; // pure letters = word
  if (SKIP_PATTERNS.has(candidate)) return false;
  // Must contain mix of upper/lower/digits for Solana
  const hasDigit = /\d/.test(candidate);
  const hasUpper = /[A-Z]/.test(candidate);
  const hasLower = /[a-z]/.test(candidate);
  return (hasDigit && hasUpper) || (hasDigit && hasLower) || (hasUpper && hasLower);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) throw new Error("TWITTERAPI_IO_KEY not configured");

    // Fetch active KOLs
    const { data: kols, error: kolErr } = await supabase
      .from("kol_accounts")
      .select("*")
      .eq("is_active", true)
      .order("last_scanned_at", { ascending: true, nullsFirst: true })
      .limit(20); // batch 20 per invocation

    if (kolErr) throw kolErr;
    if (!kols || kols.length === 0) {
      return new Response(JSON.stringify({ message: "No KOLs to scan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    const errors: string[] = [];

    for (const kol of kols) {
      try {
        const url = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${encodeURIComponent(kol.username)}`;
        const resp = await fetch(url, {
          headers: { "x-api-key": apiKey },
        });

        if (!resp.ok) {
          errors.push(`${kol.username}: HTTP ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        const tweets = data?.tweets || data?.data || [];
        if (!Array.isArray(tweets) || tweets.length === 0) {
          // Update last_scanned_at even if no tweets
          await supabase
            .from("kol_accounts")
            .update({ last_scanned_at: new Date().toISOString() })
            .eq("id", kol.id);
          continue;
        }

        // Update profile image if available
        const authorInfo = tweets[0]?.author || data?.user;
        if (authorInfo?.profile_image_url_https || authorInfo?.profileImageUrl) {
          const imgUrl = authorInfo.profile_image_url_https || authorInfo.profileImageUrl;
          await supabase
            .from("kol_accounts")
            .update({
              profile_image_url: imgUrl,
              display_name: authorInfo.name || authorInfo.displayName || kol.display_name,
            })
            .eq("id", kol.id);
        }

        let newestTweetId = kol.last_scanned_tweet_id;

        for (const tweet of tweets) {
          const tweetId = tweet.id || tweet.id_str;
          if (!tweetId) continue;

          // Skip if already processed (tweet IDs are chronological/sortable as strings for snowflake IDs)
          if (kol.last_scanned_tweet_id && BigInt(tweetId) <= BigInt(kol.last_scanned_tweet_id)) {
            continue;
          }

          const text = tweet.text || tweet.full_text || "";
          const createdAt = tweet.created_at || tweet.createdAt;

          // Detect CAs
          const evmMatches = text.match(EVM_CA_REGEX) || [];
          const solMatches = (text.match(SOLANA_CA_REGEX) || []).filter(isLikelyCA);

          const allCAs: { address: string; chain: string }[] = [
            ...evmMatches.map((a: string) => ({ address: a.toLowerCase(), chain: "evm" })),
            ...solMatches.map((a: string) => ({ address: a, chain: "solana" })),
          ];

          for (const ca of allCAs) {
            // Try to fetch token metadata via DexScreener
            let tokenName: string | null = null;
            let tokenSymbol: string | null = null;
            let tokenImageUrl: string | null = null;
            let tokenPriceUsd: number | null = null;
            let tokenMarketCap: number | null = null;

            try {
              const dexResp = await fetch(
                `https://api.dexscreener.com/latest/dex/tokens/${ca.address}`
              );
              if (dexResp.ok) {
                const dexData = await dexResp.json();
                const pair = dexData?.pairs?.[0];
                if (pair) {
                  tokenName = pair.baseToken?.name || null;
                  tokenSymbol = pair.baseToken?.symbol || null;
                  tokenImageUrl = pair.info?.imageUrl || null;
                  tokenPriceUsd = pair.priceUsd ? parseFloat(pair.priceUsd) : null;
                  tokenMarketCap = pair.marketCap || pair.fdv || null;
                }
              }
            } catch {
              // Token metadata fetch failed, continue without it
            }

            const tweetUrl = `https://x.com/${kol.username}/status/${tweetId}`;

            const { error: insertErr } = await supabase
              .from("kol_contract_tweets")
              .insert({
                kol_account_id: kol.id,
                tweet_id: tweetId,
                tweet_text: text.substring(0, 1000),
                tweet_url: tweetUrl,
                contract_address: ca.address,
                chain: ca.chain,
                kol_username: kol.username,
                kol_profile_image: kol.profile_image_url,
                token_name: tokenName,
                token_symbol: tokenSymbol,
                token_image_url: tokenImageUrl,
                token_price_usd: tokenPriceUsd,
                token_market_cap: tokenMarketCap,
                tweeted_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
              })
              .select()
              .single();

            if (!insertErr) {
              totalInserted++;
            }
            // Ignore unique constraint violations (duplicate tweet_id)
          }

          // Track newest tweet ID
          if (!newestTweetId || BigInt(tweetId) > BigInt(newestTweetId)) {
            newestTweetId = tweetId;
          }
        }

        // Update scan state
        await supabase
          .from("kol_accounts")
          .update({
            last_scanned_tweet_id: newestTweetId || kol.last_scanned_tweet_id,
            last_scanned_at: new Date().toISOString(),
          })
          .eq("id", kol.id);
      } catch (e) {
        errors.push(`${kol.username}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        scanned: kols.length,
        inserted: totalInserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
