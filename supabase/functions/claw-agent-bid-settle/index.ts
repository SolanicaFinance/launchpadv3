import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFUND_DELAY_MS = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  console.log("[saturn-agent-bid-settle] ⏰ Settlement cron started");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) throw new Error("API_ENCRYPTION_KEY not configured");

    const CLAW_TREASURY_PRIVATE_KEY = Deno.env.get("CLAW_TREASURY_PRIVATE_KEY");
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    const rpcUrl = HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // PHASE 1: Settle expired auctions (transfer ownership)
    const { data: expiredAgents } = await supabase
      .from("claw_trading_agents")
      .select("id, name, bidding_ends_at, agent_id, bid_wallet_address, bid_wallet_private_key_encrypted")
      .eq("is_owned", false)
      .not("bidding_ends_at", "is", null)
      .lt("bidding_ends_at", new Date().toISOString());

    const results: any[] = [];

    if (expiredAgents?.length) {
      console.log(`[saturn-agent-bid-settle] Found ${expiredAgents.length} agents to settle`);

      for (const agent of expiredAgents) {
        try {
          const { data: winningBid } = await supabase
            .from("claw_agent_bids")
            .select("*")
            .eq("trading_agent_id", agent.id)
            .eq("status", "active")
            .order("bid_amount_sol", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!winningBid) {
            console.log(`[saturn-agent-bid-settle] No bids for ${agent.name}, system owns it`);
            await supabase.from("claw_trading_agents").update({
              is_owned: true,
              owner_wallet: "CLAW_SYSTEM",
              ownership_transferred_at: new Date().toISOString(),
            }).eq("id", agent.id);
            results.push({ agentId: agent.id, settled: true, reason: "no_bids_system_owned" });
            continue;
          }

          // Transfer ownership to winner
          await supabase.from("claw_trading_agents").update({
            owner_wallet: winningBid.bidder_wallet,
            is_owned: true,
            ownership_transferred_at: new Date().toISOString(),
          }).eq("id", agent.id);

          // Mark winning bid
          await supabase.from("claw_agent_bids").update({ status: "won" }).eq("id", winningBid.id);

          // Mark all other bids as expired (they'll be refunded)
          await supabase.from("claw_agent_bids")
            .update({ status: "expired" })
            .eq("trading_agent_id", agent.id)
            .neq("id", winningBid.id)
            .in("status", ["active", "outbid"]);

          // Transfer winning bid SOL from bid wallet to treasury
          if (agent.bid_wallet_private_key_encrypted && CLAW_TREASURY_PRIVATE_KEY) {
            try {
              const bidWalletKey = await aesDecrypt(agent.bid_wallet_private_key_encrypted, API_ENCRYPTION_KEY);
              const bidWalletKeypair = Keypair.fromSecretKey(bs58.decode(bidWalletKey));

              const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CLAW_TREASURY_PRIVATE_KEY));
              const winAmountLamports = Math.floor(winningBid.bid_amount_sol * LAMPORTS_PER_SOL);

              const balance = await connection.getBalance(bidWalletKeypair.publicKey);
              const transferAmount = Math.min(winAmountLamports, balance - 5000);

              if (transferAmount > 0) {
                const tx = new Transaction().add(
                  SystemProgram.transfer({
                    fromPubkey: bidWalletKeypair.publicKey,
                    toPubkey: treasuryKeypair.publicKey,
                    lamports: transferAmount,
                  })
                );
                const sig = await sendAndConfirmTransaction(connection, tx, [bidWalletKeypair]);
                console.log(`[saturn-agent-bid-settle] Winner SOL sent to treasury: ${sig}`);
              }
            } catch (transferErr) {
              console.error(`[saturn-agent-bid-settle] Treasury transfer failed for ${agent.name}:`, transferErr);
            }
          }

          console.log(`[saturn-agent-bid-settle] ✅ ${agent.name} -> owned by ${winningBid.bidder_wallet} for ${winningBid.bid_amount_sol} SOL`);
          results.push({ agentId: agent.id, settled: true, winner: winningBid.bidder_wallet, amount: winningBid.bid_amount_sol });
        } catch (agentError) {
          console.error(`[saturn-agent-bid-settle] Error settling ${agent.name}:`, agentError);
          results.push({ agentId: agent.id, settled: false, error: String(agentError) });
        }
      }
    }

    // PHASE 2: Refund non-winning bids (1 hour after settlement)
    const refundCutoff = new Date(Date.now() - REFUND_DELAY_MS).toISOString();
    const { data: bidsToRefund } = await supabase
      .from("claw_agent_bids")
      .select("*, claw_trading_agents!claw_agent_bids_trading_agent_id_fkey(bid_wallet_address, bid_wallet_private_key_encrypted)")
      .in("status", ["expired", "outbid"])
      .is("refunded_at", null)
      .lt("created_at", refundCutoff)
      .limit(20);

    let refundCount = 0;
    if (bidsToRefund?.length) {
      console.log(`[saturn-agent-bid-settle] ${bidsToRefund.length} bids to refund`);

      for (const bid of bidsToRefund) {
        try {
          const agentData = (bid as any).claw_trading_agents;
          if (!agentData?.bid_wallet_private_key_encrypted) {
            console.error(`[saturn-agent-bid-settle] No bid wallet key for bid ${bid.id}`);
            continue;
          }

          const bidWalletKey = await aesDecrypt(agentData.bid_wallet_private_key_encrypted, API_ENCRYPTION_KEY);
          const bidWalletKeypair = Keypair.fromSecretKey(bs58.decode(bidWalletKey));
          const bidderPubkey = new PublicKey(bid.bidder_wallet);
          const refundLamports = Math.floor(bid.bid_amount_sol * LAMPORTS_PER_SOL);

          const balance = await connection.getBalance(bidWalletKeypair.publicKey);
          const actualRefund = Math.min(refundLamports, balance - 5000);

          if (actualRefund <= 0) {
            console.warn(`[saturn-agent-bid-settle] Insufficient balance to refund bid ${bid.id}`);
            continue;
          }

          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: bidWalletKeypair.publicKey,
              toPubkey: bidderPubkey,
              lamports: actualRefund,
            })
          );
          const sig = await sendAndConfirmTransaction(connection, tx, [bidWalletKeypair]);

          await supabase.from("claw_agent_bids").update({
            refunded_at: new Date().toISOString(),
            refund_signature: sig,
          }).eq("id", bid.id);

          console.log(`[saturn-agent-bid-settle] 🔄 Refunded ${bid.bid_amount_sol} SOL to ${bid.bidder_wallet} (tx: ${sig})`);
          refundCount++;

          // Small delay between refunds
          await new Promise(r => setTimeout(r, 1000));
        } catch (refundErr) {
          console.error(`[saturn-agent-bid-settle] Refund failed for bid ${bid.id}:`, refundErr);
        }
      }
    }

    const settledCount = results.filter(r => r.settled).length;
    console.log(`[saturn-agent-bid-settle] ✅ Settled: ${settledCount}, Refunded: ${refundCount}`);

    return new Response(
      JSON.stringify({ success: true, settled: settledCount, refunded: refundCount, duration: Date.now() - startTime, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-agent-bid-settle] ❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aesDecrypt(ciphertext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["decrypt"]);

  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
