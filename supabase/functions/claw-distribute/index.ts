import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATOR_FEE_SHARE = 0.3;        // 30% to creator (X launcher)
const AGENT_FEE_SHARE = 0.3;          // 30% to agent trading wallet  
const TRADING_AGENT_FEE_SHARE = 0.3;  // 30% to trading agent wallet
const SYSTEM_FEE_SHARE = 0.4;         // 40% to system treasury
const MIN_DISTRIBUTION_SOL = 0.05;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  console.log("[saturn-distribute] ⏰ Starting Claw fee distribution...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clawTreasuryKey = Deno.env.get("CLAW_TREASURY_PRIVATE_KEY");
    if (!clawTreasuryKey) throw new Error("CLAW_TREASURY_PRIVATE_KEY not configured");

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");
    if (!heliusRpcUrl) throw new Error("HELIUS_RPC_URL not configured");

    let treasuryKeypair: Keypair;
    try {
      if (clawTreasuryKey.startsWith("[")) {
        treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(clawTreasuryKey)));
      } else {
        treasuryKeypair = Keypair.fromSecretKey(bs58.decode(clawTreasuryKey));
      }
    } catch { throw new Error("Invalid CLAW_TREASURY_PRIVATE_KEY format"); }

    const connection = new Connection(heliusRpcUrl, "confirmed");
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSol = treasuryBalance / 1e9;
    console.log(`[saturn-distribute] Claw Treasury balance: ${treasuryBalanceSol.toFixed(4)} SOL`);

    if (treasuryBalanceSol < 0.01) {
      return new Response(
        JSON.stringify({ success: true, message: "Claw treasury balance too low" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get undistributed claw_fee_claims
    const { data: undistributedClaims, error: claimsError } = await supabase
      .from("claw_fee_claims")
      .select(`*, fun_token:claw_tokens(id, name, ticker, creator_wallet, status, agent_id, trading_agent_id, is_trading_agent_token, agent_fee_share_bps)`)
      .eq("creator_distributed", false)
      .order("claimed_at", { ascending: true });

    if (claimsError) throw new Error(`Failed to fetch claims: ${claimsError.message}`);
    if (!undistributedClaims?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending Claw distributions", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[saturn-distribute] Found ${undistributedClaims.length} undistributed Claw claims`);

    // Group by recipient
    const groups = new Map<string, { token: any; recipientWallet: string; claims: any[]; claimedSol: number; isTradingAgent: boolean }>();

    for (const claim of undistributedClaims) {
      const token = claim.fun_token;
      if (!token || token.status !== "active") continue;
      const claimedSol = Number(claim.claimed_sol) || 0;
      if (claimedSol <= 0) continue;

      const isTradingAgentToken = token.is_trading_agent_token === true && !!token.trading_agent_id;

      if (isTradingAgentToken) {
        const { data: ta } = await supabase.from("claw_trading_agents").select("id, wallet_address, owner_wallet, is_owned").eq("id", token.trading_agent_id).maybeSingle();
        if (!ta) continue;

        // If owned, send to owner_wallet; otherwise send to agent trading wallet
        const targetWallet = ta.is_owned && ta.owner_wallet ? ta.owner_wallet : ta.wallet_address;
        const key = `trading-agent:${token.trading_agent_id}`;
        const existing = groups.get(key);
        if (existing) { existing.claims.push(claim); existing.claimedSol += claimedSol; }
        else { groups.set(key, { token, recipientWallet: targetWallet, claims: [claim], claimedSol, isTradingAgent: true }); }
      } else if (token.agent_id) {
        const { data: agentData } = await supabase.from("claw_agents").select("id, wallet_address").eq("id", token.agent_id).single();
        if (!agentData) continue;
        const key = `agent:${token.agent_id}`;
        const existing = groups.get(key);
        if (existing) { existing.claims.push(claim); existing.claimedSol += claimedSol; }
        else { groups.set(key, { token, recipientWallet: agentData.wallet_address, claims: [claim], claimedSol, isTradingAgent: false }); }
      }
    }

    let totalDistributed = 0;
    let successCount = 0;

    for (const group of groups.values()) {
      const feeShare = group.isTradingAgent ? TRADING_AGENT_FEE_SHARE : AGENT_FEE_SHARE;
      const recipientAmount = group.claimedSol * feeShare;

      if (recipientAmount < MIN_DISTRIBUTION_SOL) {
        // Mark as distributed but skip payment
        for (const claim of group.claims) {
          await supabase.from("claw_fee_claims").update({ creator_distributed: true }).eq("id", claim.id);
        }
        continue;
      }

      try {
        const recipientPubkey = new PublicKey(group.recipientWallet);
        const lamports = Math.floor(recipientAmount * 1e9);
        const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasuryKeypair.publicKey, toPubkey: recipientPubkey, lamports }));
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasuryKeypair.publicKey;

        const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], { commitment: "confirmed", maxRetries: 3 });

        console.log(`[saturn-distribute] ✅ Sent ${recipientAmount.toFixed(6)} SOL to ${group.recipientWallet}, sig: ${signature}`);

        // Record in claw_agent_fee_distributions
        await supabase.from("claw_agent_fee_distributions").insert({
          agent_id: group.token.agent_id,
          fun_token_id: group.token.id,
          amount_sol: recipientAmount,
          signature,
          status: "completed",
          completed_at: new Date().toISOString(),
        });

        for (const claim of group.claims) {
          await supabase.from("claw_fee_claims").update({ creator_distributed: true }).eq("id", claim.id);
        }

        totalDistributed += recipientAmount;
        successCount++;
      } catch (txError) {
        console.error(`[saturn-distribute] ❌ Failed to send to ${group.recipientWallet}:`, txError);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ success: true, processed: groups.size, distributed: successCount, totalDistributedSol: totalDistributed, duration: Date.now() - startTime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-distribute] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
