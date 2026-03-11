import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_BID_SOL = 5;
const BID_INCREMENT_SOL = 0.5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";

    if (req.method === "GET") {
      const url = new URL(req.url);
      const tradingAgentId = url.searchParams.get("tradingAgentId");
      if (!tradingAgentId) return new Response(JSON.stringify({ error: "tradingAgentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: agent } = await supabase
        .from("claw_trading_agents")
        .select("id, name, bidding_ends_at, is_owned, owner_wallet, launched_at, bid_wallet_address")
        .eq("id", tradingAgentId)
        .single();

      if (!agent) return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: bids } = await supabase
        .from("claw_agent_bids")
        .select("*")
        .eq("trading_agent_id", tradingAgentId)
        .order("bid_amount_sol", { ascending: false });

      const highestBid = bids?.find(b => b.status === "active") || null;
      const biddingOpen = agent.bidding_ends_at ? new Date(agent.bidding_ends_at) > new Date() : false;

      const minNextBid = highestBid
        ? highestBid.bid_amount_sol + BID_INCREMENT_SOL
        : MIN_BID_SOL;

      return new Response(JSON.stringify({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          biddingEndsAt: agent.bidding_ends_at,
          isOwned: agent.is_owned,
          ownerWallet: agent.owner_wallet,
          launchedAt: agent.launched_at,
          bidWalletAddress: agent.bid_wallet_address,
        },
        biddingOpen,
        highestBid: highestBid ? { bidder: highestBid.bidder_wallet, amount: highestBid.bid_amount_sol, createdAt: highestBid.created_at } : null,
        minNextBid,
        totalBids: bids?.length || 0,
        bids: (bids || []).slice(0, 20).map(b => ({
          bidder: b.bidder_wallet,
          amount: b.bid_amount_sol,
          status: b.status,
          createdAt: b.created_at,
          txSignature: b.tx_signature,
          refunded: !!b.refunded_at,
        })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const { tradingAgentId, bidderWallet, bidAmountSol, txSignature } = await req.json();

      if (!tradingAgentId || !bidderWallet || !bidAmountSol || !txSignature) {
        return new Response(JSON.stringify({ error: "tradingAgentId, bidderWallet, bidAmountSol, and txSignature required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (bidAmountSol < MIN_BID_SOL) {
        return new Response(JSON.stringify({ error: `Minimum bid is ${MIN_BID_SOL} SOL` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check agent exists and bidding is open
      const { data: agent } = await supabase
        .from("claw_trading_agents")
        .select("id, bidding_ends_at, is_owned, agent_id, bid_wallet_address")
        .eq("id", tradingAgentId)
        .single();

      if (!agent) return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (agent.is_owned) return new Response(JSON.stringify({ error: "Agent already owned" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (!agent.bidding_ends_at || new Date(agent.bidding_ends_at) <= new Date()) {
        return new Response(JSON.stringify({ error: "Bidding window has closed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!agent.bid_wallet_address) {
        return new Response(JSON.stringify({ error: "Agent bid wallet not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check highest current bid
      const { data: currentHighest } = await supabase
        .from("claw_agent_bids")
        .select("bid_amount_sol, bidder_wallet")
        .eq("trading_agent_id", tradingAgentId)
        .eq("status", "active")
        .order("bid_amount_sol", { ascending: false })
        .limit(1)
        .maybeSingle();

      const requiredMin = currentHighest
        ? currentHighest.bid_amount_sol + BID_INCREMENT_SOL
        : MIN_BID_SOL;

      if (bidAmountSol < requiredMin) {
        return new Response(JSON.stringify({
          error: `Bid must be at least ${requiredMin} SOL (current highest: ${currentHighest?.bid_amount_sol || 0} SOL + ${BID_INCREMENT_SOL} increment)`,
          currentHighest: currentHighest?.bid_amount_sol || 0,
          minNextBid: requiredMin,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify on-chain transaction
      try {
        const connection = new Connection(rpcUrl, "confirmed");
        const txInfo = await connection.getTransaction(txSignature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        if (!txInfo) {
          return new Response(JSON.stringify({ error: "Transaction not found on-chain. Please wait for confirmation and try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (txInfo.meta?.err) {
          return new Response(JSON.stringify({ error: "Transaction failed on-chain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Verify the transfer went to the bid wallet with correct amount
        const bidWalletPubkey = new PublicKey(agent.bid_wallet_address);
        const preBalance = txInfo.meta?.preBalances || [];
        const postBalance = txInfo.meta?.postBalances || [];
        const accountKeys = txInfo.transaction.message.getAccountKeys?.()
          || (txInfo.transaction.message as any).staticAccountKeys
          || [];

        let transferVerified = false;
        for (let i = 0; i < accountKeys.length; i++) {
          const key = accountKeys[i]?.toString?.() || accountKeys[i];
          if (key === agent.bid_wallet_address) {
            const received = (postBalance[i] - preBalance[i]) / LAMPORTS_PER_SOL;
            if (received >= bidAmountSol * 0.99) {
              transferVerified = true;
            }
            break;
          }
        }

        if (!transferVerified) {
          return new Response(JSON.stringify({ error: "Could not verify SOL transfer to agent bid wallet. Ensure you sent the correct amount." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (verifyError) {
        console.error("[saturn-agent-bid] TX verification error:", verifyError);
        return new Response(JSON.stringify({ error: "Failed to verify transaction. Please try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check for duplicate tx
      const { data: existingTx } = await supabase
        .from("claw_agent_bids")
        .select("id")
        .eq("tx_signature", txSignature)
        .maybeSingle();

      if (existingTx) {
        return new Response(JSON.stringify({ error: "This transaction has already been used for a bid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Mark previous highest as outbid
      if (currentHighest) {
        await supabase
          .from("claw_agent_bids")
          .update({ status: "outbid" })
          .eq("trading_agent_id", tradingAgentId)
          .eq("status", "active");
      }

      // Insert new bid
      const { data: newBid, error: bidError } = await supabase
        .from("claw_agent_bids")
        .insert({
          claw_agent_id: agent.agent_id,
          trading_agent_id: tradingAgentId,
          bidder_wallet: bidderWallet,
          bid_amount_sol: bidAmountSol,
          status: "active",
          expires_at: agent.bidding_ends_at,
          tx_signature: txSignature,
        })
        .select()
        .single();

      if (bidError) throw bidError;

      console.log(`[saturn-agent-bid] ✅ Verified bid: ${bidAmountSol} SOL by ${bidderWallet} on agent ${tradingAgentId} (tx: ${txSignature})`);

      return new Response(JSON.stringify({
        success: true,
        bid: newBid,
        message: `Bid of ${bidAmountSol} SOL placed and verified on-chain! 🦞`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[saturn-agent-bid] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
