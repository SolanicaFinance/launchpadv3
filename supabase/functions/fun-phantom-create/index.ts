import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Default socials removed per memory - fields should be null when not provided
// const DEFAULT_WEBSITE = "https://buildtuna.com";
// const DEFAULT_TWITTER = "https://x.com/buildtuna";

// Blocked patterns for spam/exploit names
const BLOCKED_PATTERNS = [
  /exploit/i,
  /hack/i,
  /0xh1ve/i,
  /fix\s*(ur|your)\s*site/i,
  /dm\s*@/i,
  /found\s*(an?|the)?\s*exploit/i,
  /vulnerability/i,
  /security\s*issue/i,
  /into\s*(ur|your)\s*db/i,
];

function isBlockedName(name: string): boolean {
  if (!name) return false;
  return BLOCKED_PATTERNS.some(pattern => pattern.test(name));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Some browsers/extensions can be picky about 204 preflight responses.
    // Return 200 with explicit CORS headers to maximize compatibility.
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Get client IP from headers
  const clientIP = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  try {
    // Initialize Supabase client with service role FIRST for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting removed per user request

    const body = await req.json();
    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, telegramUrl, discordUrl, phantomWallet, confirmed, mintAddress: confirmedMintAddress, dbcPoolAddress: confirmedPoolAddress, tradingFeeBps: rawFeeBps, creatorFeeBps: rawCreatorFeeBps, feeMode, devBuySol: rawDevBuySol, specificVanityId } = body;
    
    // Validate and constrain trading fee to valid range (10-1000 bps = 0.1%-10%)
    const MIN_FEE_BPS = 10;
    const MAX_FEE_BPS = 1000;
    const DEFAULT_FEE_BPS = 200;
    const tradingFeeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, Math.round(Number(rawFeeBps) || DEFAULT_FEE_BPS)));
    
    // Creator fee = total fee minus 1% platform base (100 bps)
    // If explicitly provided, use it; otherwise derive from total
    const PLATFORM_BASE_BPS = 100;
    const creatorFeeBps = rawCreatorFeeBps != null 
      ? Math.max(0, Math.min(MAX_FEE_BPS, Math.round(Number(rawCreatorFeeBps))))
      : Math.max(0, tradingFeeBps - PLATFORM_BASE_BPS);
    
    // Validate dev buy amount (max 100 SOL)
    const devBuySol = Math.max(0, Math.min(100, Number(rawDevBuySol) || 0));
    console.log("[fun-phantom-create] Validated tradingFeeBps:", tradingFeeBps, "creatorFeeBps:", creatorFeeBps, "from raw:", rawFeeBps);
    console.log("[fun-phantom-create] Dev buy amount:", devBuySol, "SOL");

    // ===== PHASE 2: Record token after confirmation =====
    if (confirmed === true && confirmedMintAddress && confirmedPoolAddress) {
      console.log("[fun-phantom-create] 📝 Phase 2: Recording confirmed token...");
      
      // Upload base64 image if needed
      let storedImageUrl = imageUrl;
      if (imageUrl?.startsWith("data:image")) {
        try {
          const base64Data = imageUrl.split(",")[1];
          const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}.png`;
          
          const { error: uploadError } = await supabase.storage
            .from("post-images")
            .upload(fileName, imageBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("post-images")
              .getPublicUrl(fileName);
            storedImageUrl = publicUrl;
          }
        } catch (uploadErr) {
          console.error("[fun-phantom-create] ⚠️ Image processing error:", uploadErr);
        }
      }

      // Validate fee mode
      const validFeeModes = ['creator', 'holder_rewards'];
      const tokenFeeMode = validFeeModes.includes(feeMode) ? feeMode : 'creator';

      // Insert into fun_tokens after confirmation
      const { data: funToken, error: insertError } = await supabase
        .from("fun_tokens")
        .insert({
          name: name.slice(0, 50),
          ticker: ticker.toUpperCase().slice(0, 5),
          description: description?.slice(0, 500) || null,
          image_url: storedImageUrl || null,
          creator_wallet: phantomWallet,
          mint_address: confirmedMintAddress,
          dbc_pool_address: confirmedPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: websiteUrl || null,
          twitter_url: twitterUrl || null,
          telegram_url: telegramUrl || null,
          discord_url: discordUrl || null,
          fee_mode: tokenFeeMode,
          trading_fee_bps: tradingFeeBps, // Total on-chain fee (creator + platform base)
          creator_fee_bps: creatorFeeBps, // Creator's portion only
          launchpad_type: 'phantom', // Tag Phantom-launched tokens
        })
        .select()
        .single();

      if (insertError) {
        console.error("[fun-phantom-create] ❌ Insert error:", insertError);
        throw new Error("Failed to create token record");
      }

      // If holder_rewards mode, initialize the pool
      if (tokenFeeMode === 'holder_rewards') {
        await supabase.from("holder_reward_pool").insert({
          fun_token_id: funToken.id,
          accumulated_sol: 0,
        }).then(({ error }) => {
          if (error) console.warn("[fun-phantom-create] Failed to init holder pool:", error.message);
        });
      }

      console.log("[fun-phantom-create] ✅ Token recorded:", { id: funToken.id, name: funToken.name, feeMode: tokenFeeMode });
      
      return new Response(
        JSON.stringify({
          success: true,
          tokenId: funToken.id,
          recorded: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== PHASE 1: Prepare transactions (no DB insert) =====
    
    // Validate required fields
    if (!name || !ticker || !phantomWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: name, ticker, phantomWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block spam/exploit names and tickers
    if (isBlockedName(name) || isBlockedName(ticker) || isBlockedName(description || "")) {
      console.log("[fun-phantom-create] ❌ Blocked spam token attempt:", { name, ticker });
      return new Response(
        JSON.stringify({ success: false, error: "Token name or ticker contains blocked content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Solana address format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(phantomWallet)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fun-phantom-create] 🚀 Phase 1: Preparing Phantom transactions:", { name, ticker, phantomWallet, clientIP });

    // Upload base64 image to storage if provided
    let storedImageUrl = imageUrl;
    if (imageUrl?.startsWith("data:image")) {
      try {
        const base64Data = imageUrl.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log("[fun-phantom-create] ✅ Image uploaded:", storedImageUrl);
        } else {
          console.error("[fun-phantom-create] ⚠️ Image upload error:", uploadError);
        }
      } catch (uploadErr) {
        console.error("[fun-phantom-create] ⚠️ Image processing error:", uploadErr);
      }
    }

    // ===== EARLY METADATA STORE =====
    // Store pending metadata with the image/socials BEFORE on-chain tx so that
    // the token-metadata endpoint can serve it as soon as explorers fetch it.
    // Key will be set after we have the mintAddress from pool creation.

    // Call pool creation API (Vercel /api route).
    // IMPORTANT: If METEORA_API_URL points to an older deployment, Phantom launches can fail with
    // "URI too long" due to older metadata URI construction.
    // To make preview + current deployment consistent, fallback to the request Origin.
    const origin = req.headers.get("origin")?.replace(/\/$/, "") || "";
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      origin;

    if (!meteoraApiUrl) {
      console.error("[fun-phantom-create] ❌ METEORA_API_URL not configured and no Origin header present");
      return new Response(
        JSON.stringify({
          success: false,
          error: "On-chain pool creation not configured. Please configure METEORA_API_URL.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      "[fun-phantom-create] 📡 Calling pool creation API for Phantom launch:",
      `${meteoraApiUrl}/api/pool/create-phantom`,
      { usedOriginFallback: !Deno.env.get("METEORA_API_URL") && !Deno.env.get("VITE_METEORA_API_URL") }
    );

    let mintAddress: string;
    let dbcPoolAddress: string | null = null;
    let unsignedTransactions: string[] = [];
    let txLabels: string[] = [];
    let txRequiredKeypairs: string[][] = [];
    let ephemeralKeypairs: Record<string, string> = {};
    let txIsVersioned: boolean[] = [];
    let vanityKeypairId: string | null = null;

    // Pre-reserve vanity address if no specificVanityId provided (STRN suffix)
    let resolvedVanityId = specificVanityId || undefined;
    if (!resolvedVanityId) {
      const suffixes = ['STRN'];
      for (const suffix of suffixes) {
        try {
          const { data: vData, error: vError } = await supabase.rpc('backend_reserve_vanity_address', {
            p_suffix: suffix
          });
          if (!vError && vData && vData.length > 0) {
            resolvedVanityId = vData[0].id;
            console.log(`[fun-phantom-create] Pre-reserved vanity (${suffix}):`, vData[0].public_key);
            break;
          }
          console.log(`[fun-phantom-create] No vanity for suffix '${suffix}'`);
        } catch (e) {
          console.warn(`[fun-phantom-create] Vanity reservation failed for '${suffix}':`, e);
        }
      }
    }

    try {
      // Call the pool creation API - will return unsigned transactions for Phantom to sign
      const poolResponse = await fetch(`${meteoraApiUrl}/api/pool/create-phantom`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.slice(0, 32),
          ticker: ticker.toUpperCase().slice(0, 10),
          description: description?.slice(0, 500) || `${name} - A fun meme coin!`,
          imageUrl: storedImageUrl,
          websiteUrl: websiteUrl || null,
          twitterUrl: twitterUrl || null,
          telegramUrl: telegramUrl || null,
          discordUrl: discordUrl || null,
          phantomWallet, // User's Phantom wallet as fee payer
          feeRecipientWallet: phantomWallet, // All fees go to Phantom wallet
          tradingFeeBps: tradingFeeBps || 200, // Default 2%, allow 0.1%-10%
          devBuySol, // Dev buy amount - atomic with pool creation to prevent frontrunning
          useVanityAddress: true, // Use pre-generated vanity addresses from pool
          specificVanityId: resolvedVanityId, // Use pre-reserved or user-specified keypair
        }),
      });

      if (!poolResponse.ok) {
        const errorText = await poolResponse.text();
        console.error("[fun-phantom-create] ❌ Pool API error:", poolResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `On-chain pool creation failed: ${errorText}` 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const poolData = await poolResponse.json();
      
      if (!poolData.success || !poolData.mintAddress) {
        console.error("[fun-phantom-create] ❌ Pool API returned invalid data:", poolData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: poolData.error || "On-chain pool creation returned invalid data" 
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      mintAddress = poolData.mintAddress;
      dbcPoolAddress = poolData.dbcPoolAddress || poolData.poolAddress;
      unsignedTransactions = poolData.unsignedTransactions || [];
      txLabels = poolData.txLabels || [];
      txRequiredKeypairs = poolData.txRequiredKeypairs || [];
      ephemeralKeypairs = poolData.ephemeralKeypairs || {};
      txIsVersioned = poolData.txIsVersioned || [];
      vanityKeypairId = poolData.vanityKeypairId || null;
      
      console.log("[fun-phantom-create] ✅ Transactions prepared (NOT recorded in DB yet):", { 
        mintAddress, 
        dbcPoolAddress,
        txCount: unsignedTransactions.length 
      });

      // ===== STORE PENDING METADATA =====
      // Insert into pending_token_metadata so the token-metadata endpoint
      // can serve image/socials as soon as explorers fetch the metadata URI.
      try {
        const { error: pendingErr } = await supabase
          .from("pending_token_metadata")
          .upsert({
            mint_address: mintAddress,
            name: name.slice(0, 50),
            ticker: ticker.toUpperCase().slice(0, 5),
            description: description?.slice(0, 500) || null,
            image_url: storedImageUrl || null,
            website_url: websiteUrl || null,
            twitter_url: twitterUrl || null,
            telegram_url: body.telegramUrl || null,
            discord_url: body.discordUrl || null,
            creator_wallet: phantomWallet,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min TTL
          }, { onConflict: "mint_address" });
        if (pendingErr) {
          console.warn("[fun-phantom-create] ⚠️ Failed to store pending metadata:", pendingErr.message);
        } else {
          console.log("[fun-phantom-create] 📝 Pending metadata stored for:", mintAddress);
        }
      } catch (pendingStoreErr) {
        console.warn("[fun-phantom-create] ⚠️ Pending metadata store error:", pendingStoreErr);
      }

    } catch (fetchError) {
      console.error("[fun-phantom-create] ❌ Pool API fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to connect to pool creation service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NOTE: We do NOT insert into fun_tokens database here!
    // Token will only be recorded after Phantom confirms the transaction

    return new Response(
      JSON.stringify({
        success: true,
        name: name.slice(0, 50),
        ticker: ticker.toUpperCase().slice(0, 5),
        mintAddress,
        dbcPoolAddress,
        imageUrl: storedImageUrl,
        unsignedTransactions,
        txLabels,
        txRequiredKeypairs,
        ephemeralKeypairs,
        txIsVersioned,
        vanityKeypairId,
        onChainSuccess: false,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${dbcPoolAddress || mintAddress}`,
        message: "Ready for Phantom signature.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fun-phantom-create] ❌ Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
