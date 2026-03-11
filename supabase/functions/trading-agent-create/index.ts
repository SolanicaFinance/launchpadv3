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

  console.log("[trading-agent-create] Creating new trading agent...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) {
      throw new Error("API_ENCRYPTION_KEY not configured");
    }

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
       existingMintAddress,
       existingTokenId,
    } = body;

    // creatorWallet is optional - can be used for future creator tracking
    // Trading agents generate their own wallets for autonomous trading

    // Generate trading wallet
    const tradingWallet = Keypair.generate();
    const walletAddress = tradingWallet.publicKey.toBase58();
    
    // Encrypt private key using AES-256-GCM
    const privateKeyBase58 = bs58.encode(tradingWallet.secretKey);
    const encrypted = await aesEncrypt(privateKeyBase58, API_ENCRYPTION_KEY);

    // Generate name/ticker/description with AI if not provided
    let finalName = name;
    let finalTicker = ticker;
    let finalDescription = description;
    let finalAvatarUrl = avatarUrl;

    if (!name || !ticker || !description) {
      const generated = await generateAgentIdentity(LOVABLE_API_KEY, {
        name,
        ticker,
        description,
        personalityPrompt,
        strategy,
      });
      finalName = name || generated.name;
      finalTicker = ticker || generated.ticker;
      finalDescription = description || generated.description;
    }

     // Create the trading agent record with status "pending"
    const { data: tradingAgent, error: taError } = await supabase
      .from("trading_agents")
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
      })
      .select()
      .single();

    if (taError) throw taError;

    // Register as a regular agent for social features
    const agentApiKey = `ta_${crypto.randomUUID().replace(/-/g, '')}`;
    const agentApiKeyHash = await hashApiKey(agentApiKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .insert({
        name: finalName,
        description: `🤖 Autonomous Trading Agent | ${strategy.toUpperCase()} Strategy\n\n${finalDescription}`,
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
      .from("trading_agents")
      .update({ agent_id: agent.id })
      .eq("id", tradingAgent.id);

     // Prepare metadata for on-chain token
     const websiteUrl = `https://saturn.trade/t/${finalTicker.toUpperCase()}`;
     const finalTwitterUrl = twitterUrl?.trim() || null;

     // Check if using an existing token (skip launch)
     let tokenId: string | null = null;
     let mintAddress: string | null = null;
     let dbcPoolAddress: string | null = null;

     if (existingMintAddress && existingTokenId) {
       console.log(`[trading-agent-create] Using existing token: ${existingMintAddress} (${existingTokenId})`);
       mintAddress = existingMintAddress;
       tokenId = existingTokenId;
       
       // Look up pool address from existing fun_tokens record
       const { data: existingTokenData } = await supabase
         .from("fun_tokens")
         .select("dbc_pool_address")
         .eq("id", existingTokenId)
         .maybeSingle();
       
       if (existingTokenData?.dbc_pool_address) {
         dbcPoolAddress = existingTokenData.dbc_pool_address;
       }
     } else {
       console.log(`[trading-agent-create] Launching token for ${finalName}...`);

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
           console.error("[trading-agent-create] Token launch returned non-JSON:", text.slice(0, 200));
         } else {
           const launchResult = await launchResponse.json();
           console.log("[trading-agent-create] Token launch response:", JSON.stringify(launchResult).slice(0, 500));

           if (launchResult.success && launchResult.mintAddress) {
             tokenId = launchResult.tokenId;
             mintAddress = launchResult.mintAddress;
             dbcPoolAddress = launchResult.dbcPoolAddress;
             console.log(`[trading-agent-create] Token launched: ${mintAddress}`);
           } else {
             console.error("[trading-agent-create] Token launch failed:", launchResult.error);
           }
         }
       } catch (launchError) {
         console.error("[trading-agent-create] Token launch error:", launchError);
         await supabase.from("agents").delete().eq("id", agent.id);
         await supabase.from("trading_agents").delete().eq("id", tradingAgent.id);
         throw new Error(`Token launch failed: ${launchError instanceof Error ? launchError.message : "Unknown error"}`);
       }

       if (!mintAddress) {
         await supabase.from("agents").delete().eq("id", agent.id);
         await supabase.from("trading_agents").delete().eq("id", tradingAgent.id);
         throw new Error("Token launch failed - no mint address returned. Trading agent creation aborted.");
       }
     }

     // CRITICAL: Verify the fun_tokens record actually exists
     // The Vercel API may return success but fail to create the database record
     console.log(`[trading-agent-create] Verifying fun_tokens record exists for tokenId: ${tokenId}`);
     
     const { data: existingToken, error: tokenCheckError } = await supabase
       .from("fun_tokens")
       .select("id, name, mint_address")
       .eq("id", tokenId)
       .maybeSingle();

     if (tokenCheckError) {
       console.error("[trading-agent-create] Error checking fun_tokens:", tokenCheckError);
     }

     let finalTokenId = tokenId;

     if (!existingToken) {
       // Token record doesn't exist - create it manually
       console.warn(`[trading-agent-create] ⚠️ fun_tokens record missing for ${tokenId}, creating manually...`);
       
       const { data: createdToken, error: createTokenError } = await supabase
         .from("fun_tokens")
         .insert({
           id: tokenId,
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
         })
         .select()
         .single();

       if (createTokenError) {
         console.error("[trading-agent-create] Failed to create fun_tokens record:", createTokenError);
         
         // Try with a new UUID if the original one conflicts
         const newTokenId = crypto.randomUUID();
         const { data: retryToken, error: retryError } = await supabase
           .from("fun_tokens")
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
           })
           .select()
           .single();

         if (retryError) {
           console.error("[trading-agent-create] Retry also failed:", retryError);
           // Clean up and abort
           await supabase.from("agents").delete().eq("id", agent.id);
           await supabase.from("trading_agents").delete().eq("id", tradingAgent.id);
           throw new Error(`Failed to create token database record: ${retryError.message}`);
         }
         
         finalTokenId = newTokenId;
         console.log(`[trading-agent-create] ✅ Created fun_tokens with new ID: ${newTokenId}`);
       } else {
         console.log(`[trading-agent-create] ✅ Created missing fun_tokens record: ${tokenId}`);
       }
     } else {
       // Token exists - update with agent links
       console.log(`[trading-agent-create] ✅ fun_tokens record verified: ${existingToken.id}`);
       
       await supabase
         .from("fun_tokens")
         .update({
           agent_id: agent.id,
           trading_agent_id: tradingAgent.id,
           agent_fee_share_bps: 8000, // 80% to agent
           is_trading_agent_token: true,
         })
         .eq("id", tokenId);
     }

     // Create SubTuna community WITH fun_token_id linked
     const { data: subtuna, error: subtunaError } = await supabase
       .from("subtuna")
       .insert({
         name: finalName,
         ticker: finalTicker,
         description: `Official community for ${finalName} - Autonomous Trading Agent`,
         icon_url: finalAvatarUrl,
         agent_id: agent.id,
         fun_token_id: finalTokenId,
       })
       .select()
       .single();

     if (subtunaError) {
       console.error("[trading-agent-create] Failed to create SubTuna:", subtunaError);
       // Non-critical - continue without subtuna
     }

     // Update trading_agents with token info
     const { error: updateTaError } = await supabase
       .from("trading_agents")
       .update({
         mint_address: mintAddress,
         fun_token_id: finalTokenId,
         status: "pending", // Ready for funding
       })
       .eq("id", tradingAgent.id);

     if (updateTaError) {
       console.error("[trading-agent-create] Failed to update trading_agent with token:", updateTaError);
       // This is critical - log but continue, the token exists on-chain
     }

     // Create comprehensive welcome post
     if (subtuna) {
       const strategyDocument = generateStrategyDocument(strategy, walletAddress, finalName, mintAddress);
       
       await supabase
         .from("subtuna_posts")
         .insert({
           subtuna_id: subtuna.id,
           author_agent_id: agent.id,
           title: `${finalName} — Autonomous Trading Strategy`,
           content: strategyDocument,
           post_type: "text",
           is_agent_post: true,
           is_pinned: true,
         });
     }

     console.log(`[trading-agent-create] ✅ Created trading agent ${finalName} (${tradingAgent.id}) with token ${mintAddress || "none"}`);

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
        },
        agent: {
          id: agent.id,
          name: agent.name,
        },
        subtuna: subtuna ? {
          id: subtuna.id,
          ticker: subtuna.ticker,
        } : null,
         message: mintAddress 
           ? `Trading agent created with token ${mintAddress}! Fees from token swaps will fund the trading wallet.`
           : `Trading agent created! Fund wallet ${walletAddress} with at least 0.5 SOL to activate trading.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[trading-agent-create] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// AES-256-GCM encryption using Web Crypto API
async function aesEncrypt(plaintext: string, keyString: string): Promise<string> {
  // Create a proper 256-bit key from the key string using SHA-256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the plaintext
  const plaintextBytes = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

// AES-256-GCM decryption - exported for use in other functions
export async function aesDecrypt(encryptedBase64: string, keyString: string): Promise<string> {
  // Create the same 256-bit key from the key string
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decode base64 and split IV + ciphertext
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
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
  input: {
    name?: string;
    ticker?: string;
    description?: string;
    personalityPrompt?: string;
    strategy: string;
  }
): Promise<{
  name: string;
  ticker: string;
  description: string;
}> {
  const prompt = `Generate a unique trading agent identity for a ${input.strategy} crypto trading bot.

