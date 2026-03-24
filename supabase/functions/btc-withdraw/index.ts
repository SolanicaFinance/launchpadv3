const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Buffer } from "node:buffer";

const MIN_WITHDRAW_BTC = 0.00005; // 5000 sats minimum
const MAX_WITHDRAW_BTC = 0.1;     // safety cap per withdrawal

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { walletAddress, amountBtc } = await req.json();

    if (!walletAddress || !amountBtc || amountBtc <= 0) {
      return new Response(JSON.stringify({ error: "walletAddress and positive amountBtc required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amountBtc < MIN_WITHDRAW_BTC) {
      return new Response(JSON.stringify({ error: `Minimum withdrawal is ${MIN_WITHDRAW_BTC} BTC (${MIN_WITHDRAW_BTC * 1e8} sats)` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (amountBtc > MAX_WITHDRAW_BTC) {
      return new Response(JSON.stringify({ error: `Maximum withdrawal is ${MAX_WITHDRAW_BTC} BTC per transaction` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate BTC address format (basic check for mainnet bech32/legacy)
    if (!/^(bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(walletAddress)) {
      return new Response(JSON.stringify({ error: "Invalid Bitcoin address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Check user's internal trading balance
    const { data: bal } = await supabase
      .from("btc_trading_balances")
      .select("balance_btc, total_deposited, total_withdrawn")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (!bal || bal.balance_btc < amountBtc) {
      return new Response(JSON.stringify({
        error: "Insufficient balance",
        available: bal?.balance_btc || 0,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Security: cannot withdraw more than deposited minus already withdrawn
    const maxWithdrawable = bal.total_deposited - bal.total_withdrawn;
    if (amountBtc > maxWithdrawable) {
      return new Response(JSON.stringify({
        error: "Withdrawal exceeds deposited amount",
        maxWithdrawable,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get platform wallet
    const btcWif = Deno.env.get("BTC_PLATFORM_WIF");
    if (!btcWif) {
      return new Response(JSON.stringify({ error: "Platform withdrawal wallet not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Import Bitcoin libraries
    const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
    const ECPairFactory = (await import("npm:ecpair@3.0.0")).default;
    const ecc = await import("npm:tiny-secp256k1@2.2.3");

    const ECPair = ECPairFactory(ecc);
    const network = bitcoinjs.networks.bitcoin;
    const keyPair = ECPair.fromWIF(btcWif, network);
    const { address: platformAddress } = bitcoinjs.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
      network,
    });

    if (!platformAddress) throw new Error("Could not derive platform address");

    const amountSats = Math.floor(amountBtc * 1e8);

    // Fetch UTXOs
    const utxoRes = await fetch(`https://mempool.space/api/address/${platformAddress}/utxo`);
    if (!utxoRes.ok) throw new Error("Failed to fetch UTXOs from mempool.space");
    const utxos = await utxoRes.json();

    if (!utxos.length) {
      return new Response(JSON.stringify({ error: "Platform wallet has no UTXOs. Contact support." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get fee rate
    const feeRes = await fetch("https://mempool.space/api/v1/fees/recommended");
    const fees = await feeRes.json();
    const feeRate = fees.halfHourFee || 10;

    // Build PSBT
    const psbt = new bitcoinjs.Psbt({ network });

    // Select UTXOs (greedy: largest first)
    const sortedUtxos = [...utxos].sort((a: any, b: any) => b.value - a.value);
    let totalInput = 0;
    const inputCount = Math.min(sortedUtxos.length, 5); // limit inputs

    for (let i = 0; i < inputCount && totalInput < amountSats + feeRate * 200; i++) {
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

    // Estimate fee: ~68 vB per input + 31 vB per output + 10.5 overhead
    const estimatedVBytes = psbt.inputCount * 68 + 2 * 31 + 11;
    const estimatedFee = feeRate * estimatedVBytes;

    if (totalInput < amountSats + estimatedFee) {
      return new Response(JSON.stringify({
        error: "Platform wallet has insufficient funds for this withdrawal + fees",
        available: totalInput / 1e8,
        needed: (amountSats + estimatedFee) / 1e8,
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Withdrawal output to user
    psbt.addOutput({ address: walletAddress, value: amountSats });

    // Change back to platform
    const changeValue = totalInput - amountSats - estimatedFee;
    if (changeValue >= 546) {
      psbt.addOutput({ address: platformAddress, value: changeValue });
    }

    // Sign all inputs
    for (let i = 0; i < psbt.inputCount; i++) {
      psbt.signInput(i, keyPair);
    }
    psbt.finalizeAllInputs();

    // Broadcast
    const rawTx = psbt.extractTransaction().toHex();
    const broadcastRes = await fetch("https://mempool.space/api/tx", {
      method: "POST",
      body: rawTx,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      console.error("[btc-withdraw] Broadcast failed:", errText);
      return new Response(JSON.stringify({ error: `Broadcast failed: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txid = await broadcastRes.text();
    console.log(`[btc-withdraw] ✅ Withdrawal txid: ${txid} | ${amountBtc} BTC → ${walletAddress}`);

    // Deduct from internal balance
    await supabase.from("btc_trading_balances").update({
      balance_btc: bal.balance_btc - amountBtc,
      total_withdrawn: (bal.total_withdrawn || 0) + amountBtc,
      updated_at: new Date().toISOString(),
    }).eq("wallet_address", walletAddress);

    return new Response(JSON.stringify({
      success: true,
      txid,
      amountBtc,
      feeSats: estimatedFee,
      explorer: `https://mempool.space/tx/${txid}`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-withdraw] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
