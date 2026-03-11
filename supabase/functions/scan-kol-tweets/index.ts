import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOLANA_CA_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_CA_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;

const SKIP_PATTERNS = new Set([
  "bitcoin", "solana", "ethereum", "Transaction", "confirmed",
]);

function isLikelyCA(candidate: string): boolean {
  if (candidate.length < 32) return false;
  if (/^[a-zA-Z]+$/.test(candidate)) return false;
  if (SKIP_PATTERNS.has(candidate)) return false;
  const hasDigit = /\d/.test(candidate);
  const hasUpper = /[A-Z]/.test(candidate);
  const hasLower = /[a-z]/.test(candidate);
  return (hasDigit && hasUpper) || (hasDigit && hasLower) || (hasUpper && hasLower);
}

/** Extract tweets array from various API response shapes */
function extractTweets(data: any): any[] {
  if (!data) return [];
  // Shape 1: { tweets: [...] }
  if (Array.isArray(data.tweets)) return data.tweets;
  // Shape 2: { data: { tweets: [...] } }
  if (data.data && Array.isArray(data.data.tweets)) return data.data.tweets;
  // Shape 3: { data: [...] }
  if (Array.isArray(data.data)) return data.data;
  // Shape 4: direct array
  if (Array.isArray(data)) return data;
  // Shape 5: { statuses: [...] }
  if (Array.isArray(data.statuses)) return data.statuses;
  // Shape 6: { timeline: { tweets: [...] } }
  if (data.timeline && Array.isArray(data.timeline.tweets)) return data.timeline.tweets;
  return [];
}

/** Extract tweet ID from various tweet object shapes */
function extractTweetId(tweet: any): string | null {
  return tweet.id_str || tweet.id || tweet.rest_id || tweet.tweetId || null;
}

/** Extract tweet text from various tweet object shapes */
function extractTweetText(tweet: any): string {
  return tweet.text || tweet.full_text || tweet.legacy?.full_text || tweet.content || tweet.rawContent || "";
}

