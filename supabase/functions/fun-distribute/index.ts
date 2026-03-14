import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Partner fee split configuration (3 weeks from Feb 6, 2026)
// IMPORTANT: Only applies to tokens LAUNCHED after this date (not retroactive)
const PARTNER_WALLET = "7Tegs2EwsK8icYHHryFvv5FwNxhQJMp2HhM2zVTq9uBh";
const PARTNER_SPLIT_START = new Date("2026-02-06T00:00:00Z");
const PARTNER_SPLIT_EXPIRES = new Date("2026-02-27T00:00:00Z"); // 3 weeks from Feb 6

function isPartnerSplitActive(): boolean {
  return new Date() < PARTNER_SPLIT_EXPIRES;
}

// Check if a specific token qualifies for partner split (launched after agreement started)
function isTokenEligibleForPartnerSplit(tokenCreatedAt: string | Date | null | undefined): boolean {
  if (!isPartnerSplitActive()) return false;
  if (!tokenCreatedAt) return false;
  const createdDate = new Date(tokenCreatedAt);
  return createdDate >= PARTNER_SPLIT_START;
}

// Fee distribution splits for REGULAR tokens (non-API, non-Agent)
const CREATOR_FEE_SHARE = 0.5;    // 50% to creator
const BUYBACK_FEE_SHARE = 0.3;   // 30% for buybacks
const SYSTEM_FEE_SHARE = 0.2;    // 20% kept for system expenses

// Fee distribution splits for API-LAUNCHED tokens
// Total trading fee is 2%, split 50/50:
// - API users get 50% = 1% of total trade volume
// - Platform keeps 50% = 1% of total trade volume (stays in treasury)
const API_USER_FEE_SHARE = 0.5;   // 50% to API account owner (1% of 2%)
const API_PLATFORM_FEE_SHARE = 0.5; // 50% to platform (1% of 2%)

// Fee distribution splits for AGENT-LAUNCHED tokens
// New 3-way split: 30% creator, 30% agent trading pool, 40% system
const AGENT_CREATOR_FEE_SHARE = 0.3;   // 30% to X launcher/creator
const AGENT_TRADING_FEE_SHARE = 0.3;   // 30% to agent trading wallet
const AGENT_PLATFORM_FEE_SHARE = 0.4;  // 40% to platform

// Minimum SOL to distribute (avoid micro-transactions that eat gas)
const MIN_DISTRIBUTION_SOL = 0.05;

// Maximum retries for transaction
const MAX_TX_RETRIES = 3;