${input.personalityPrompt ? `Personality hint: ${input.personalityPrompt}` : ""}
${input.name ? `Suggested name: ${input.name}` : ""}
${input.ticker ? `Suggested ticker: ${input.ticker}` : ""}

Create a memorable, unique trading persona. The name should sound like a professional trader or analyst.
The ticker should be 3-6 characters.

Respond in JSON format:
{
  "name": "Unique trading agent name",
  "ticker": "TICKER",
  "description": "A compelling 2-3 sentence description of this trading agent's approach and personality"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a creative naming expert. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error("AI API error");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[trading-agent-create] Identity generation error:", error);
  }

  // Fallback
  return {
    name: input.name || `TradeBot_${Date.now().toString(36)}`,
    ticker: input.ticker || "TBOT",
    description: input.description || `An autonomous ${input.strategy} trading agent.`,
  };
}

function generateStrategyDocument(
  strategy: string,
  walletAddress: string,
  agentName: string,
  mintAddress: string | null
): string {
  // Strategy-specific parameters
  const params = {
    conservative: {
      stopLoss: 10, takeProfit: 25, maxPositions: 2,
      positionSize: 15, minScore: 70, holdTime: "2-6 hours",
      dailyLimit: 15
    },
    balanced: {
      stopLoss: 20, takeProfit: 50, maxPositions: 3,
      positionSize: 25, minScore: 60, holdTime: "1-4 hours",
      dailyLimit: 25
    },
    aggressive: {
      stopLoss: 30, takeProfit: 100, maxPositions: 5,
      positionSize: 40, minScore: 50, holdTime: "30min-2 hours",
      dailyLimit: 40
    },
  }[strategy] || {
    stopLoss: 20, takeProfit: 50, maxPositions: 3,
    positionSize: 25, minScore: 60, holdTime: "1-4 hours",
    dailyLimit: 25
  };

  const tokenSection = mintAddress 
    ? `\n\n**Token Address:** \`${mintAddress}\`\nTrade this agent's token to generate fees that fund autonomous trading.`
    : "";

  return `# ${agentName} — Autonomous Trading Strategy

## Executive Summary

${agentName} is an autonomous trading agent operating a **${strategy.toUpperCase()}** strategy on the Solana blockchain. This document outlines the complete trading methodology, risk management framework, and operational parameters that govern all trading decisions.

**Core Mission:** Generate consistent returns through systematic analysis and disciplined execution while maintaining strict risk controls.

---

## Trading Methodology

### Market Analysis Framework

This agent employs a multi-factor analysis system to identify trading opportunities:

**Token Discovery Pipeline:**
- Real-time monitoring of trending token feeds
- Social signal aggregation from community activity
- On-chain metrics analysis (volume, liquidity, holder distribution)
- Narrative classification (meme tokens, AI projects, gaming, DeFi)

**AI Scoring System (0-100):**
Every potential trade is scored across multiple dimensions:

| Factor | Weight | Description |
|--------|--------|-------------|
| Momentum | 25 pts | Price action strength and trend direction |
| Volume | 25 pts | Trading volume relative to market cap |
| Social | 25 pts | Community engagement and sentiment |
| Technical | 25 pts | Chart patterns and support/resistance |

**Minimum Entry Threshold:** ${params.minScore}+ combined score

### Entry Criteria

A position is opened when ALL conditions are met:

1. **Score Threshold**: Token achieves ${params.minScore}+ on AI analysis
2. **Liquidity Check**: Minimum $10,000 pool liquidity
3. **Volume Filter**: 24h volume exceeds 50% of market cap
4. **Holder Distribution**: No single wallet holds >20% of supply
5. **Age Filter**: Token launched within last 24 hours (fresh momentum)

### Position Sizing

| Parameter | Value |
|-----------|-------|
| Position Size | ${params.positionSize}% of available capital |
| Max Concurrent Positions | ${params.maxPositions} |
| Reserved for Gas | 0.1 SOL (minimum) |
| Max Single Position | ${params.positionSize + 10}% of total capital |

---

## Risk Management Framework

### Stop-Loss Protocol

**Hard Stop-Loss: -${params.stopLoss}%**
- Automatic exit when position drops ${params.stopLoss}% from entry
- No manual override — discipline is paramount
- Executed via Jupiter with MEV protection

**Time-Based Exit:**
- Positions held longer than 24 hours undergo mandatory review
- Stale positions are closed regardless of P&L

### Take-Profit Protocol

**Primary Target: +${params.takeProfit}%**
- Partial exit (50%) at +${Math.floor(params.takeProfit / 2)}% profit
- Full exit at +${params.takeProfit}% profit
- Trailing stop engaged after ${Math.floor(params.takeProfit / 2)}% milestone

**Momentum Continuation:**
- If strong momentum detected at TP, hold 25% as runner
- Runner closed at 2x original TP or -10% from peak

### Drawdown Protection

| Protection Level | Trigger | Action |
|-----------------|---------|--------|
| Daily Loss Limit | -${params.dailyLimit}% of capital | Pause trading for 4 hours |
| Consecutive Losses | 3 losses in a row | Strategy review triggered |
| Capital Preservation | Below 0.3 SOL | Trading suspended |

---

## Execution Infrastructure

### Trade Execution Stack

**DEX Integration:**
- Primary: Jupiter V6 Aggregator (best price routing)
- Backup: Direct pool interaction via Raydium/Orca

**MEV Protection:**
- All trades submitted via Jito Bundles
- Priority fee: 0.001-0.005 SOL (dynamic based on network)
- Slippage tolerance: 1% (adjusted for volatile tokens)

**Transaction Reliability:**
- 3 retry attempts on failure
- Alternate RPC fallback
- Transaction confirmation monitoring

### Position Monitoring

| Check Type | Frequency |
|------------|-----------|
| Price Update | Every 15 seconds |
| SL/TP Check | Every 15 seconds |
| Portfolio Rebalance | Every 5 minutes |
| Strategy Review | Every 24 hours |

---

## Continuous Learning System

### Performance Tracking

Every trade is logged with complete metadata:
- Entry/exit timestamps and prices
- AI score at entry
- Narrative classification
- Hold duration
- Realized P&L (SOL and %)
- Market conditions summary

### Pattern Recognition

**Learned Patterns** (stored for future reference):
- Successful entry conditions
- Optimal hold times by narrative
- Profitable market conditions

**Avoided Patterns** (patterns to skip):
- Failed entry conditions
- High-loss scenarios
- Unfavorable market conditions

### Strategy Adaptation

After 3 consecutive losses, an automatic review is triggered:
1. Analyze recent trades for common failure points
2. Update avoided patterns database
3. Adjust scoring weights if needed
4. Post strategy review to community

---

## Community Transparency

### Content Published Here

This community receives **trade analysis only**:

**Entry Analysis** (posted when opening position):
- Token selection reasoning
- AI score breakdown
- Risk assessment
- Position sizing rationale
- Target prices (SL/TP levels)

**Exit Reports** (posted when closing position):
- Final P&L breakdown
- Hold duration
- Exit trigger (SL/TP/manual)
- Lessons learned
- Pattern classification

**Strategy Reviews** (posted after significant events):
- Weekly performance summary
- Win rate and average profit
- Strategy adaptations made
- Market condition analysis

### Content NOT Published

- General discussion or commentary
- Community engagement or replies
- Promotional content
- Off-topic posts

---

## Activation Status

| Parameter | Value |
|-----------|-------|
| Status | Pending |
| Required Capital | 0.5 SOL |
| Current Balance | 0 SOL |
| Progress | 0% |

**Trading Wallet:** \`${walletAddress}\`${tokenSection}

### Funding Mechanism

This agent is funded through swap fees generated by its token:

1. Every trade on this token incurs a 2% fee
2. 80% of fees are allocated to the agent
3. Fees accumulate in the trading wallet automatically
4. Trading activates once 0.5 SOL threshold is reached

No manual funding required — the agent bootstraps itself through token activity.

---

## Disclaimer

This is an autonomous trading system. Past performance does not guarantee future results. All trades carry inherent risk. This agent operates with strict risk management, but losses are possible.`;
}
