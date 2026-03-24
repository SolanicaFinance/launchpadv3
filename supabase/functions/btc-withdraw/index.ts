/**
 * BTC Withdrawal Edge Function — SECURITY HARDENED
 * 
 * Protections:
 * 1. Atomic balance deduction via Postgres function (prevents race conditions)
 * 2. Database-level active withdrawal lock (unique partial index — only 1 pending/broadcasting per wallet)
 * 3. Rate limiting: max 3 withdrawals per hour per wallet
 * 4. Daily withdrawal cap: 0.5 BTC per wallet per 24h
 * 5. Amount validation with min/max bounds
 * 6. Withdrawal ledger for full audit trail
 * 7. Balance is deducted BEFORE broadcast — if broadcast fails, balance is restored
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Buffer } from "node:buffer";

const MIN_WITHDRAW_BTC = 0.00005;  // 5,000 sats
const MAX_WITHDRAW_BTC = 0.1;      // per transaction
const MAX_DAILY_BTC = 0.5;         // per wallet per 24h
const MAX_PER_HOUR = 3;            // rate limit
const COOLDOWN_SECONDS = 60;       // minimum time between withdrawals

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();
  let withdrawalId: string | null = null;

  try {
    const body = await req.json();
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";
    const amountBtc = typeof body.amountBtc === "number" ? body.amountBtc : parseFloat(body.amountBtc);

    // === INPUT VALIDATION ===
    if (!walletAddress || isNaN(amountBtc) || amountBtc <= 0) {
      return new Response(JSON.stringify({ error: "Valid walletAddress and positive amountBtc required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amountBtc < MIN_WITHDRAW_BTC) {
      return new Response(JSON.stringify({ error: `Minimum withdrawal: ${MIN_WITHDRAW_BTC} BTC (${MIN_WITHDRAW_BTC * 1e8} sats)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amountBtc > MAX_WITHDRAW_BTC) {
      return new Response(JSON.stringify({ error: `Maximum withdrawal: ${MAX_WITHDRAW_BTC} BTC per transaction` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strict BTC address validation
    if (!/^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(walletAddress)) {
      return new Response(JSON.stringify({ error: "Invalid Bitcoin address format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === RATE LIMITING ===
    // Check withdrawals in last hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: hourCount } = await supabase
      .from("btc_withdrawals")
      .select("*", { count: "exact", head: true })
      .eq("wallet_address", walletAddress)
      .gte("created_at", oneHourAgo);

    if ((hourCount || 0) >= MAX_PER_HOUR) {
      return new Response(JSON.stringify({ error: `Rate limit: max ${MAX_PER_HOUR} withdrawals per hour. Try again later.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown (last withdrawal must be > COOLDOWN_SECONDS ago)
    const { data: lastWithdrawal } = await supabase
      .from("btc_withdrawals")
      .select("created_at")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastWithdrawal) {
      const elapsed = (Date.now() - new Date(lastWithdrawal.created_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - elapsed);
        return new Response(JSON.stringify({ error: `Please wait ${wait}s before next withdrawal` }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === DAILY CAP ===
    const oneDayAgo = new Date(Date.now() - 86400_000).toISOString();
    const { data: dayWithdrawals } = await supabase
      .from("btc_withdrawals")
      .select("amount_btc")
      .eq("wallet_address", walletAddress)
      .in("status", ["completed", "broadcasting", "pending"])
      .gte("created_at", oneDayAgo);

    const dailyTotal = (dayWithdrawals || []).reduce((sum: number, w: any) => sum + Number(w.amount_btc), 0);
    if (dailyTotal + amountBtc > MAX_DAILY_BTC) {
      return new Response(JSON.stringify({
        error: `Daily withdrawal limit: ${MAX_DAILY_BTC} BTC. Already withdrawn: ${dailyTotal.toFixed(8)} BTC today.`,
        remaining: Math.max(0, MAX_DAILY_BTC - dailyTotal),
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === ATOMIC LOCK: Insert pending withdrawal (unique index prevents duplicates) ===
    const { data: withdrawal, error: lockErr } = await supabase
      .from("btc_withdrawals")
      .insert({
        wallet_address: walletAddress,
        amount_btc: amountBtc,
        status: "pending",
      })
      .select("id")
      .single();

    if (lockErr) {
      // Unique constraint violation = another withdrawal is already in progress
      if (lockErr.code === "23505") {
        return new Response(JSON.stringify({ error: "A withdrawal is already in progress. Please wait for it to complete." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw lockErr;
    }

    withdrawalId = withdrawal.id;

    // === ATOMIC BALANCE DEDUCTION (Postgres function — race-condition proof) ===
    const { data: deducted } = await supabase.rpc("deduct_btc_balance", {
      p_wallet: walletAddress,
      p_amount: amountBtc,
    });

    if (!deducted) {
      // Balance insufficient — mark withdrawal as failed
      await supabase.from("btc_withdrawals").update({
        status: "failed",
        error_message: "Insufficient balance (atomic check failed)",
      }).eq("id", withdrawalId);

      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Mark as broadcasting ===
    await supabase.from("btc_withdrawals").update({ status: "broadcasting" }).eq("id", withdrawalId);

    // === BUILD & BROADCAST BITCOIN TX ===
    const btcWif = Deno.env.get("BTC_PLATFORM_WIF");
    if (!btcWif) {
      // Restore balance since we already deducted
      await supabase.rpc("deduct_btc_balance", { p_wallet: walletAddress, p_amount: -amountBtc });
      await supabase.from("btc_withdrawals").update({
        status: "failed", error_message: "Platform wallet not configured",
      }).eq("id", withdrawalId);
      return new Response(JSON.stringify({ error: "Platform withdrawal wallet not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
    const ECPairFactory = (await import("npm:ecpair@3.0.0")).default;
    const ecc = await import("npm:tiny-secp256k1@2.2.3");

    const ECPair = ECPairFactory(ecc);
    const network = bitcoinjs.networks.bitcoin;
    const keyPair = ECPair.fromWIF(btcWif, network);
    const { address: platformAddress } = bitcoinjs.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey), network,
    });

    if (!platformAddress) throw new Error("Could not derive platform address");

    const amountSats = Math.floor(amountBtc * 1e8);

    // Fetch UTXOs
    const utxoRes = await fetch(`https://mempool.space/api/address/${platformAddress}/utxo`);
    if (!utxoRes.ok) throw new Error("Failed to fetch UTXOs");
    const utxos = await utxoRes.json();

    if (!utxos.length) {
      // Restore balance
      await supabase.rpc("deduct_btc_balance", { p_wallet: walletAddress, p_amount: -amountBtc });
      await supabase.from("btc_withdrawals").update({
        status: "failed", error_message: "Platform has no UTXOs",
      }).eq("id", withdrawalId);
      return new Response(JSON.stringify({ error: "Platform wallet has no UTXOs. Contact support." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fee rate
    const feeRes = await fetch("https://mempool.space/api/v1/fees/recommended");
    const fees = await feeRes.json();
    const feeRate = Math.max(fees.halfHourFee || 10, 2); // floor at 2 sat/vB

    // Build PSBT
    const psbt = new bitcoinjs.Psbt({ network });
    const sortedUtxos = [...utxos].sort((a: any, b: any) => b.value - a.value);
    let totalInput = 0;

    for (let i = 0; i < Math.min(sortedUtxos.length, 5) && totalInput < amountSats + feeRate * 250; i++) {
      const utxo = sortedUtxos[i];
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoinjs.address.toOutputScript(platformAddress, network),
          value: utxo.value,
        },
      });
      totalInput += utxo.value;
    }

    const estimatedVBytes = psbt.inputCount * 68 + 2 * 31 + 11;
    const estimatedFee = feeRate * estimatedVBytes;

    if (totalInput < amountSats + estimatedFee) {
      await supabase.rpc("deduct_btc_balance", { p_wallet: walletAddress, p_amount: -amountBtc });
      await supabase.from("btc_withdrawals").update({
        status: "failed", error_message: "Insufficient platform UTXOs",
      }).eq("id", withdrawalId);
      return new Response(JSON.stringify({ error: "Platform wallet has insufficient funds for withdrawal + fees" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    psbt.addOutput({ address: walletAddress, value: amountSats });

    const changeValue = totalInput - amountSats - estimatedFee;
    if (changeValue >= 546) {
      psbt.addOutput({ address: platformAddress, value: changeValue });
    }

    for (let i = 0; i < psbt.inputCount; i++) {
      psbt.signInput(i, keyPair);
    }
    psbt.finalizeAllInputs();

    const rawTx = psbt.extractTransaction().toHex();
    const broadcastRes = await fetch("https://mempool.space/api/tx", {
      method: "POST",
      body: rawTx,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      console.error("[btc-withdraw] Broadcast failed:", errText);
      // Restore balance on broadcast failure
      await supabase.rpc("deduct_btc_balance", { p_wallet: walletAddress, p_amount: -amountBtc });
      await supabase.from("btc_withdrawals").update({
        status: "failed", error_message: `Broadcast failed: ${errText.slice(0, 200)}`,
      }).eq("id", withdrawalId);
      return new Response(JSON.stringify({ error: `Broadcast failed: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txid = await broadcastRes.text();
    console.log(`[btc-withdraw] ✅ txid: ${txid} | ${amountBtc} BTC → ${walletAddress}`);

    // Mark completed
    await supabase.from("btc_withdrawals").update({
      status: "completed",
      txid,
      fee_sats: estimatedFee,
      completed_at: new Date().toISOString(),
    }).eq("id", withdrawalId);

    return new Response(JSON.stringify({
      success: true,
      txid,
      amountBtc,
      feeSats: estimatedFee,
      explorer: `https://mempool.space/tx/${txid}`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[btc-withdraw] Error:", error);

    // If we have a withdrawal record, mark it failed
    if (withdrawalId) {
      const supabase2 = getSupabase();
      await supabase2.from("btc_withdrawals").update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      }).eq("id", withdrawalId);
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
