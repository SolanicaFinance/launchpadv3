import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_PASSWORD = "saturn135@";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, adminPassword } = body;

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    const HELIUS_RPC = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

    // ─── CREATE CAMPAIGN ───
    if (action === "create") {
      const { name, walletAddress, walletPrivateKey, batchSize, lamportsPerRecipient } = body;
      const { data, error } = await supabase.from("dust_campaigns").insert({
        name: name || "Brand Awareness",
        wallet_address: walletAddress,
        wallet_private_key_encrypted: walletPrivateKey, // In production, encrypt this
        batch_size: batchSize || 10,
        lamports_per_recipient: lamportsPerRecipient || 1,
      }).select().single();

      if (error) throw error;
      return json({ success: true, campaign: { ...data, wallet_private_key_encrypted: "***" } });
    }

    // ─── TOGGLE ACTIVE ───
    if (action === "toggle") {
      const { campaignId, isActive } = body;
      const { error } = await supabase
        .from("dust_campaigns")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── GET CAMPAIGNS + STATS ───
    if (action === "status") {
      const { data: campaigns } = await supabase
        .from("dust_campaigns")
        .select("id, name, wallet_address, is_active, batch_size, lamports_per_recipient, total_sent, total_unique_wallets, total_sol_spent, total_txs, last_run_at, last_error, created_at")
        .order("created_at", { ascending: false });

      const { data: recentRuns } = await supabase
        .from("dust_run_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      return json({ campaigns, recentRuns });
    }

    // ─── EXECUTE: The actual dust sending ───
    if (action === "execute") {
      const { campaignId } = body;
      const startTime = Date.now();

      // Get campaign
      const { data: campaign, error: cErr } = await supabase
        .from("dust_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (cErr || !campaign) throw new Error("Campaign not found");
      if (!campaign.is_active) throw new Error("Campaign is not active");

      // Step 1: Fetch recent trader wallets from Helius
      // Get recent transactions from Jupiter aggregator program
      const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
      
      const sigRes = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getSignaturesForAddress",
          params: [JUPITER_PROGRAM, { limit: 100 }],
        }),
      });
      const sigData = await sigRes.json();
      const signatures = (sigData.result || [])
        .filter((s: any) => !s.err)
        .map((s: any) => s.signature)
        .slice(0, 50);

      if (!signatures.length) {
        return json({ error: "No recent signatures found" });
      }

      // Parse transactions to extract trader wallets
      const parseRes = await fetch(`https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
      });
      const parsedTxs = await parseRes.json();

      // Extract unique fee payers (the actual traders)
      const traderWallets = new Set<string>();
      for (const tx of parsedTxs) {
        if (tx.feePayer && tx.feePayer !== JUPITER_PROGRAM) {
          traderWallets.add(tx.feePayer);
        }
      }

      if (!traderWallets.size) {
        return json({ error: "No trader wallets found" });
      }

      // Step 2: Filter out already-dusted wallets
      const walletArray = Array.from(traderWallets);
      const { data: existing } = await supabase
        .from("dust_sent_addresses")
        .select("wallet_address")
        .eq("campaign_id", campaignId)
        .in("wallet_address", walletArray);

      const existingSet = new Set((existing || []).map((e: any) => e.wallet_address));
      const newWallets = walletArray.filter((w) => !existingSet.has(w));

      if (!newWallets.length) {
        await logRun(supabase, campaignId, 0, 0, 0, 0, "All wallets already dusted", Date.now() - startTime);
        return json({ message: "All found wallets already dusted", found: walletArray.length });
      }

      // Step 3: Build and send batched transactions
      // Load sender keypair
      const privateKeyBytes = Uint8Array.from(
        campaign.wallet_private_key_encrypted.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16))
      );

      const batchSize = campaign.batch_size || 10;
      let totalSent = 0;
      let totalTxs = 0;
      let totalSolSpent = 0;
      const txSignatures: string[] = [];

      // Process in batches
      for (let i = 0; i < newWallets.length; i += batchSize) {
        const batch = newWallets.slice(i, i + batchSize);
        
        try {
          // Build transaction with SystemProgram.transfer for each recipient
          // Using raw RPC to construct and send
          const lamports = campaign.lamports_per_recipient || 1;
          
          // Get recent blockhash
          const bhRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getLatestBlockhash",
              params: [{ commitment: "finalized" }],
            }),
          });
          const bhData = await bhRes.json();
          const blockhash = bhData.result.value.blockhash;

          // Build legacy transaction manually
          // SystemProgram.transfer = program 11111111111111111111111111111111
          // Instruction: transfer (index 2), data = [2,0,0,0, ...lamports_le_u64]
          const { Transaction, SystemProgram, PublicKey, Keypair, Connection } = await import("https://esm.sh/@solana/web3.js@1.98.0");

          const senderKeypair = Keypair.fromSecretKey(privateKeyBytes);
          const connection = new Connection(HELIUS_RPC, "confirmed");

          const tx = new Transaction();
          tx.recentBlockhash = blockhash;
          tx.feePayer = senderKeypair.publicKey;

          for (const recipient of batch) {
            tx.add(
              SystemProgram.transfer({
                fromPubkey: senderKeypair.publicKey,
                toPubkey: new PublicKey(recipient),
                lamports,
              })
            );
          }

          tx.sign(senderKeypair);
          const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
            maxRetries: 2,
          });

          txSignatures.push(sig);
          totalSent += batch.length;
          totalTxs += 1;
          totalSolSpent += (5000 + lamports * batch.length) / 1e9; // fee + dust

          // Record sent addresses
          const inserts = batch.map((w) => ({
            campaign_id: campaignId,
            wallet_address: w,
            tx_signature: sig,
          }));
          await supabase.from("dust_sent_addresses").insert(inserts);

        } catch (batchErr: any) {
          console.error(`Batch error at index ${i}:`, batchErr.message);
        }
      }

      // Update campaign stats
      await supabase.from("dust_campaigns").update({
        total_sent: (campaign.total_sent || 0) + totalSent,
        total_unique_wallets: (campaign.total_unique_wallets || 0) + totalSent,
        total_sol_spent: (campaign.total_sol_spent || 0) + totalSolSpent,
        total_txs: (campaign.total_txs || 0) + totalTxs,
        last_run_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", campaignId);

      const duration = Date.now() - startTime;
      await logRun(supabase, campaignId, newWallets.length, totalSent, totalTxs, totalSolSpent, null, duration);

      return json({
        success: true,
        found: walletArray.length,
        new: newWallets.length,
        sent: totalSent,
        txs: totalTxs,
        solSpent: totalSolSpent.toFixed(9),
        signatures: txSignatures,
        durationMs: duration,
      });
    }

    // ─── GET RUN LOGS ───
    if (action === "logs") {
      const { campaignId, limit: logLimit } = body;
      const q = supabase.from("dust_run_log").select("*").order("created_at", { ascending: false }).limit(logLimit || 50);
      if (campaignId) q.eq("campaign_id", campaignId);
      const { data } = await q;
      return json({ logs: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error: any) {
    console.error("[brand-dust] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logRun(
  supabase: any, campaignId: string,
  targeted: number, sent: number, txs: number, sol: number,
  error: string | null, durationMs: number
) {
  await supabase.from("dust_run_log").insert({
    campaign_id: campaignId,
    wallets_targeted: targeted,
    wallets_sent: sent,
    txs_sent: txs,
    sol_spent: sol,
    error_message: error,
    duration_ms: durationMs,
  });
}
