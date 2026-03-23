/**
 * btc-anchor-document: Anchors a document hash to Bitcoin via OP_RETURN.
 * 
 * This creates an immutable, timestamped proof-of-existence for any document
 * on the Bitcoin blockchain. Used for whitepaper copyright protection.
 *
 * OP_RETURN format (≤80 bytes):
 *   SATURN|DOC_TYPE|SHA256_HASH_PREFIX|TIMESTAMP
 *
 * Requires BTC_PLATFORM_WIF secret for real broadcast.
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
    const { documentHash, documentType, documentTitle } = await req.json();

    if (!documentHash || !documentType) {
      return new Response(JSON.stringify({ error: "documentHash and documentType required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate SHA-256 hash format
    if (!/^[a-f0-9]{64}$/i.test(documentHash)) {
      return new Response(JSON.stringify({ error: "Invalid SHA-256 hash format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Build OP_RETURN payload (max 80 bytes)
    // Format: SATURN|TYPE|HASH_PREFIX|TIMESTAMP
    const timestamp = Math.floor(Date.now() / 1000).toString(36);
    const typeShort = documentType.slice(0, 16);
    // Use as much of the hash as fits in 80 bytes
    const overhead = `www.Saturn.Trade|${typeShort}||${timestamp}`.length;
    const hashChars = Math.min(64, 80 - overhead);
    const hashPrefix = documentHash.slice(0, hashChars);

    let payload = `www.Saturn.Trade|${typeShort}|${hashPrefix}|${timestamp}`;
    const encoder = new TextEncoder();
    while (encoder.encode(payload).length > 80) {
      payload = payload.slice(0, -1);
    }

    console.log(`[btc-anchor-doc] Payload (${encoder.encode(payload).length} bytes): ${payload}`);
    console.log(`[btc-anchor-doc] Full SHA-256: ${documentHash}`);
    console.log(`[btc-anchor-doc] Document: ${documentTitle || documentType}`);

    const btcTreasuryWif = Deno.env.get("BTC_PLATFORM_WIF") || Deno.env.get("BTC_TREASURY_WIF");

    if (!btcTreasuryWif) {
      // Store as pending anchor — will be broadcast once BTC wallet is configured
      const payloadHash = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
      const pendingTxid = "pending_doc:" + Array.from(new Uint8Array(payloadHash))
        .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);

      // Store in database for later broadcast
      await supabase.from("btc_merkle_anchors").insert({
        anchor_txid: pendingTxid,
        merkle_root: documentHash,
        total_tokens: 0,
        total_accounts: 0,
        balances_snapshot: {
          type: "document_anchor",
          document_type: documentType,
          document_title: documentTitle || null,
          full_hash: documentHash,
          payload,
          status: "pending_broadcast",
        },
      });

      return new Response(JSON.stringify({
        success: true,
        status: "pending",
        pendingTxid,
        payload,
        documentHash,
        message: "Document hash prepared for Bitcoin anchoring. Will broadcast once BTC_PLATFORM_WIF is configured.",
        verification: {
          hash: documentHash,
          algorithm: "SHA-256",
          instruction: "To verify: sha256sum TAT_Whitepaper_Saturn.pdf — compare with on-chain hash",
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Real Bitcoin OP_RETURN transaction ===
    const { Buffer } = await import("node:buffer");
    const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
    const ECPairFactory = (await import("npm:ecpair@3.0.0")).default;
    const ecc = await import("npm:tiny-secp256k1@2.2.3");
    
    const ECPair = ECPairFactory(ecc);
    const network = bitcoinjs.networks.bitcoin;
    const keyPair = ECPair.fromWIF(btcTreasuryWif, network);
    const { address } = bitcoinjs.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });

    if (!address) throw new Error("Could not derive BTC address");
    console.log(`[btc-anchor-doc] BTC treasury address: ${address}`);

    // Fetch UTXOs
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
    const feeRate = fees.halfHourFee || 10;

    // Build transaction
    const psbt = new bitcoinjs.Psbt({ network });
    const utxo = utxos.sort((a: any, b: any) => b.value - a.value)[0];

    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoinjs.address.toOutputScript(address, network),
        value: utxo.value,
      },
    });

    // OP_RETURN output
    const opReturnData = encoder.encode(payload);
    const embed = bitcoinjs.payments.embed({ data: [Buffer.from(opReturnData)] });
    psbt.addOutput({ script: embed.output!, value: 0 });

    // Change output
    const estimatedFee = feeRate * 150;
    const changeValue = utxo.value - estimatedFee;
    
    if (changeValue < 546) {
      return new Response(JSON.stringify({ error: "UTXO too small to cover fees" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    psbt.addOutput({ address, value: changeValue });
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
    console.log(`[btc-anchor-doc] ✅ Document anchor txid: ${txid}`);

    // Store in database
    await supabase.from("btc_merkle_anchors").insert({
      anchor_txid: txid,
      merkle_root: documentHash,
      total_tokens: 0,
      total_accounts: 0,
      balances_snapshot: {
        type: "document_anchor",
        document_type: documentType,
        document_title: documentTitle || null,
        full_hash: documentHash,
        payload,
        status: "confirmed",
      },
    });

    return new Response(JSON.stringify({
      success: true,
      status: "broadcast",
      txid,
      payload,
      documentHash,
      explorer: `https://mempool.space/tx/${txid}`,
      verification: {
        hash: documentHash,
        algorithm: "SHA-256",
        bitcoinTxid: txid,
        instruction: "To verify: sha256sum TAT_Whitepaper_Saturn.pdf — compare with OP_RETURN data on-chain",
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-anchor-doc] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