/** Extract created_at from various tweet object shapes */
function extractCreatedAt(tweet: any): string | null {
  return tweet.created_at || tweet.createdAt || tweet.legacy?.created_at || tweet.date || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const runCounters = {
    accountsScanned: 0,
    tweetsFetched: 0,
    casDetected: 0,
    tweetsInserted: 0,
    errorsCount: 0,
  };
  const runErrors: { username: string; message: string; preview?: string }[] = [];

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
      .limit(20);

    if (kolErr) throw kolErr;
    if (!kols || kols.length === 0) {
      // Log empty run
      await supabase.from("kol_scan_runs").insert({
        accounts_scanned: 0,
        tweets_fetched: 0,
        cas_detected: 0,
        tweets_inserted: 0,
        errors_count: 0,
        duration_ms: Date.now() - startTime,
        raw_response_sample: "No active KOLs to scan",
      });
      return new Response(JSON.stringify({ message: "No KOLs to scan" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let firstResponseSample: string | null = null;

    for (const kol of kols) {
      runCounters.accountsScanned++;
      try {
        const url = `https://api.twitterapi.io/twitter/user/last_tweets?userName=${encodeURIComponent(kol.username)}&count=20`;
        console.log(`[scan] Fetching tweets for @${kol.username}`);
        
        const resp = await fetch(url, {
          headers: { "x-api-key": apiKey },
        });

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          const msg = `HTTP ${resp.status}: ${errBody.substring(0, 200)}`;
          console.error(`[scan] @${kol.username}: ${msg}`);
          runErrors.push({ username: kol.username, message: msg, preview: errBody.substring(0, 500) });
          runCounters.errorsCount++;
          continue;
        }

        const data = await resp.json();
        
        // Capture first response sample for debugging
        if (!firstResponseSample) {
          try {
            const keys = Object.keys(data || {});
            const sample: any = { _keys: keys };
            for (const k of keys.slice(0, 5)) {
              const v = data[k];
              if (Array.isArray(v)) {
                sample[k] = `Array(${v.length})`;
                if (v.length > 0) sample[`${k}_first_keys`] = Object.keys(v[0] || {}).slice(0, 10);
              } else if (typeof v === "object" && v !== null) {
                sample[k] = Object.keys(v).slice(0, 10);
              } else {
                sample[k] = v;
              }
            }
            firstResponseSample = JSON.stringify(sample).substring(0, 1000);
          } catch {
            firstResponseSample = JSON.stringify(Object.keys(data || {})).substring(0, 500);
          }
        }

        const tweets = extractTweets(data);
        console.log(`[scan] @${kol.username}: found ${tweets.length} tweets from response`);
        
        if (tweets.length === 0) {
          // Log the response structure for debugging
          const responseKeys = JSON.stringify(Object.keys(data || {})).substring(0, 200);
          runErrors.push({ 
            username: kol.username, 
            message: `No tweets extracted. Response keys: ${responseKeys}`,
            preview: JSON.stringify(data).substring(0, 500),
          });
          runCounters.errorsCount++;
          
          await supabase
            .from("kol_accounts")
            .update({ last_scanned_at: new Date().toISOString() })
            .eq("id", kol.id);
          continue;
        }

        runCounters.tweetsFetched += tweets.length;

        // Update profile image if available — cache small avatar in storage
        const authorInfo = tweets[0]?.author || data?.user;
        if (authorInfo?.profile_image_url_https || authorInfo?.profileImageUrl) {
          let imgUrl = authorInfo.profile_image_url_https || authorInfo.profileImageUrl;
          
          // Use Twitter's mini size (24x24) for fast loading
          imgUrl = imgUrl.replace(/_normal\./, "_mini.").replace(/_bigger\./, "_mini.");
          
          const updateData: Record<string, string> = {
            profile_image_url: imgUrl,
            display_name: authorInfo.name || authorInfo.displayName || kol.display_name,
          };

          // Try to cache avatar in storage for fastest loading
          if (!kol.cached_avatar_url) {
            try {
              const avatarResp = await fetch(imgUrl);
              if (avatarResp.ok) {
                const blob = await avatarResp.blob();
                const ext = imgUrl.includes(".png") ? "png" : "jpg";
                const path = `${kol.username}.${ext}`;
                
                const { error: uploadErr } = await supabase.storage
                  .from("kol-avatars")
                  .upload(path, blob, { 
                    contentType: blob.type || `image/${ext}`,
                    upsert: true,
                  });
                
                if (!uploadErr) {
                  const { data: urlData } = supabase.storage
                    .from("kol-avatars")
                    .getPublicUrl(path);
                  if (urlData?.publicUrl) {
                    updateData.cached_avatar_url = urlData.publicUrl;
                  }
                }
              }
            } catch (e) {
              console.warn(`[scan] Failed to cache avatar for @${kol.username}:`, e);
            }
          }
          
          await supabase
            .from("kol_accounts")
            .update(updateData)
            .eq("id", kol.id);
        }

        let newestTweetId = kol.last_scanned_tweet_id;

        for (const tweet of tweets) {
          const tweetId = extractTweetId(tweet);
          if (!tweetId) {
            console.warn(`[scan] @${kol.username}: tweet missing ID, keys: ${Object.keys(tweet).join(",")}`);
            continue;
          }

          // Skip if already processed
          try {
            if (kol.last_scanned_tweet_id && BigInt(tweetId) <= BigInt(kol.last_scanned_tweet_id)) {
              continue;
            }
          } catch {
            // If BigInt comparison fails (non-numeric IDs), just skip dedup by ID comparison
            if (kol.last_scanned_tweet_id === tweetId) continue;
          }

          const text = extractTweetText(tweet);
          const createdAt = extractCreatedAt(tweet);

          // Detect CAs
          const evmMatches = text.match(EVM_CA_REGEX) || [];
          const solMatches = (text.match(SOLANA_CA_REGEX) || []).filter(isLikelyCA);

          const allCAs: { address: string; chain: string }[] = [
            ...evmMatches.map((a: string) => ({ address: a.toLowerCase(), chain: "evm" })),
            ...solMatches.map((a: string) => ({ address: a, chain: "solana" })),
          ];

          if (allCAs.length > 0) {
            runCounters.casDetected += allCAs.length;
            console.log(`[scan] @${kol.username} tweet ${tweetId}: ${allCAs.length} CAs found`);
          }

          for (const ca of allCAs) {
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
            } catch { /* continue without metadata */ }

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
                kol_profile_image: kol.cached_avatar_url || kol.profile_image_url,
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
              runCounters.tweetsInserted++;
            }
          }

          // Track newest tweet ID
          try {
            if (!newestTweetId || BigInt(tweetId) > BigInt(newestTweetId)) {
              newestTweetId = tweetId;
            }
          } catch {
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
        const msg = e.message || String(e);
        console.error(`[scan] @${kol.username}: ${msg}`);
        runErrors.push({ username: kol.username, message: msg });
        runCounters.errorsCount++;
      }
    }

    const durationMs = Date.now() - startTime;

    // Persist run log
    const { data: runRow } = await supabase.from("kol_scan_runs").insert({
      accounts_scanned: runCounters.accountsScanned,
      tweets_fetched: runCounters.tweetsFetched,
      cas_detected: runCounters.casDetected,
      tweets_inserted: runCounters.tweetsInserted,
      errors_count: runCounters.errorsCount,
      duration_ms: durationMs,
      raw_response_sample: firstResponseSample,
    }).select("id").single();

    // Persist error details
    if (runRow && runErrors.length > 0) {
      await supabase.from("kol_scan_errors").insert(
        runErrors.map((e) => ({
          run_id: runRow.id,
          kol_username: e.username,
          error_message: e.message,
          raw_response_preview: e.preview || null,
        }))
      );
    }

    console.log(`[scan] Complete: ${runCounters.accountsScanned} accounts, ${runCounters.tweetsFetched} tweets, ${runCounters.casDetected} CAs, ${runCounters.tweetsInserted} inserted, ${runCounters.errorsCount} errors, ${durationMs}ms`);

    return new Response(
      JSON.stringify({
        scanned: runCounters.accountsScanned,
        fetched: runCounters.tweetsFetched,
        cas: runCounters.casDetected,
        inserted: runCounters.tweetsInserted,
        errors: runErrors.length > 0 ? runErrors.map(e => `${e.username}: ${e.message}`) : undefined,
        duration_ms: durationMs,
        response_sample: firstResponseSample,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[scan] Fatal: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
