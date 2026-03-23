/**
 * btc-genesis-proof: Posts a Bitcoin OP_RETURN transaction as the
 * "birth certificate" for a BTC meme token.
 *
 * OP_RETURN format (≤80 bytes):
 *   SATURN|TICKER|NAME_HASH|IMAGE_HASH_PREFIX|TIMESTAMP
 *
 * Uses mempool.space API to broadcast the raw tx.
 * Requires a funded BTC wallet (BTC_TREASURY_WIF secret).
 *
 * NOTE: If BTC_TREASURY_WIF is not yet configured, this function
 * will generate a simulated genesis and store the intended payload,
 * ready to anchor once the BTC wallet is funded.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tokenId, ticker, name, imageUrl, creatorWallet } = await req.json();

    if (!tokenId || !ticker || !name) {
      return new Response(JSON.stringify({ error: "tokenId, ticker, name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Generate image hash if URL provided
    let imageHash: string | null = null;
    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
        const hashBuffer = await crypto.subtle.digest("SHA-256", imgBytes);
        imageHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (e) {
        console.warn("[btc-genesis] Could not hash image:", e);
      }
    }

    // Store image hash
    if (imageHash) {
      await supabase.from("btc_meme_tokens").update({ image_hash: imageHash }).eq("id", tokenId);
    }

    // Build OP_RETURN payload (max 80 bytes)
    // Format: SATURN|TICKER|NAME_TRUNCATED|IMG_HASH_PREFIX|TIMESTAMP
    const timestamp = Math.floor(Date.now() / 1000).toString(36); // compact timestamp
    const nameShort = name.slice(0, 20);
    const imgPrefix = imageHash ? imageHash.slice(0, 12) : "0";
    const creatorPrefix = creatorWallet ? creatorWallet.slice(0, 8) : "0";
    
    let payload = `Saturn.Trade|${ticker}|${nameShort}|${imgPrefix}|${creatorPrefix}|${timestamp}`;
    // Ensure ≤80 bytes
    const encoder = new TextEncoder();
    while (encoder.encode(payload).length > 80) {
      payload = payload.slice(0, -1);
    }

    console.log(`[btc-genesis] Payload (${encoder.encode(payload).length} bytes): ${payload}`);

    const btcTreasuryWif = Deno.env.get("BTC_TREASURY_WIF");

    if (!btcTreasuryWif) {
      // No BTC wallet configured yet — store as pending genesis
      console.log("[btc-genesis] BTC_TREASURY_WIF not configured. Storing pending genesis.");
      
      // Generate a deterministic "pending" txid from the payload hash
      const payloadHash = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
      const pendingTxid = "pending:" + Array.from(new Uint8Array(payloadHash)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 48);

      await supabase.from("btc_meme_tokens").update({
        genesis_txid: pendingTxid,
      }).eq("id", tokenId);

      return new Response(JSON.stringify({
        success: true,
        status: "pending",
        pendingTxid,
        payload,
        message: "Genesis payload prepared. Will anchor to Bitcoin once BTC_TREASURY_WIF is configured.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Real Bitcoin OP_RETURN transaction ===
    // Use mempool.space to get UTXOs, build raw tx, broadcast
    const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
    const ECPairFactory = (await import("npm:ecpair@3.0.0")).default;
    const ecc = await import("npm:tiny-secp256k1@2.2.3");
    
    const ECPair = ECPairFactory(ecc);
    const network = bitcoinjs.networks.bitcoin;
    const keyPair = ECPair.fromWIF(btcTreasuryWif, network);
    const { address } = bitcoinjs.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });

    if (!address) throw new Error("Could not derive BTC address");
    console.log(`[btc-genesis] BTC treasury address: ${address}`);

    // Fetch UTXOs from mempool.space
    const utxoRes = await fetch(`https://mempool.space/api/address/${address}/utxo`);
    const utxos = await utxoRes.json();

    if (!utxos.length) {
      return new Response(JSON.stringify({ error: "BTC treasury has no UTXOs. Fund it first.", address }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get fee rate
    const feeRes = await fetch("https://mempool.space/api/v1/fees/recommended");
    const fees = await feeRes.json();
    const feeRate = fees.halfHourFee || 10; // sat/vByte

    // Build transaction
    const psbt = new bitcoinjs.Psbt({ network });
    
    // Add largest UTXO as input
    const utxo = utxos.sort((a: any, b: any) => b.value - a.value)[0];
    const prevTxRes = await fetch(`https://mempool.space/api/tx/${utxo.txid}/hex`);
    const prevTxHex = await prevTxRes.text();

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoinjs.address.toOutputScript(address, network),
        value: utxo.value,
      },
    });

    // OP_RETURN output with genesis data
    const opReturnData = encoder.encode(payload);
    const embed = bitcoinjs.payments.embed({ data: [Buffer.from(opReturnData)] });
    psbt.addOutput({ script: embed.output!, value: 0 });

    // Change output (estimated ~150 vBytes for 1-in 2-out segwit)
    const estimatedFee = feeRate * 150;
    const changeValue = utxo.value - estimatedFee;
    
    if (changeValue < 546) {
      return new Response(JSON.stringify({ error: "UTXO too small to cover fees", utxoValue: utxo.value, estimatedFee }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    psbt.addOutput({ address, value: changeValue });

    // Sign and broadcast
    psbt.signInput(0, keyPair);
    psbt.finalizeAllInputs();
    const rawTx = psbt.extractTransaction().toHex();

    const broadcastRes = await fetch("https://mempool.space/api/tx", {
      method: "POST",
      body: rawTx,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      throw new Error(`Broadcast failed: ${errText}`);
    }

    const txid = await broadcastRes.text();
    console.log(`[btc-genesis] ✅ Genesis txid: ${txid}`);

    // Update token with real genesis txid
    await supabase.from("btc_meme_tokens").update({
      genesis_txid: txid,
    }).eq("id", tokenId);

    return new Response(JSON.stringify({
      success: true,
      status: "confirmed",
      txid,
      payload,
      explorer: `https://mempool.space/tx/${txid}`,
      imageHash,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-genesis] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
