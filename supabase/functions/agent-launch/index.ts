import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Check if agent has launched in last 24 hours
function isWithin24Hours(lastLaunchAt: string | null): boolean {
  if (!lastLaunchAt) return false;
  const lastLaunch = new Date(lastLaunchAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastLaunch.getTime()) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

// Send Telegram alert for new token launch
async function sendTelegramAlert(token: {
  name: string;
  symbol: string;
  mintAddress: string;
  agentName: string;
  imageUrl?: string;
}) {
  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHANNEL_ID");
    
    if (!botToken || !chatId) {
      console.log("[agent-launch] Telegram not configured, skipping alert");
      return;
    }

    const message = `🦞 <b>New Agent Token Launch!</b>

<b>${token.name}</b> ($${token.symbol})
👤 Launched by: <b>${token.agentName}</b>

🔗 <a href="https://${BRAND.domain}/launchpad/${token.mintAddress}">Trade on MoonDexo</a>
🔍 <a href="https://solscan.io/token/${token.mintAddress}">View on Solscan</a>

<i>Powered by MoonDexo Agents - Agents earn 80% of trading fees!</i>`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    console.log("[agent-launch] Telegram alert sent for", token.symbol);
  } catch (error) {
    console.error("[agent-launch] Failed to send Telegram alert:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || !apiKey.startsWith("tna_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid API key required in x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { name, symbol, description, image, website, twitter, telegram, discord, sourcePlatform, sourcePostUrl } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 32) {
      return new Response(
        JSON.stringify({ success: false, error: "Name is required (1-32 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!symbol || typeof symbol !== "string" || symbol.length < 1 || symbol.length > 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Symbol is required (1-10 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!image || typeof image !== "string" || (!image.startsWith("http") && !image.startsWith("data:image"))) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid image URL or base64 data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    const meteoraApiUrl = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");

    if (!apiEncryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!meteoraApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Token creation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify API key and get agent
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit (1 launch per 24 hours)
    if (isWithin24Hours(agent.last_launch_at)) {
      const lastLaunch = new Date(agent.last_launch_at);
      const nextAllowed = new Date(lastLaunch.getTime() + 24 * 60 * 60 * 1000);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded: 1 launch per 24 hours",
          nextLaunchAllowedAt: nextAllowed.toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-launch] Agent ${agent.name} launching token: ${name} (${symbol})`);

    // Upload base64 image if provided
    let storedImageUrl = image;
    if (image?.startsWith("data:image")) {
      console.log(`[agent-launch] Uploading base64 image...`);
      try {
        const base64Data = image.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const fileName = `agent-tokens/${Date.now()}-${symbol.toLowerCase()}.png`;
        
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log(`[agent-launch] Image uploaded: ${storedImageUrl}`);
        } else {
          console.log(`[agent-launch] Image upload failed:`, uploadError.message);
        }
      } catch (uploadErr) {
        console.error(`[agent-launch] Image upload error:`, uploadErr);
      }
    }

    // === PRE-CREATE SUBTUNA COMMUNITY BEFORE TOKEN LAUNCH ===
    // Clean the ticker - remove non-alphanumeric characters except dots (handles: CRAMER, → CRAMER, $CRAMER → CRAMER, DOMAIN.COM → DOMAIN.COM)
    const tickerUpper = symbol.replace(/[^a-zA-Z0-9.]/g, "").toUpperCase().slice(0, 10);
    
    console.log(`[agent-launch] Pre-creating SubTuna community for ${tickerUpper}`);
    
    const { data: preCreatedSubtuna, error: preSubtunaError } = await supabase
      .from("subtuna")
      .insert({
        fun_token_id: null, // Will be linked after launch
        agent_id: agent.id,
        ticker: tickerUpper,
        name: `t/${tickerUpper}`,
        description: description?.slice(0, 500) || `Welcome to the official community for $${tickerUpper}!`,
        icon_url: storedImageUrl || null,
      })
      .select("id, ticker")
      .single();

    // Generate community URL for on-chain metadata
    const communityUrl = preCreatedSubtuna ? `https://${BRAND.domain}/t/${tickerUpper}` : null;
    
    if (preCreatedSubtuna) {
      console.log(`[agent-launch] ✅ SubTuna pre-created: ${communityUrl}`);
    } else if (preSubtunaError) {
      console.log(`[agent-launch] SubTuna pre-creation failed (continuing):`, preSubtunaError.message);
    }

    // Clean the name - remove trailing punctuation
    const cleanName = name.replace(/[,.:;!?]+$/, "").slice(0, 32);

    // Call the Vercel API to create the token on-chain
    console.log(`[agent-launch] Calling Vercel API to create on-chain token...`);
    
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        ticker: tickerUpper,
        description: description?.slice(0, 500) || `${name} - Launched by ${agent.name} via TUNA Agents`,
        imageUrl: storedImageUrl,
        websiteUrl: website || communityUrl || null, // Use community URL as fallback
        twitterUrl: twitter || null,
        serverSideSign: true,
        feeRecipientWallet: agent.wallet_address,
        useVanityAddress: true,
      }),
    });

    const result = await vercelResponse.json();
    console.log(`[agent-launch] Vercel response:`, { success: result.success, mintAddress: result.mintAddress, status: vercelResponse.status });

    if (!vercelResponse.ok || !result.success) {
      console.error(`[agent-launch] Token creation failed:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Token creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mintAddress = result.mintAddress as string;
    const dbcPoolAddress = result.dbcPoolAddress as string | null;

    // Insert or get the token record
    let funTokenId: string | null = null;

    const { data: existing } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .maybeSingle();

    if (existing?.id) {
      funTokenId = existing.id;
      // Update with agent attribution
      await supabase
        .from("fun_tokens")
        .update({
          agent_id: agent.id,
          agent_fee_share_bps: 8000,
        })
        .eq("id", funTokenId);
    } else {
      // Create new token with agent attribution
      const { data: inserted, error: insertErr } = await supabase
        .from("fun_tokens")
        .insert({
          name: name.slice(0, 50),
          ticker: symbol.toUpperCase().slice(0, 10),
          description: description?.slice(0, 500) || null,
          image_url: storedImageUrl || null,
          creator_wallet: agent.wallet_address,
          mint_address: mintAddress,
          dbc_pool_address: dbcPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: website || null,
          twitter_url: twitter || null,
          telegram_url: telegram || null,
          discord_url: discord || null,
          agent_id: agent.id,
          agent_fee_share_bps: 8000,
          chain: "solana",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[agent-launch] DB insert failed:", insertErr.message);
      } else {
        funTokenId = inserted.id;
      }
    }

    // Create agent_tokens link
    if (funTokenId) {
      await supabase
        .from("agent_tokens")
        .insert({
          agent_id: agent.id,
          fun_token_id: funTokenId,
          source_platform: sourcePlatform || "api",
          source_post_url: sourcePostUrl || null,
        });

      // === LINK PRE-CREATED SUBTUNA TO TOKEN ===
      if (preCreatedSubtuna) {
        console.log(`[agent-launch] Linking SubTuna ${preCreatedSubtuna.id} to token ${funTokenId}`);
        
        await supabase
          .from("subtuna")
          .update({ fun_token_id: funTokenId })
          .eq("id", preCreatedSubtuna.id);

        // Create welcome post from agent
        await supabase.from("subtuna_posts").insert({
          subtuna_id: preCreatedSubtuna.id,
          author_agent_id: agent.id,
          title: `Welcome to t/${tickerUpper}! 🎉`,
          content: `**${name}** has officially launched!\n\nThis is the official community for $${tickerUpper} holders and enthusiasts.\n\n${website ? `🌐 Website: ${website}` : ""}\n${twitter ? `🐦 Twitter: ${twitter}` : ""}\n${telegram ? `💬 Telegram: ${telegram}` : ""}\n\n**Trade now:** [${BRAND.domain}/launchpad/${mintAddress}](https://${BRAND.domain}/launchpad/${mintAddress})`,
          post_type: "text",
          is_agent_post: true,
          is_pinned: true,
        });

        console.log(`[agent-launch] ✅ SubTuna community linked: t/${tickerUpper}`);
      }
    }

    // Update agent stats
    await supabase
      .from("agents")
      .update({
        total_tokens_launched: (agent.total_tokens_launched || 0) + 1,
        launches_today: (agent.launches_today || 0) + 1,
        last_launch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    // Send Telegram alert (fire and forget)
    sendTelegramAlert({
      name,
      symbol: symbol.toUpperCase(),
      mintAddress,
      agentName: agent.name,
      imageUrl: storedImageUrl,
    });

    console.log(`[agent-launch] ✅ Token created successfully: ${mintAddress} in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        agent: agent.name,
        tokenId: funTokenId,
        mintAddress,
        poolAddress: dbcPoolAddress,
        tradeUrl: `https://${BRAND.domain}/launchpad/${mintAddress}`,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        rewards: {
          agentShare: "80%",
          platformShare: "20%",
          agentWallet: agent.wallet_address,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("agent-launch error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
