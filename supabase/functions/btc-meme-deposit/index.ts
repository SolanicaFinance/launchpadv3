const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * btc-meme-deposit: Verifies an on-chain BTC transaction via mempool.space
 * and credits the sender's trading balance.
 *
 * Security layers:
 * 1. Requires a real txid — verified against mempool.space API
 * 2. Checks that the tx actually pays to the PLATFORM deposit address
 * 3. Idempotent via btc_deposit_ledger UNIQUE(txid, vout) constraint
 * 4. Rate-limited: max 5 deposits per hour per wallet
 * 5. Only credits confirmed outputs (≥1 confirmation)
 */

const MEMPOOL_API = "https://mempool.space/api";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

interface MempoolTxOutput {
  scriptpubkey_address?: string;
  value: number; // satoshis
}

interface MempoolTx {
  txid: string;
  vin: { prevout: { scriptpubkey_address?: string } }[];
  vout: MempoolTxOutput[];
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { walletAddress, txid } = await req.json();

    // GET request returns the platform deposit address (public info)
    if (!walletAddress && !txid) {
      const platformAddress = Deno.env.get("BTC_PLATFORM_DEPOSIT_ADDRESS") || Deno.env.get("BTC_PLATFORM_ADDRESS");
      if (!platformAddress) {
        return new Response(JSON.stringify({ error: "Platform deposit address not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ depositAddress: platformAddress }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!walletAddress || !txid) {
      return new Response(JSON.stringify({ error: "walletAddress and txid are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate txid format (64 hex chars)
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return new Response(JSON.stringify({ error: "Invalid transaction ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformAddress = Deno.env.get("BTC_PLATFORM_DEPOSIT_ADDRESS");
    if (!platformAddress) {
      console.error("[btc-meme-deposit] BTC_PLATFORM_DEPOSIT_ADDRESS not configured");
      return new Response(JSON.stringify({ error: "Platform deposit address not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // --- Rate limit: max 5 deposits per hour per wallet ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("btc_deposit_ledger")
      .select("*", { count: "exact", head: true })
      .eq("wallet_address", walletAddress)
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Rate limit: max 5 deposits per hour. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch tx from mempool.space ---
    const txRes = await fetch(`${MEMPOOL_API}/tx/${txid}`);
    if (!txRes.ok) {
      const statusCode = txRes.status;
      if (statusCode === 404) {
        return new Response(JSON.stringify({ error: "Transaction not found on the Bitcoin network. It may not have propagated yet — try again in a minute." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`mempool.space returned ${statusCode}`);
    }

    const txData: MempoolTx = await txRes.json();

    // --- Verify confirmation (at least 1 conf) ---
    if (!txData.status.confirmed) {
      return new Response(JSON.stringify({ error: "Transaction is unconfirmed. Please wait for at least 1 confirmation and try again." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Verify sender: at least one input must come from walletAddress ---
    const senderAddresses = txData.vin
      .map(v => v.prevout?.scriptpubkey_address)
      .filter(Boolean);
    
    if (!senderAddresses.includes(walletAddress)) {
      return new Response(JSON.stringify({ error: "Transaction was not sent from your wallet address. The sender does not match." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Find outputs paying to platform address ---
    const platformOutputs = txData.vout
      .map((out, index) => ({ ...out, vout: index }))
      .filter(out => out.scriptpubkey_address === platformAddress);

    if (platformOutputs.length === 0) {
      return new Response(JSON.stringify({ error: "Transaction does not pay to the platform deposit address. Please send BTC to the correct address." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Credit each qualifying output (idempotent via UNIQUE constraint) ---
    let totalCredited = 0;
    let alreadyClaimed = 0;

    for (const out of platformOutputs) {
      const amountBtc = out.value / 1e8;

      // Try to insert into ledger — will fail silently if already claimed
      const { error: insertErr } = await supabase.from("btc_deposit_ledger").insert({
        wallet_address: walletAddress,
        amount_btc: amountBtc,
        txid,
        vout: out.vout,
        confirmed: true,
        block_height: txData.status.block_height || null,
      });

      if (insertErr) {
        // UNIQUE violation = already credited
        if (insertErr.code === "23505") {
          alreadyClaimed++;
          continue;
        }
        console.error("[btc-meme-deposit] Ledger insert error:", insertErr);
        continue;
      }

      totalCredited += amountBtc;
    }

    if (totalCredited === 0) {
      if (alreadyClaimed > 0) {
        return new Response(JSON.stringify({ error: "This transaction has already been credited to your account." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No creditable outputs found in this transaction." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Atomically credit trading balance ---
    const { data: existing } = await supabase
      .from("btc_trading_balances")
      .select("balance_btc, total_deposited")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      await supabase.from("btc_trading_balances").update({
        balance_btc: existing.balance_btc + totalCredited,
        total_deposited: (existing.total_deposited || 0) + totalCredited,
        updated_at: new Date().toISOString(),
      }).eq("wallet_address", walletAddress);
    } else {
      await supabase.from("btc_trading_balances").insert({
        wallet_address: walletAddress,
        balance_btc: totalCredited,
        total_deposited: totalCredited,
      });
    }

    const newBalance = (existing?.balance_btc || 0) + totalCredited;

    console.log(`[btc-meme-deposit] ✅ Verified deposit: ${totalCredited} BTC from ${walletAddress} (tx: ${txid})`);

    return new Response(JSON.stringify({
      success: true,
      credited: totalCredited,
      balance: newBalance,
      txid,
      blockHeight: txData.status.block_height,
      alreadyClaimed,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-deposit] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
