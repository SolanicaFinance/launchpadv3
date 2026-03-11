import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERCEL_API_URL = "https://saturntrade.vercel.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[saturn-trading-create] Creating new Claw trading agent...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) throw new Error("API_ENCRYPTION_KEY not configured");

    const body = await req.json();
    const {
      name,
      ticker,
      description,
      avatarUrl,
      strategy = "balanced",
      personalityPrompt,
      creatorWallet,
      twitterUrl,
    } = body;

    // Generate trading wallet
    const tradingWallet = Keypair.generate();
    const walletAddress = tradingWallet.publicKey.toBase58();
    const privateKeyBase58 = bs58.encode(tradingWallet.secretKey);
    const encrypted = await aesEncrypt(privateKeyBase58, API_ENCRYPTION_KEY);

    // Generate dedicated bid wallet for receiving auction bids
    const bidWallet = Keypair.generate();
    const bidWalletAddress = bidWallet.publicKey.toBase58();
    const bidWalletPrivateKey = bs58.encode(bidWallet.secretKey);
    const bidWalletEncrypted = await aesEncrypt(bidWalletPrivateKey, API_ENCRYPTION_KEY);

    // Generate name/ticker/description with AI if not provided
    let finalName = name;
    let finalTicker = ticker;
    let finalDescription = description;
    let finalAvatarUrl = avatarUrl;

    if (!name || !ticker || !description) {
      const generated = await generateAgentIdentity(LOVABLE_API_KEY, {
        name, ticker, description, personalityPrompt, strategy,
      });
      finalName = name || generated.name;
      finalTicker = ticker || generated.ticker;
      finalDescription = description || generated.description;
    }

    // Create the claw_trading_agents record
    const { data: tradingAgent, error: taError } = await supabase
      .from("claw_trading_agents")
      .insert({
        name: finalName,
        ticker: finalTicker,
        description: finalDescription,
        avatar_url: finalAvatarUrl,
        wallet_address: walletAddress,
        wallet_private_key_encrypted: encrypted,
        strategy_type: strategy,
        trading_style: personalityPrompt || `${strategy} trading approach`,
        status: "pending",
        trading_capital_sol: 0,
        stop_loss_pct: strategy === "conservative" ? 10 : strategy === "aggressive" ? 30 : 20,
        take_profit_pct: strategy === "conservative" ? 25 : strategy === "aggressive" ? 100 : 50,
        max_concurrent_positions: 2,
        twitter_url: twitterUrl?.trim() || null,
        creator_wallet: creatorWallet || null,
        launched_at: new Date().toISOString(),
        bidding_ends_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        is_owned: false,
        bid_wallet_address: bidWalletAddress,
        bid_wallet_private_key_encrypted: bidWalletEncrypted,
      })
      .select()
      .single();

    if (taError) throw taError;

    // Register as a claw_agent for social features
    const agentApiKey = `claw_${crypto.randomUUID().replace(/-/g, '')}`;
    const agentApiKeyHash = await hashApiKey(agentApiKey);

    const { data: agent, error: agentError } = await supabase
      .from("claw_agents")
      .insert({
        name: finalName,
        description: `🦞 Autonomous Claw Trading Agent | ${strategy.toUpperCase()} Strategy\n\n${finalDescription}`,
        avatar_url: finalAvatarUrl,
        wallet_address: walletAddress,
        api_key_hash: agentApiKeyHash,
        api_key_prefix: agentApiKey.slice(0, 8),
        trading_agent_id: tradingAgent.id,
        status: "active",
      })
      .select()
      .single();

    if (agentError) throw agentError;

    // Link trading agent to agent
    await supabase
      .from("claw_trading_agents")
      .update({ agent_id: agent.id })
      .eq("id", tradingAgent.id);

    const websiteUrl = `https://claw.fun/t/${finalTicker.toUpperCase()}`;
    const finalTwitterUrl = twitterUrl?.trim() || null;

    console.log(`[saturn-trading-create] Launching token for ${finalName}...`);

    // Launch token on Meteora DBC via Vercel API
    let tokenId: string | null = null;
    let mintAddress: string | null = null;
    let dbcPoolAddress: string | null = null;

    try {
      const launchResponse = await fetch(`${VERCEL_API_URL}/api/pool/create-fun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          ticker: finalTicker,
          description: finalDescription,
          imageUrl: finalAvatarUrl,
          websiteUrl,
          twitterUrl: finalTwitterUrl,
          serverSideSign: true,
          agentId: agent.id,
          useFreshDeployer: false,
        }),
      });

      const contentType = launchResponse.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await launchResponse.text();
        console.error("[saturn-trading-create] Token launch returned non-JSON:", text.slice(0, 200));
      } else {
        const launchResult = await launchResponse.json();
        console.log("[saturn-trading-create] Token launch response:", JSON.stringify(launchResult).slice(0, 500));

        if (launchResult.success && launchResult.mintAddress) {
          tokenId = launchResult.tokenId;
          mintAddress = launchResult.mintAddress;
          dbcPoolAddress = launchResult.dbcPoolAddress;
          console.log(`[saturn-trading-create] Token launched: ${mintAddress}`);
        } else {
          console.error("[saturn-trading-create] Token launch failed:", launchResult.error);
        }
      }
    } catch (launchError) {
      console.error("[saturn-trading-create] Token launch error:", launchError);
      await supabase.from("claw_agents").delete().eq("id", agent.id);
      await supabase.from("claw_trading_agents").delete().eq("id", tradingAgent.id);
      throw new Error(`Token launch failed: ${launchError instanceof Error ? launchError.message : "Unknown error"}`);
    }

    if (!mintAddress) {
      await supabase.from("claw_agents").delete().eq("id", agent.id);
      await supabase.from("claw_trading_agents").delete().eq("id", tradingAgent.id);
      throw new Error("Token launch failed - no mint address returned.");
    }

    // Create claw_tokens record (NOT fun_tokens)
    const newTokenId = tokenId || crypto.randomUUID();
    const { error: tokenError } = await supabase
      .from("claw_tokens")
      .insert({
        id: newTokenId,
        name: finalName,
        ticker: finalTicker,
        description: finalDescription,
        image_url: finalAvatarUrl,
        mint_address: mintAddress,
        dbc_pool_address: dbcPoolAddress,
        creator_wallet: creatorWallet || walletAddress,
        deployer_wallet: walletAddress,
        agent_id: agent.id,
        trading_agent_id: tradingAgent.id,
        agent_fee_share_bps: 8000,
        is_trading_agent_token: true,
        status: "active",
        website_url: websiteUrl,
        twitter_url: finalTwitterUrl,
      });

    if (tokenError) {
      console.error("[saturn-trading-create] Failed to create claw_tokens record:", tokenError);
    }

    // Create claw_agent_tokens link
    await supabase.from("claw_agent_tokens").insert({
      agent_id: agent.id,
      fun_token_id: newTokenId,
    });

    // Create SubClaw community
    const { data: subclaw } = await supabase
      .from("claw_communities")
      .insert({
        name: finalName,
        ticker: finalTicker,
        description: `Official community for ${finalName} - Autonomous Claw Trading Agent 🦞`,
        icon_url: finalAvatarUrl,
        agent_id: agent.id,
        fun_token_id: newTokenId,
      })
      .select()
      .single();

    // Update trading_agents with token info
    await supabase
      .from("claw_trading_agents")
      .update({
        mint_address: mintAddress,
        fun_token_id: newTokenId,
        status: "pending",
      })
      .eq("id", tradingAgent.id);

    console.log(`[saturn-trading-create] ✅ Created Claw trading agent ${finalName} (${tradingAgent.id}) with token ${mintAddress}`);

    return new Response(
      JSON.stringify({
        success: true,
        tradingAgent: {
          id: tradingAgent.id,
          name: finalName,
          ticker: finalTicker,
          walletAddress,
          mintAddress,
          avatarUrl: finalAvatarUrl,
          strategy,
          biddingEndsAt: tradingAgent.bidding_ends_at,
        },
        agent: { id: agent.id, name: agent.name },
        subclaw: subclaw ? { id: subclaw.id, ticker: subclaw.ticker } : null,
        bidWalletAddress,
        message: `Claw trading agent created with token ${mintAddress}! Bidding open for 3 hours starting at 5 SOL. 🦞`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-trading-create] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aesEncrypt(plaintext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateAgentIdentity(
  apiKey: string,
  input: { name?: string; ticker?: string; description?: string; personalityPrompt?: string; strategy: string; }
): Promise<{ name: string; ticker: string; description: string }> {
  const prompt = `Generate a unique trading agent identity for a ${input.strategy} crypto trading bot with a LOBSTER/CLAW theme.

${input.personalityPrompt ? `Personality hint: ${input.personalityPrompt}` : ""}
${input.name ? `Suggested name: ${input.name}` : ""}
${input.ticker ? `Suggested ticker: ${input.ticker}` : ""}

Create a memorable, unique lobster-themed trading persona. Use claw/lobster/crustacean imagery.
The ticker should be 3-6 characters.

Respond in JSON format:
{
  "name": "Unique lobster-themed trading agent name",
  "ticker": "TICKER",
  "description": "A compelling 2-3 sentence description with lobster/claw personality"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error("AI generation failed");
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON found");
  } catch {
    return {
      name: `ClawBot${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      ticker: `CLAW${Math.random().toString(36).substring(2, 3).toUpperCase()}`,
      description: `Autonomous lobster-themed ${input.strategy} trading agent. Pinching profits from Solana markets. 🦞`,
    };
  }
}