// Helper function to send partner fee and record in database
async function sendPartnerFee(
  connection: Connection,
  treasuryKeypair: Keypair,
  supabase: any,
  token: any,
  partnerAmount: number,
  launchpadType: string,
  feeMode: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  // Skip dust amounts
  if (partnerAmount < 0.001) {
    console.log(`[fun-distribute] Skipping partner fee dust: ${partnerAmount.toFixed(6)} SOL`);
    return { success: true };
  }

  try {
    const partnerPubkey = new PublicKey(PARTNER_WALLET);
    const lamports = Math.floor(partnerAmount * 1e9);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: partnerPubkey,
        lamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    // Record in partner_fee_distributions
    await supabase.from("partner_fee_distributions").insert({
      fun_token_id: token?.id || null,
      token_name: token?.name || null,
      token_ticker: token?.ticker || null,
      launchpad_type: launchpadType || 'tuna',
      fee_mode: feeMode || 'creator',
      amount_sol: partnerAmount,
      signature,
      status: 'completed',
    });

    console.log(`[fun-distribute] ✅ Sent ${partnerAmount.toFixed(6)} SOL to partner wallet, sig: ${signature}`);
    return { success: true, signature };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[fun-distribute] ❌ Failed to send partner fee:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[fun-distribute] ⏰ Starting fee distribution cron job...");
  console.log(`[fun-distribute] Partner split active: ${isPartnerSplitActive()} (expires: ${PARTNER_SPLIT_EXPIRES.toISOString()})`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get treasury keypair for sending payments
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryPrivateKey) {
      throw new Error("TREASURY_PRIVATE_KEY not configured");
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Parse treasury keypair
    let treasuryKeypair: Keypair;
    try {
      if (treasuryPrivateKey.startsWith("[")) {
        const keyArray = JSON.parse(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else {
        const decoded = bs58.decode(treasuryPrivateKey);
        treasuryKeypair = Keypair.fromSecretKey(decoded);
      }
    } catch (e) {
      throw new Error("Invalid TREASURY_PRIVATE_KEY format");
    }

    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Check treasury balance first
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;
    console.log(`[fun-distribute] Treasury balance: ${treasuryBalanceSol.toFixed(4)} SOL`);

    if (treasuryBalanceSol < 0.01) {
      console.warn("[fun-distribute] ⚠️ Treasury balance low, skipping distributions");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Treasury balance too low for distributions",
          treasuryBalance: treasuryBalanceSol 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STEP 1: Find all fee claims that haven't been distributed yet
    // Include api_account_id, agent_id, trading_agent_id, is_trading_agent_token, and fee_mode to check token type
    const { data: undistributedClaims, error: claimsError } = await supabase
      .from("fun_fee_claims")
      .select(`
        *,
        fun_token:fun_tokens(id, name, ticker, creator_wallet, punch_creator_wallet, status, api_account_id, agent_id, trading_agent_id, is_trading_agent_token, fee_mode, agent_fee_share_bps, launchpad_type, created_at, trading_fee_bps, creator_fee_bps)
      `)
      .eq("creator_distributed", false)
      .order("claimed_at", { ascending: true });

    if (claimsError) {
      throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    }

    console.log(`[fun-distribute] Found ${undistributedClaims?.length || 0} undistributed claims`);

    if (!undistributedClaims || undistributedClaims.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending distributions",
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      claimIds: string[];
      tokenName: string;
      recipientWallet: string;
      recipientType: "creator" | "api_user" | "agent";
      claimedSol: number;
      recipientAmount: number;
      platformAmount: number;
      partnerAmount?: number;
      success: boolean;
      signature?: string;
      error?: string;
    }> = [];

    let totalDistributed = 0;
    let totalPartnerDistributed = 0;
    let successCount = 0;
    let failureCount = 0;
    let apiFeesRecorded = 0;

    // STEP 2: Batch claims per token and only pay once the accumulated
    // share reaches MIN_DISTRIBUTION_SOL.
    const groups = new Map<
      string,
      {
        token: any;
        recipientWallet: string;
        recipientType: "creator" | "api_user" | "agent";
        apiAccountId: string | null;
        agentId: string | null;
        tradingAgentId?: string | null; // Direct link for trading agents
        claims: any[];
        claimedSol: number;
      }
    >();

    for (const claim of undistributedClaims) {
      const token = claim.fun_token;

      if (!token) {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: no token found`);
        continue;
      }

      if (token.status !== "active") {
        console.warn(`[fun-distribute] Skipping claim ${claim.id}: token ${token.ticker} is not active`);
        continue;
      }

      const claimedSol = Number(claim.claimed_sol) || 0;
      if (claimedSol <= 0) continue;

      // PUNCH tokens: 70% creator / 30% platform
      if (token.launchpad_type === 'punch') {
        const punchCreatorWallet = token.punch_creator_wallet;
        if (!punchCreatorWallet) {
          console.warn(`[fun-distribute] Skipping punch claim ${claim.id}: no punch_creator_wallet set for ${token.ticker}`);
          continue;
        }

        const key = `punch:${token.id}:${punchCreatorWallet}`;
        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: punchCreatorWallet,
            recipientType: "creator",
            apiAccountId: null,
            agentId: null,
            claims: [claim],
            claimedSol,
          });
        }
        continue;
      }

      // Determine token type: Trading Agent, Agent, API, holder_rewards, bags, or regular creator
      // IMPORTANT: Trading Agent tokens take TOP priority - they need fees for trading capital
      const isTradingAgentToken = token.is_trading_agent_token === true && !!token.trading_agent_id;
      const isAgentToken = !!token.agent_id;
      const isApiToken = !!token.api_account_id && !isAgentToken; // Agent takes priority
      const isHolderRewards = token.fee_mode === 'holder_rewards' || token.fee_mode === 'holders';
      const isBagsToken = token.launchpad_type === 'bags';
      
      // TRADING AGENT TOKENS: Always route to trading wallet, regardless of fee_mode
      // This takes priority over holder_rewards because trading agents need the fees for capital
      if (isTradingAgentToken) {
        const { data: tradingAgent } = await supabase
          .from("trading_agents")
          .select("id, wallet_address, trading_capital_sol, status, name")
          .eq("id", token.trading_agent_id)
          .maybeSingle();

        if (!tradingAgent) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: Trading Agent ${token.trading_agent_id} not found`);
          continue;
        }

        const key = `trading-agent:${token.trading_agent_id}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: tradingAgent.wallet_address,
            recipientType: "agent",
            apiAccountId: null,
            agentId: token.agent_id, // Keep for compatibility
            tradingAgentId: token.trading_agent_id, // Direct link
            claims: [claim],
            claimedSol,
          });
        }
        console.log(`[fun-distribute] Trading Agent token ${token.ticker}: routing ${claimedSol.toFixed(6)} SOL to trading wallet`);
        continue; // Skip other modes - trading agent takes priority
      }
      
      // BAGS tokens: 100% platform fee, no creator distribution
      // But if partner split is active, 50% goes to partner
      if (isBagsToken) {
        // Handle partner split for bags tokens
        if (isTokenEligibleForPartnerSplit(token.created_at)) {
          const partnerAmount = claimedSol * 0.5; // 50% of platform share (which is 100%)
          await sendPartnerFee(connection, treasuryKeypair, supabase, token, partnerAmount, 'bags', 'bags');
          totalPartnerDistributed += partnerAmount;
          console.log(`[fun-distribute] Bags token ${token.ticker}: ${partnerAmount.toFixed(6)} SOL to partner, rest to platform`);
        }
        
        // Mark claim as distributed - platform keeps rest
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .eq("id", claim.id);
        
        console.log(`[fun-distribute] Bags token ${token.ticker}: 100% to platform, no creator split`);
        continue;
      }
      
      if (isHolderRewards) {
        // HOLDER REWARDS MODE: Route 50% to holder_reward_pool instead of creator
        // The fun-holder-distribute cron will distribute to holders every 5 minutes
        const holderAmount = claimedSol * CREATOR_FEE_SHARE; // 50% goes to holder pool
        let platformAmount = claimedSol * (1 - CREATOR_FEE_SHARE); // 50% platform
        
        // Partner split from platform share
        if (isTokenEligibleForPartnerSplit(token.created_at)) {
          const partnerAmount = platformAmount * 0.5;
          platformAmount = platformAmount * 0.5;
          await sendPartnerFee(connection, treasuryKeypair, supabase, token, partnerAmount, 'tuna', 'holders');
          totalPartnerDistributed += partnerAmount;
        }
        
        // Upsert into holder_reward_pool
        const { data: existingPool } = await supabase
          .from("holder_reward_pool")
          .select("id, accumulated_sol")
          .eq("fun_token_id", token.id)
          .maybeSingle();

        if (existingPool) {
          await supabase
            .from("holder_reward_pool")
            .update({
              accumulated_sol: (existingPool.accumulated_sol || 0) + holderAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPool.id);
        } else {
          await supabase
            .from("holder_reward_pool")
            .insert({
              fun_token_id: token.id,
              accumulated_sol: holderAmount,
            });
        }

        // Mark claim as distributed (holders will be paid by separate cron)
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .eq("id", claim.id);

        console.log(`[fun-distribute] Holder rewards token ${token.ticker}: accumulated ${holderAmount.toFixed(6)} SOL for holders`);
        continue;
      }
      
      if (isAgentToken) {
        // AGENT tokens: 80% goes to agent, 20% to platform
        const { data: agentData } = await supabase
          .from("agents")
          .select("id, wallet_address, name")
          .eq("id", token.agent_id)
          .single();

        if (!agentData) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: Agent ${token.agent_id} not found`);
          continue;
        }

        const key = `agent:${token.agent_id}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: agentData.wallet_address,
            recipientType: "agent",
            apiAccountId: null,
            agentId: token.agent_id,
            claims: [claim],
            claimedSol,
          });
        }
      } else if (isApiToken) {
        // API tokens: fees go to API account owner (will be recorded in api_fee_distributions)
        // We need to fetch the API account's fee wallet
        const { data: apiAccount } = await supabase
          .from("api_accounts")
          .select("id, fee_wallet_address, wallet_address")
          .eq("id", token.api_account_id)
          .single();

        if (!apiAccount) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: API account ${token.api_account_id} not found`);
          continue;
        }

        const feeWallet = apiAccount.fee_wallet_address || apiAccount.wallet_address;
        const key = `api:${token.api_account_id}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: feeWallet,
            recipientType: "api_user",
            apiAccountId: token.api_account_id,
            agentId: null,
            claims: [claim],
            claimedSol,
          });
        }
      } else {
        // Regular tokens: fees go to creator
        if (!token.creator_wallet) {
          console.warn(`[fun-distribute] Skipping claim ${claim.id}: no creator wallet`);
          continue;
        }

        const creatorWallet = String(token.creator_wallet);
        const key = `creator:${token.id}:${creatorWallet}`;

        const existing = groups.get(key);
        if (existing) {
          existing.claims.push(claim);
          existing.claimedSol += claimedSol;
        } else {
          groups.set(key, {
            token,
            recipientWallet: creatorWallet,
            recipientType: "creator",
            apiAccountId: null,
            agentId: null,
            claims: [claim],
            claimedSol,
          });
        }
      }
    }

    console.log(`[fun-distribute] Prepared ${groups.size} batch(es) for processing`);

    for (const group of groups.values()) {
      const token = group.token;
      const claimedSol = group.claimedSol;
      const isAgentToken = group.recipientType === "agent";
      const isApiToken = group.recipientType === "api_user";

      // Calculate fee splits based on token type
      let recipientAmount: number;
      let platformAmount: number;
      let partnerAmount = 0;

      if (isAgentToken) {
        // Agent tokens: 30% creator / 30% agent trading / 40% system
        const isTradingAgent = !!group.tradingAgentId;
        recipientAmount = claimedSol * AGENT_TRADING_FEE_SHARE; // 30% to agent/trading wallet
        platformAmount = claimedSol * AGENT_PLATFORM_FEE_SHARE; // 40% to platform
        // Creator 30% is handled separately below (held if no wallet linked yet)
        const creatorAmount = claimedSol * AGENT_CREATOR_FEE_SHARE; // 30% to X creator
        
        // Partner split from platform share
        if (isTokenEligibleForPartnerSplit(token.created_at)) {
          partnerAmount = platformAmount * 0.5;
          platformAmount = platformAmount * 0.5;
        }
        
        // Store creator amount for later distribution
        (group as any)._creatorAmount = creatorAmount;
        
        console.log(
          `[fun-distribute] ${isTradingAgent ? 'Trading' : 'Standard'} Agent Token ${token.ticker}: ${claimedSol} SOL → Agent 30% (${recipientAmount.toFixed(6)}), Creator 30% (${creatorAmount.toFixed(6)}), Platform 40% (${platformAmount.toFixed(6)})${partnerAmount > 0 ? `, Partner ${partnerAmount.toFixed(6)}` : ''}`
        );
      } else if (isApiToken) {
        // API tokens: 50/50 split between API user and platform
        recipientAmount = claimedSol * API_USER_FEE_SHARE;
        platformAmount = claimedSol * API_PLATFORM_FEE_SHARE;
        
        // Partner split from platform share
        if (isTokenEligibleForPartnerSplit(token.created_at)) {
          partnerAmount = platformAmount * 0.5;
          platformAmount = platformAmount * 0.5;
        }
        
        console.log(
          `[fun-distribute] API Token ${token.ticker}: ${claimedSol} SOL → API User ${recipientAmount.toFixed(6)}, Platform ${platformAmount.toFixed(6)}${partnerAmount > 0 ? `, Partner ${partnerAmount.toFixed(6)}` : ''}`
        );
      } else {
        // Check if this is a punch token (70/30 split)
        const isPunchToken = token.launchpad_type === 'punch';
        
        if (isPunchToken) {
          // Punch tokens: 70% creator, 30% platform
          const PUNCH_CREATOR_FEE_SHARE = 0.7;
          const PUNCH_SYSTEM_FEE_SHARE = 0.3;
          recipientAmount = claimedSol * PUNCH_CREATOR_FEE_SHARE;
          platformAmount = claimedSol * PUNCH_SYSTEM_FEE_SHARE;
          
          // Partner split from platform share if eligible
          if (isTokenEligibleForPartnerSplit(token.created_at)) {
            partnerAmount = platformAmount * 0.5;
            platformAmount = platformAmount * 0.5;
          }
          
          console.log(
            `[fun-distribute] Punch Token ${token.ticker}: ${claimedSol} SOL → Creator 70% (${recipientAmount.toFixed(6)}), Platform 30% (${platformAmount.toFixed(6)})${partnerAmount > 0 ? `, Partner ${partnerAmount.toFixed(6)}` : ''}`
          );
        } else {
          // Regular/Phantom tokens
          const isPhantom = token.launchpad_type === 'phantom';
          
          // Phantom tokens with stored fee breakdown: use creator_fee_bps / trading_fee_bps ratio
          if (isPhantom && token.trading_fee_bps && token.creator_fee_bps != null) {
            const creatorShare = token.creator_fee_bps / token.trading_fee_bps;
            const platformShare = 1 - creatorShare;
            recipientAmount = claimedSol * creatorShare;
            platformAmount = claimedSol * platformShare;
            
            console.log(
              `[fun-distribute] Phantom Token ${token.ticker}: ${claimedSol} SOL → Creator ${(creatorShare * 100).toFixed(1)}% (${recipientAmount.toFixed(6)}), Platform ${(platformShare * 100).toFixed(1)}% (${platformAmount.toFixed(6)}) [${token.creator_fee_bps}/${token.trading_fee_bps} bps]`
            );
          } else {
            // Legacy regular tokens: creator gets 50%, rest for buyback/system
            recipientAmount = claimedSol * CREATOR_FEE_SHARE;
            platformAmount = claimedSol * (BUYBACK_FEE_SHARE + SYSTEM_FEE_SHARE);
            
            // Partner split from platform share - EXCLUDE Phantom mode tokens
            if (!isPhantom && isTokenEligibleForPartnerSplit(token.created_at)) {
              partnerAmount = platformAmount * 0.5;
              platformAmount = platformAmount * 0.5;
            }
            
            console.log(
              `[fun-distribute] ${isPhantom ? 'Phantom (legacy)' : 'Regular'} Token ${token.ticker}: ${claimedSol} SOL → Creator ${recipientAmount.toFixed(6)}, Platform ${platformAmount.toFixed(6)}${partnerAmount > 0 ? `, Partner ${partnerAmount.toFixed(6)}` : ''}`
            );
          }
        }
      }

      // Send partner fee if applicable
      if (partnerAmount > 0) {
        const launchpadType = token.launchpad_type || 'tuna';
        const feeMode = isAgentToken ? 'agent' : (isApiToken ? 'api' : 'creator');
        const partnerResult = await sendPartnerFee(connection, treasuryKeypair, supabase, token, partnerAmount, launchpadType, feeMode);
        if (partnerResult.success) {
          totalPartnerDistributed += partnerAmount;
        }
      }

      // AGENT tokens: record in agent_fee_distributions (pending - they claim when ready)
      if (isAgentToken && (group.tradingAgentId || group.agentId)) {
        // Check if this is a Trading Agent - use tradingAgentId if available (more reliable)
        let tradingAgent = null;
        
        if (group.tradingAgentId) {
          // Direct lookup using trading_agent_id from fun_tokens
          const { data } = await supabase
            .from("trading_agents")
            .select("id, wallet_address, trading_capital_sol, status")
            .eq("id", group.tradingAgentId)
            .maybeSingle();
          tradingAgent = data;
        } else if (group.agentId) {
          // Fallback: lookup via agent_id (for legacy tokens)
          const { data } = await supabase
            .from("trading_agents")
            .select("id, wallet_address, trading_capital_sol, status")
            .eq("agent_id", group.agentId)
            .maybeSingle();
          tradingAgent = data;
        }
 
        if (tradingAgent) {
          // This is a TRADING AGENT - send SOL directly to trading wallet
          console.log(`[fun-distribute] Trading Agent detected: ${tradingAgent.id}, sending ${recipientAmount.toFixed(6)} SOL to trading wallet`);
          
          try {
            // Transfer SOL to trading agent wallet
            const transferTx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey: new PublicKey(tradingAgent.wallet_address),
                lamports: Math.floor(recipientAmount * 1e9),
              })
            );
 
            const signature = await sendAndConfirmTransaction(connection, transferTx, [treasuryKeypair], {
              commitment: "confirmed",
            });
 
            // Record in trading_agent_fee_deposits
            await supabase.from("trading_agent_fee_deposits").insert({
              trading_agent_id: tradingAgent.id,
              amount_sol: recipientAmount,
              source: "fee_distribution",
              signature,
            });
 
            // Update trading capital and auto-activate if threshold reached
            const newCapital = (tradingAgent.trading_capital_sol || 0) + recipientAmount;
            const FUNDING_THRESHOLD = 0.5;
            const newStatus = newCapital >= FUNDING_THRESHOLD ? "active" : tradingAgent.status;
 
            await supabase.from("trading_agents").update({
              trading_capital_sol: newCapital,
              status: newStatus,
            }).eq("id", tradingAgent.id);
 
            // Mark claims as distributed
            const claimIds = group.claims.map((c) => c.id);
            await supabase.from("fun_fee_claims").update({ creator_distributed: true }).in("id", claimIds);
 
            results.push({
              claimIds,
              tokenName: token.name,
              recipientWallet: tradingAgent.wallet_address,
              recipientType: "agent",
              claimedSol,
              recipientAmount,
              platformAmount,
              partnerAmount,
              success: true,
              signature,
            });
 
            totalDistributed += recipientAmount;
            successCount++;
            console.log(`[fun-distribute] ✅ Sent ${recipientAmount.toFixed(6)} SOL to Trading Agent wallet ${tradingAgent.wallet_address} (new capital: ${newCapital.toFixed(4)}, status: ${newStatus})`);
            continue;
          } catch (txError) {
            console.error(`[fun-distribute] ❌ Failed to transfer to Trading Agent:`, txError);
            // Fall through to regular agent distribution
          }
        }
 
        // Regular agent (not a Trading Agent) - record in agent_fee_distributions
        const { error: agentDistError } = await supabase
          .from("agent_fee_distributions")
          .insert({
            agent_id: group.agentId,
            fun_token_id: token.id,
            amount_sol: recipientAmount,
            status: "pending",
          });

        if (agentDistError) {
          console.error(`[fun-distribute] Failed to record agent fee distribution:`, agentDistError);
          results.push({
            claimIds: group.claims.map((c) => c.id),
            tokenName: token.name,
            recipientWallet: group.recipientWallet,
            recipientType: "agent",
            claimedSol,
            recipientAmount,
            platformAmount,
            partnerAmount,
            success: false,
            error: `DB error: ${agentDistError.message}`,
          });
          failureCount++;
          continue;
        }

        // Update agent's total fees earned
        const { data: currentAgent } = await supabase
          .from("agents")
          .select("total_fees_earned_sol")
          .eq("id", group.agentId)
          .single();

        await supabase
          .from("agents")
          .update({
            total_fees_earned_sol: (currentAgent?.total_fees_earned_sol || 0) + recipientAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", group.agentId);

        // Mark claims as distributed (agent can claim anytime)
        const claimIds = group.claims.map((c) => c.id);
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .in("id", claimIds);

        results.push({
          claimIds,
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "agent",
          claimedSol,
          recipientAmount,
          platformAmount,
          partnerAmount,
          success: true,
        });

        successCount++;
        console.log(`[fun-distribute] ✅ Recorded ${recipientAmount.toFixed(6)} SOL for agent ${group.agentId} (claimable)`);
        continue;
      }

      // For API tokens, we record in api_fee_distributions but DON'T send immediately
      // API users claim manually via api-claim-fees when they want
      if (isApiToken && group.apiAccountId) {
        // Record the fee distribution for the API user (pending - they claim when ready)
        const { error: apiDistError } = await supabase
          .from("api_fee_distributions")
          .insert({
            api_account_id: group.apiAccountId,
            token_id: token.id,
            total_fee_sol: claimedSol,
            api_user_share: recipientAmount,
            platform_share: platformAmount,
            status: "pending",
          });

        if (apiDistError) {
          console.error(`[fun-distribute] Failed to record API fee distribution:`, apiDistError);
          results.push({
            claimIds: group.claims.map((c) => c.id),
            tokenName: token.name,
            recipientWallet: group.recipientWallet,
            recipientType: "api_user",
            claimedSol,
            recipientAmount,
            platformAmount,
            partnerAmount,
            success: false,
            error: `DB error: ${apiDistError.message}`,
          });
          failureCount++;
          continue;
        }

        // Update API account's total fees earned
        const { data: currentAccount } = await supabase
          .from("api_accounts")
          .select("total_fees_earned")
          .eq("id", group.apiAccountId)
          .single();

        await supabase
          .from("api_accounts")
          .update({
            total_fees_earned: (currentAccount?.total_fees_earned || 0) + recipientAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", group.apiAccountId);

        // Mark claims as distributed (API user can claim anytime)
        const claimIds = group.claims.map((c) => c.id);
        await supabase
          .from("fun_fee_claims")
          .update({ creator_distributed: true })
          .in("id", claimIds);

        results.push({
          claimIds,
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "api_user",
          claimedSol,
          recipientAmount,
          platformAmount,
          partnerAmount,
          success: true,
        });

        apiFeesRecorded++;
        successCount++;
        console.log(`[fun-distribute] ✅ Recorded ${recipientAmount.toFixed(6)} SOL for API user ${group.apiAccountId} (claimable)`);
        continue;
      }

      // For regular tokens, skip if below minimum
      if (recipientAmount < MIN_DISTRIBUTION_SOL) {
        console.log(
          `[fun-distribute] Deferring ${token.ticker}: accumulated amount ${recipientAmount.toFixed(6)} < ${MIN_DISTRIBUTION_SOL} SOL`
        );
        continue;
      }

      // STEP 3: Create distribution record FIRST (pending state) - safety net
      const { data: distribution, error: distError } = await supabase
        .from("fun_distributions")
        .insert({
          fun_token_id: token.id,
          creator_wallet: group.recipientWallet,
          amount_sol: recipientAmount,
          distribution_type: token.launchpad_type === 'punch' ? "punch_creator" : "creator",
          status: "pending",
        })
        .select()
        .single();

      if (distError) {
        console.error(`[fun-distribute] Failed to create distribution record:`, distError);
        results.push({
          claimIds: group.claims.map((c) => c.id),
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
          partnerAmount,
          success: false,
          error: `DB error: ${distError.message}`,
        });
        failureCount++;
        continue;
      }

      // STEP 4: Send SOL to creator with retries
      let txSuccess = false;
      let txSignature: string | undefined;
      let txError: string | undefined;

      for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
        try {
          console.log(
            `[fun-distribute] Sending ${recipientAmount.toFixed(6)} SOL to ${group.recipientWallet} (attempt ${attempt})`
          );

          const recipientPubkey = new PublicKey(group.recipientWallet);
          const lamports = Math.floor(recipientAmount * 1e9);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );

          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;

          txSignature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
            commitment: "confirmed",
            maxRetries: 3,
          });

          console.log(`[fun-distribute] ✅ Sent ${recipientAmount} SOL to ${group.recipientWallet}, sig: ${txSignature}`);
          txSuccess = true;
          break;
        } catch (e) {
          txError = e instanceof Error ? e.message : "Unknown error";
          console.error(`[fun-distribute] ❌ TX attempt ${attempt} failed:`, txError);

          if (attempt < MAX_TX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt)); // Exponential backoff
          }
        }
      }

      // STEP 5: Update distribution record + mark ALL claims in the batch
      if (txSuccess && txSignature) {
        await supabase
          .from("fun_distributions")
          .update({
            status: "completed",
            signature: txSignature,
          })
          .eq("id", distribution.id);

        const claimIds = group.claims.map((c) => c.id);
        await supabase
          .from("fun_fee_claims")
          .update({
            creator_distributed: true,
            creator_distribution_id: distribution.id,
          })
          .in("id", claimIds);

        console.log(
          `[fun-distribute] Reserved for platform: ${platformAmount.toFixed(6)} SOL`
        );

        results.push({
          claimIds,
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
          partnerAmount,
          success: true,
          signature: txSignature,
        });

        totalDistributed += recipientAmount;
        successCount++;
      } else {
        // Transaction failed - mark distribution as failed but DON'T mark claims as distributed
        await supabase.from("fun_distributions").update({ status: "failed" }).eq("id", distribution.id);

        results.push({
          claimIds: group.claims.map((c) => c.id),
          tokenName: token.name,
          recipientWallet: group.recipientWallet,
          recipientType: "creator",
          claimedSol,
          recipientAmount,
          platformAmount,
          partnerAmount,
          success: false,
          error: txError || "Transaction failed after retries",
        });

        failureCount++;
      }
    }

    // STEP 6: Distribute referral rewards
    console.log("[fun-distribute] Processing referral reward payouts...");
    let referralPayouts = 0;
    let referralTotalSol = 0;

    const { data: unpaidRewards, error: rewardsError } = await supabase
      .from("referral_rewards")
      .select("referrer_id, reward_sol")
      .eq("paid", false);

    if (!rewardsError && unpaidRewards && unpaidRewards.length > 0) {
      // Batch by referrer
      const referrerTotals = new Map<string, number>();
      for (const rw of unpaidRewards) {
        const current = referrerTotals.get(rw.referrer_id) || 0;
        referrerTotals.set(rw.referrer_id, current + Number(rw.reward_sol));
      }

      for (const [referrerId, totalReward] of referrerTotals) {
        if (totalReward < MIN_DISTRIBUTION_SOL) {
          console.log(`[fun-distribute] Deferring referral payout for ${referrerId}: ${totalReward.toFixed(6)} < ${MIN_DISTRIBUTION_SOL}`);
          continue;
        }

        // Get referrer's wallet from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", referrerId)
          .maybeSingle();

        if (!profile?.wallet_address) {
          console.warn(`[fun-distribute] No wallet for referrer ${referrerId}`);
          continue;
        }

        try {
          const lamports = Math.floor(totalReward * 1e9);
          const recipientPubkey = new PublicKey(profile.wallet_address);
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: treasuryKeypair.publicKey,
              toPubkey: recipientPubkey,
              lamports,
            })
          );
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = treasuryKeypair.publicKey;

          const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
            commitment: "confirmed",
            maxRetries: 3,
          });

          // Mark as paid
          await supabase
            .from("referral_rewards")
            .update({ paid: true, payout_signature: signature })
            .eq("referrer_id", referrerId)
            .eq("paid", false);

          referralPayouts++;
          referralTotalSol += totalReward;
          totalDistributed += totalReward;
          console.log(`[fun-distribute] ✅ Referral payout: ${totalReward.toFixed(6)} SOL to ${profile.wallet_address}, sig: ${signature}`);
        } catch (e) {
          console.error(`[fun-distribute] ❌ Referral payout failed for ${referrerId}:`, e);
        }
      }
    }
    console.log(`[fun-distribute] Referral payouts: ${referralPayouts}, total: ${referralTotalSol.toFixed(6)} SOL`);

    // STEP 7: Process pump.fun fee claims (pumpfun_fee_claims table)
    console.log("[fun-distribute] Processing pump.fun fee claims...");
    
    const { data: pumpfunClaims, error: pumpfunError } = await supabase
      .from("pumpfun_fee_claims")
      .select(`
        *,
        fun_token:fun_tokens(id, name, ticker, creator_wallet, deployer_wallet, status)
      `)
      .eq("distributed", false)
      .order("claimed_at", { ascending: true });

    if (pumpfunError) {
      console.error("[fun-distribute] Error fetching pump.fun claims:", pumpfunError);
    }

    let pumpfunDistributed = 0;
    let pumpfunSuccessCount = 0;

    if (pumpfunClaims && pumpfunClaims.length > 0) {
      console.log(`[fun-distribute] Found ${pumpfunClaims.length} undistributed pump.fun claims`);

      for (const claim of pumpfunClaims) {
        const token = claim.fun_token;
        if (!token || token.status !== "active") {
          console.warn(`[fun-distribute] Skipping pumpfun claim ${claim.id}: token not active`);
          continue;
        }

        const claimedSol = Number(claim.claimed_sol) || 0;
        if (claimedSol <= 0) {
          // Mark as distributed even if 0 SOL
          await supabase
            .from("pumpfun_fee_claims")
            .update({ distributed: true, distributed_at: new Date().toISOString() })
            .eq("id", claim.id);
          continue;
        }

        // Pump.fun tokens use 80/20 split (creator/platform)
        const creatorAmount = claimedSol * 0.8;
        let platformAmount = claimedSol * 0.2;
        let partnerAmount = 0;
        
        // Partner split from platform share
        if (isPartnerSplitActive()) {
          partnerAmount = platformAmount * 0.5;
          platformAmount = platformAmount * 0.5;
        }
        
        const recipientWallet = token.deployer_wallet || token.creator_wallet;

        if (!recipientWallet) {
          console.warn(`[fun-distribute] Skipping pumpfun claim ${claim.id}: no recipient wallet`);
          continue;
        }

        // Send partner fee if applicable
        if (partnerAmount > 0) {
          const partnerResult = await sendPartnerFee(connection, treasuryKeypair, supabase, token, partnerAmount, 'pumpfun', 'creator');
          if (partnerResult.success) {
            totalPartnerDistributed += partnerAmount;
          }
        }

        // Skip if below minimum
        if (creatorAmount < MIN_DISTRIBUTION_SOL) {
          console.log(`[fun-distribute] Deferring pumpfun ${token.ticker}: ${creatorAmount.toFixed(6)} < ${MIN_DISTRIBUTION_SOL} SOL`);
          continue;
        }

        // Send SOL to creator
        let txSuccess = false;
        let txSignature: string | undefined;

        for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
          try {
            console.log(`[fun-distribute] Sending ${creatorAmount.toFixed(6)} SOL to pump.fun creator ${recipientWallet} (attempt ${attempt})`);

            const recipientPubkey = new PublicKey(recipientWallet);
            const lamports = Math.floor(creatorAmount * 1e9);

            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: treasuryKeypair.publicKey,
                toPubkey: recipientPubkey,
                lamports,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = treasuryKeypair.publicKey;

            txSignature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], {
              commitment: "confirmed",
              maxRetries: 3,
            });

            console.log(`[fun-distribute] ✅ Sent ${creatorAmount.toFixed(6)} SOL to pump.fun creator, sig: ${txSignature}`);
            txSuccess = true;
            break;
          } catch (e) {
            console.error(`[fun-distribute] ❌ Pumpfun TX attempt ${attempt} failed:`, e);
            if (attempt < MAX_TX_RETRIES) {
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            }
          }
        }

        if (txSuccess && txSignature) {
          // Update claim as distributed
          await supabase
            .from("pumpfun_fee_claims")
            .update({
              distributed: true,
              distributed_at: new Date().toISOString(),
              creator_amount_sol: creatorAmount,
              platform_amount_sol: platformAmount,
              distribution_signature: txSignature,
            })
            .eq("id", claim.id);

          pumpfunDistributed += creatorAmount;
          pumpfunSuccessCount++;
          totalDistributed += creatorAmount;
          successCount++;

          results.push({
            claimIds: [claim.id],
            tokenName: token.name,
            recipientWallet,
            recipientType: "creator",
            claimedSol,
            recipientAmount: creatorAmount,
            platformAmount,
            partnerAmount,
            success: true,
            signature: txSignature,
          });
        } else {
          results.push({
            claimIds: [claim.id],
            tokenName: token.name,
            recipientWallet,
            recipientType: "creator",
            claimedSol,
            recipientAmount: creatorAmount,
            platformAmount,
            partnerAmount,
            success: false,
            error: "Transaction failed after retries",
          });
          failureCount++;
        }
      }
    }

    console.log(`[fun-distribute] Pump.fun: ${pumpfunSuccessCount} distributed, ${pumpfunDistributed.toFixed(6)} SOL`);

    const duration = Date.now() - startTime;
    console.log(`[fun-distribute] ✅ Complete: ${successCount} successful (${apiFeesRecorded} API fees recorded, ${pumpfunSuccessCount} pumpfun), ${failureCount} failed, ${totalDistributed.toFixed(4)} SOL distributed, ${totalPartnerDistributed.toFixed(4)} SOL to partner in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        apiFeesRecorded,
        pumpfunDistributed: pumpfunSuccessCount,
        totalDistributedSol: totalDistributed,
        totalPartnerDistributedSol: totalPartnerDistributed,
        partnerSplitActive: isPartnerSplitActive(),
        durationMs: duration,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[fun-distribute] ❌ Error:", error);
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
