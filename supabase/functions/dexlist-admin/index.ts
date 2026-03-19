import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MOD_PASSWORD = "mod135@";

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ---- Action handlers ----

async function handleLookup(body: any) {
  const { mintAddress } = body;
  if (!mintAddress) return jsonResp({ error: "mintAddress required" }, 400);

  const res = await fetch(
    `https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`,
    { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
  );
  if (!res.ok) return jsonResp({ error: `DexScreener error: ${res.status}` }, res.status);

  const pairs = await res.json();
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return jsonResp({ error: "No pools found for this token", pairs: [] });
  }

  const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const top = sorted[0];

  const tokenInfo = {
    name: top.baseToken?.name || "",
    ticker: top.baseToken?.symbol || "",
    image_url: top.info?.imageUrl || "",
    description: top.info?.description || "",
    website_url: top.info?.websites?.[0]?.url || "",
    twitter_url: top.info?.socials?.find((s: any) => s.type === "twitter")?.url || "",
    telegram_url: top.info?.socials?.find((s: any) => s.type === "telegram")?.url || "",
    discord_url: top.info?.socials?.find((s: any) => s.type === "discord")?.url || "",
  };

  const poolsList = sorted.slice(0, 10).map((p: any) => ({
    pairAddress: p.pairAddress,
    dexId: p.dexId,
    liquidity_usd: p.liquidity?.usd || 0,
    market_cap: p.marketCap || p.fdv || 0,
    volume_24h: p.volume?.h24 || 0,
    priceUsd: p.priceUsd || "0",
    quoteToken: p.quoteToken?.symbol || "SOL",
  }));

  return jsonResp({ tokenInfo, pools: poolsList });
}

async function handleList(body: any) {
  const supabase = getSupabase();
  const { mintAddress, poolAddress, tokenInfo, maxLeverage } = body;
  const { error } = await supabase.from("dex_listed_tokens").upsert(
    {
      mint_address: mintAddress,
      pool_address: poolAddress,
      token_name: tokenInfo?.name,
      token_ticker: tokenInfo?.ticker,
      image_url: tokenInfo?.image_url,
      description: tokenInfo?.description,
      website_url: tokenInfo?.website_url,
      twitter_url: tokenInfo?.twitter_url,
      telegram_url: tokenInfo?.telegram_url,
      discord_url: tokenInfo?.discord_url,
      market_cap: tokenInfo?.market_cap,
      liquidity_usd: tokenInfo?.liquidity_usd,
      max_leverage: maxLeverage || 1,
      listed_by: "moderator",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mint_address" }
  );
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true });
}

async function handleUpdate(body: any) {
  const supabase = getSupabase();
  const { id, maxLeverage, isActive } = body;
  const updates: any = { updated_at: new Date().toISOString() };
  if (maxLeverage !== undefined) updates.max_leverage = maxLeverage;
  if (isActive !== undefined) updates.is_active = isActive;
  const { error } = await supabase.from("dex_listed_tokens").update(updates).eq("id", id);
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true });
}

async function handleFetch() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dex_listed_tokens")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ tokens: data });
}

async function handleRemove(body: any) {
  const supabase = getSupabase();
  const { id } = body;
  const { error } = await supabase
    .from("dex_listed_tokens")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return jsonResp({ error: error.message }, 500);
  return jsonResp({ success: true });
}

async function handleGetXConfig() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("dex_listing_x_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  return jsonResp({
    config: {
      has_cookie: !!data?.full_cookie_encrypted,
      socks5_count: data?.socks5_urls?.length || 0,
      socks5_urls: data?.socks5_urls || [],
    },
  });
}

async function handleSaveXConfig(body: any) {
  const supabase = getSupabase();
  const { fullCookie, socks5Urls } = body;

  // Check if config row exists
  const { data: existing } = await supabase
    .from("dex_listing_x_config")
    .select("id, full_cookie_encrypted")
    .limit(1)
    .maybeSingle();

  const updates: any = {
    socks5_urls: socks5Urls || [],
    updated_at: new Date().toISOString(),
  };

  // Only update cookie if provided (preserve existing)
  if (fullCookie && fullCookie.trim()) {
    updates.full_cookie_encrypted = fullCookie.trim();
  }

  if (existing) {
    if (!fullCookie?.trim()) {
      updates.full_cookie_encrypted = existing.full_cookie_encrypted;
    }
    const { error } = await supabase
      .from("dex_listing_x_config")
      .update(updates)
      .eq("id", existing.id);
    if (error) return jsonResp({ error: error.message }, 500);
  } else {
    if (!fullCookie?.trim()) {
      return jsonResp({ error: "Cookie is required for initial setup" }, 400);
    }
    const { error } = await supabase
      .from("dex_listing_x_config")
      .insert(updates);
    if (error) return jsonResp({ error: error.message }, 500);
  }

  return jsonResp({ success: true });
}

