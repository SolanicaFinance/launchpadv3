import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_LAUNCHES_PER_WINDOW = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP
    const clientIP =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    console.log("[punch-launch] Request from IP:", clientIP);

    // Rate limit check: 3 per 1 hour per IP
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { data: recent, error: rlErr } = await supabase
      .from("launch_rate_limits")
      .select("launched_at")
      .eq("ip_address", clientIP)
      .gte("launched_at", oneHourAgo)
      .order("launched_at", { ascending: true });

    if (!rlErr && recent && recent.length >= MAX_LAUNCHES_PER_WINDOW) {
      const oldest = new Date(recent[0].launched_at);
      const expiresAt = new Date(oldest.getTime() + RATE_LIMIT_WINDOW_MS);
      const waitSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
      return new Response(
        JSON.stringify({
          error: `Rate limited. You've launched ${recent.length} coins in the last hour.`,
          rateLimited: true,
          waitSeconds: Math.max(0, waitSeconds),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { creatorWallet } = await req.json();

    if (!creatorWallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid Solana wallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Fetch recent names/tickers to avoid duplicates
    const { data: recentTokens } = await supabase
      .from("fun_tokens")
      .select("name, ticker")
      .eq("launchpad_type", "punch")
      .order("created_at", { ascending: false })
      .limit(100);

    const usedNames = [...new Set((recentTokens || []).map((t: any) => t.name))];
    const usedTickers = [...new Set((recentTokens || []).map((t: any) => t.ticker))];
    const blacklist = `ALREADY USED (DO NOT USE THESE):\n- Names: ${usedNames.join(", ")}\n- Tickers: ${usedTickers.join(", ")}`;
    console.log("[punch-launch] Blacklist:", usedTickers.length, "tickers,", usedNames.length, "names");

    // Step 2: Generate name + ticker via AI (tool calling)
    console.log("[punch-launch] Generating name/ticker...");
    const nameRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 1.5,
        messages: [
          {
            role: "system",
            content:
              `You generate wildly creative, unique meme coin names. Rules:\n- Name: 1-2 words max, under 16 chars. Draw from ANY of these themes: monkey species, jungle fruits, tropical birds, safari animals, zoo characters, rainforest creatures, island vibes, banana varieties, tree-dwelling animals, primate slang, coconut culture, vine-swinging energy.\n- Ticker: ONE short meme word, 3-6 letters. Must sound fun and be completely unlike any existing ticker.\n- NO violent words (no punch/slap/fist/smash/hit/bonk). Just vibes and meme energy.\n- EVERY name and ticker MUST be completely unique. Never reuse any name or ticker that has been used before.\n- Your name and ticker MUST NOT be similar-sounding to any blacklisted entry. No rhymes, no slight spelling variations.\n- Be WILDLY creative — invent new words, mash concepts together, use unexpected combinations.\n\n${blacklist}`,
          },
          {
            role: "user",
            content:
              "Generate a BRAND NEW unique short funny meme coin name and ticker that has NEVER been used before. Be wildly creative - invent new words, combine unexpected concepts. Do NOT use any name or ticker from the blacklist. Do NOT use similar-sounding names.",
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_punch_token",
              description: "Return a meme coin name and ticker",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Short creative meme name, 1-2 words, max 16 chars" },
                  ticker: { type: "string", description: "Single fun word ticker, 3-6 uppercase letters" },
                },
                required: ["name", "ticker"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_punch_token" } },
      }),
    });

    if (!nameRes.ok) {
      const t = await nameRes.text();
      console.error("[punch-launch] AI name gen failed:", nameRes.status, t);
      throw new Error("AI name generation failed");
    }

    const nameData = await nameRes.json();
    const toolCall = nameData.choices?.[0]?.message?.tool_calls?.[0];
    let tokenName = "Punch Monkey";
    let tokenTicker = "PUNCH";
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        tokenName = (args.name || "Punch Monkey").slice(0, 24);
        tokenTicker = (args.ticker || "PUNCH").toUpperCase().slice(0, 6);
      } catch {}
    }

    // Server-side uniqueness enforcement
    if (usedTickers.includes(tokenTicker)) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      tokenTicker = tokenTicker.slice(0, 4) + chars[Math.floor(Math.random() * 26)] + chars[Math.floor(Math.random() * 26)];
      console.log("[punch-launch] Ticker was duplicate, randomized to:", tokenTicker);
    }
    if (usedNames.includes(tokenName)) {
      tokenName = tokenName + " " + Math.floor(Math.random() * 999);
      console.log("[punch-launch] Name was duplicate, randomized to:", tokenName);
    }
    console.log("[punch-launch] Generated:", tokenName, tokenTicker);

    // Step 2: Generate image via AI
    console.log("[punch-launch] Generating image...");
    const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content:
              "Generate a realistic photo of a cute baby monkey in a zoo setting, sweetly cuddling or playing with a small plush stuffed monkey toy. The baby monkey looks adorable and gentle, hugging or holding the toy lovingly. Background is a natural zoo habitat with greenery, rocks, or branches. Photorealistic style, warm natural lighting, square 1:1 format. No text in the image. Wholesome, cute, and shareable.",
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    let imageBase64: string | null = null;
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      console.log("[punch-launch] Image response keys:", JSON.stringify(Object.keys(imgData?.choices?.[0]?.message || {})));
      const imgUrl = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imgUrl) {
        imageBase64 = imgUrl; // data:image/png;base64,...
        console.log("[punch-launch] Image generated successfully, length:", imgUrl.length);
      } else {
        console.error("[punch-launch] No image in response. Full message:", JSON.stringify(imgData.choices?.[0]?.message).slice(0, 500));
      }
    } else {
      const errText = await imgRes.text();
      console.error("[punch-launch] Image gen failed:", imgRes.status, errText.slice(0, 300));
    }

    // Step 3: Upload image to storage if we have one
    let storedImageUrl = "";
    if (imageBase64?.startsWith("data:image")) {
      try {
        const base64Data = imageBase64.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `punch-tokens/${Date.now()}-${tokenTicker.toLowerCase()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("post-images").getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log("[punch-launch] Image uploaded:", storedImageUrl);
        } else {
          console.error("[punch-launch] Image upload failed:", uploadError.message);
        }
      } catch (e) {
        console.error("[punch-launch] Image upload error:", e);
      }
    }

    // Fallback: use the punch logo if no AI image was generated/uploaded
    if (!storedImageUrl) {
      storedImageUrl = "https://punchlaunch.fun/punch-logo.jpg";
      console.log("[punch-launch] Using fallback image:", storedImageUrl);
    }

    // Step 5: Call fun-create flow via Vercel
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");
    if (!meteoraApiUrl) throw new Error("METEORA_API_URL not configured");

    console.log("[punch-launch] Calling Vercel API for on-chain creation (punch deployer)...");
    const vercelPayload = {
      name: tokenName.slice(0, 32),
      ticker: tokenTicker.slice(0, 10),
      description: `${tokenName} — Born in the zoo! A meme coin launched via Punch Launch.`,
      imageUrl: storedImageUrl || undefined,
      twitterUrl: "https://x.com/punchitsol/status/2026923770934407218",
      websiteUrl: "https://punchlaunch.fun",
      serverSideSign: true,
      feeRecipientWallet: creatorWallet,
      useVanityAddress: false,
    };

    const vercelRes = await fetch(`${meteoraApiUrl}/api/pool/create-punch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vercelPayload),
    });

    const vercelResult = await vercelRes.json();
    console.log("[punch-launch] Vercel result:", { success: vercelResult.success, mint: vercelResult.mintAddress });

    if (!vercelRes.ok || !vercelResult.success) {
      throw new Error(vercelResult.error || "Token creation failed");
    }

    // Step 6: Save to fun_tokens
    const mintAddress = vercelResult.mintAddress;
    let funTokenId: string | null = null;

    const punchFeeWallet = Deno.env.get("PUNCH_FEE_WALLET") || creatorWallet;

    const { data: inserted, error: insertErr } = await supabase
      .from("fun_tokens")
      .insert({
        name: tokenName.slice(0, 50),
        ticker: tokenTicker.slice(0, 10),
        description: `${tokenName} — Born in the zoo! A meme coin launched via Punch Launch.`,
        image_url: storedImageUrl || null,
        creator_wallet: punchFeeWallet,
        punch_creator_wallet: creatorWallet,
        mint_address: mintAddress || null,
        dbc_pool_address: vercelResult.dbcPoolAddress || null,
        status: "active",
        price_sol: 0.00000003,
        twitter_url: "https://x.com/punchitsol/status/2026923770934407218",
        website_url: "https://punchlaunch.fun",
        fee_mode: "punch",
        launchpad_type: "punch",
        creator_fee_bps: 7000,
      })
      .select("id")
      .single();

    if (!insertErr) {
      funTokenId = inserted.id;
    } else {
      console.error("[punch-launch] DB insert failed:", insertErr.message);
    }

    // Insert rate limit record AFTER successful creation
    await supabase.from("launch_rate_limits").insert({ ip_address: clientIP, token_id: funTokenId });
    console.log("[punch-launch] Rate limit record inserted for IP:", clientIP);

    return new Response(
      JSON.stringify({
        success: true,
        mintAddress,
        name: tokenName,
        ticker: tokenTicker,
        imageUrl: storedImageUrl,
        tokenId: funTokenId,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[punch-launch] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