async function handlePostToX(body: any) {
  const supabase = getSupabase();
  const { imageBase64, ticker, maxLeverage, mintAddress } = body;

  if (!ticker || !mintAddress) {
    return jsonResp({ error: "ticker and mintAddress required" }, 400);
  }

  // Get X config
  const { data: config } = await supabase
    .from("dex_listing_x_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!config?.full_cookie_encrypted) {
    return jsonResp({ error: "X account not configured. Set cookies in Admin → Dex List tab." }, 400);
  }

  const fullCookie = config.full_cookie_encrypted;

  // Parse auth_token and ct0 from cookie
  const authTokenMatch = fullCookie.match(/auth_token=([^;]+)/);
  const ct0Match = fullCookie.match(/ct0=([^;]+)/);

  if (!authTokenMatch || !ct0Match) {
    return jsonResp({ error: "Cookie missing auth_token or ct0" }, 400);
  }

  const tweetText = `🪐 Saturn New Leverage Trading Listing $${ticker.toUpperCase()}

📊 Leverage Up to ${maxLeverage}x

✅ Deposit open Now
✅ Full trading enabled

Start Trading 👉 https://saturn.trade/trade/${mintAddress}

#Solana #Binance #okx #trading $sol`;

  try {
    let mediaId: string | null = null;

    // Step 1: Upload image if provided
    if (imageBase64) {
      // Store image temporarily in Supabase Storage
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `dexlist-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(`temp/${fileName}`, imageBytes, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("public-assets")
          .getPublicUrl(`temp/${fileName}`);

        if (urlData?.publicUrl) {
          // Upload image to Twitter via twitterapi.io
          const imgRes = await fetch("https://api.twitterapi.io/twitter/upload_image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
               "X-API-Key": Deno.env.get("TWITTERAPI_IO_KEY") || "",
            },
            body: JSON.stringify({
              image_url: urlData.publicUrl,
              auth_token: authTokenMatch[1],
              ct0: ct0Match[1],
            }),
          });

          if (imgRes.ok) {
            const imgData = await imgRes.json();
            mediaId = imgData?.media_id || imgData?.media_id_string || null;
          } else {
            console.error("Image upload failed:", imgRes.status, await imgRes.text());
          }

          // Cleanup temp file
          await supabase.storage.from("public-assets").remove([`temp/${fileName}`]);
        }
      }
    }

    // Step 2: Post tweet
    const tweetBody: any = {
      text: tweetText,
      auth_token: authTokenMatch[1],
      ct0: ct0Match[1],
    };

    if (mediaId) {
      tweetBody.media_ids = [mediaId];
    }

    const socks5 = config.socks5_urls?.[0];
    if (socks5) {
      tweetBody.proxy = socks5;
    }

    const tweetRes = await fetch("https://api.twitterapi.io/twitter/tweet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": Deno.env.get("TWITTERAPI_IO_KEY") || "",
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData = await tweetRes.json();

    if (!tweetRes.ok) {
      return jsonResp({ error: `Tweet failed: ${tweetData?.message || tweetRes.status}` }, 500);
    }

    const tweetId = tweetData?.tweet_id || tweetData?.data?.id;
    const tweetUrl = tweetId ? `https://x.com/i/status/${tweetId}` : null;

    return jsonResp({ success: true, tweetUrl, tweetId });
  } catch (e: any) {
    console.error("[dexlist-admin] Post to X error:", e);
    return jsonResp({ error: e.message || "Failed to post" }, 500);
  }
}

async function handleProxyImage(body: any) {
  const { url } = body;
  if (!url) return jsonResp({ error: "url required" }, 400);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return jsonResp({ error: `Image fetch failed: ${res.status}` }, res.status);

  const arrayBuf = await res.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  const contentType = res.headers.get("content-type") || "image/png";
  return jsonResp({ dataUrl: `data:${contentType};base64,${base64}` });
}

// ---- Main handler ----

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, modPassword } = body;

    if (modPassword !== MOD_PASSWORD) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    switch (action) {
      case "lookup": return handleLookup(body);
      case "list": return handleList(body);
      case "update": return handleUpdate(body);
      case "fetch": return handleFetch();
      case "remove": return handleRemove(body);
      case "get-x-config": return handleGetXConfig();
      case "save-x-config": return handleSaveXConfig(body);
      case "post-to-x": return handlePostToX(body);
      case "proxy-image": return handleProxyImage(body);
      default: return jsonResp({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("[dexlist-admin] Error:", error);
    return jsonResp(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
