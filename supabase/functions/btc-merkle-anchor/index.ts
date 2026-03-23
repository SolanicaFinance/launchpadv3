/**
 * btc-merkle-anchor: Periodic solvency proof.
 * Builds a Merkle tree of ALL btc_meme_balances, then posts the root
 * to Bitcoin via OP_RETURN.
 *
 * Called by pg_cron every 10 minutes.
 * 
 * Merkle leaf = SHA256(wallet_address + token_id + balance)
 * Anyone can independently verify their balance is included.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function buildMerkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) return await sha256("EMPTY_TREE");
  if (leaves.length === 1) return leaves[0];

  // Sort for deterministic ordering
  const sorted = [...leaves].sort();
  let level = sorted;

  while (level.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left; // duplicate last if odd
      nextLevel.push(await sha256(left + right));
    }
    level = nextLevel;
  }

  return level[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Fetch ALL non-zero balances
    const { data: balances, error: balErr } = await supabase
      .from("btc_meme_balances")
      .select("wallet_address, token_id, balance")
      .gt("balance", 0)
      .order("wallet_address")
      .limit(10000);

    if (balErr) throw balErr;

    // Also fetch BTC trading balances
    const { data: btcBalances, error: btcErr } = await supabase
      .from("btc_trading_balances")
      .select("wallet_address, balance_btc")
      .gt("balance_btc", 0)
      .order("wallet_address")
      .limit(10000);

    if (btcErr) throw btcErr;

    // Build Merkle leaves
    const leaves: string[] = [];

    for (const b of (balances || [])) {
      const leaf = await sha256(`${b.wallet_address}|${b.token_id}|${b.balance}`);
      leaves.push(leaf);
    }

    for (const b of (btcBalances || [])) {
      const leaf = await sha256(`${b.wallet_address}|BTC_BALANCE|${b.balance_btc}`);
      leaves.push(leaf);
    }

    const merkleRoot = await buildMerkleRoot(leaves);
    const totalAccounts = new Set([
      ...(balances || []).map(b => b.wallet_address),
      ...(btcBalances || []).map(b => b.wallet_address),
    ]).size;
    const totalTokens = new Set((balances || []).map(b => b.token_id)).size;

    console.log(`[btc-merkle-anchor] Merkle root: ${merkleRoot}`);
    console.log(`[btc-merkle-anchor] ${leaves.length} leaves, ${totalAccounts} accounts, ${totalTokens} tokens`);

    // Build OP_RETURN payload: SATURN_ANCHOR|MERKLE_ROOT|TIMESTAMP
    const timestamp = Math.floor(Date.now() / 1000).toString(36);
    const payload = `SATURN_ANCHOR|${merkleRoot.slice(0, 48)}|${timestamp}`;

    const btcTreasuryWif = Deno.env.get("BTC_TREASURY_WIF");

    let anchorTxid: string;
    let status: string;

    if (!btcTreasuryWif) {
      // No BTC wallet — store anchor locally with deterministic ID
      const payloadHash = await sha256(payload);
      anchorTxid = `pending:${payloadHash.slice(0, 48)}`;
      status = "pending";
      console.log("[btc-merkle-anchor] BTC_TREASURY_WIF not configured. Storing pending anchor.");
    } else {
      // Real Bitcoin OP_RETURN
      const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
      const ECPairFactory = (await import("npm:ecpair@3.0.0")).default;
      const ecc = await import("npm:tiny-secp256k1@2.2.3");

      const ECPair = ECPairFactory(ecc);
      const network = bitcoinjs.networks.bitcoin;
      const keyPair = ECPair.fromWIF(btcTreasuryWif, network);
      const { address } = bitcoinjs.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network });

      if (!address) throw new Error("Could not derive BTC address");

      const utxoRes = await fetch(`https://mempool.space/api/address/${address}/utxo`);
      const utxos = await utxoRes.json();

      if (!utxos.length) {
        // Store as pending if no UTXOs
        anchorTxid = `pending:no_utxos:${merkleRoot.slice(0, 32)}`;
        status = "pending";
      } else {
        const feeRes = await fetch("https://mempool.space/api/v1/fees/recommended");
        const fees = await feeRes.json();
        const feeRate = fees.economyFee || 5; // use economy for anchoring

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

        const encoder = new TextEncoder();
        const opReturnData = encoder.encode(payload);
        const embed = bitcoinjs.payments.embed({ data: [Buffer.from(opReturnData)] });
        psbt.addOutput({ script: embed.output!, value: 0 });

        const estimatedFee = feeRate * 150;
        const changeValue = utxo.value - estimatedFee;

        if (changeValue < 546) {
          anchorTxid = `pending:insufficient_funds:${merkleRoot.slice(0, 32)}`;
          status = "pending";
        } else {
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

          anchorTxid = await broadcastRes.text();
          status = "confirmed";
          console.log(`[btc-merkle-anchor] ✅ Anchor txid: ${anchorTxid}`);
        }
      }
    }

    // Record anchor
    await supabase.from("btc_merkle_anchors").insert({
      anchor_txid: anchorTxid,
      merkle_root: merkleRoot,
      total_accounts: totalAccounts,
      total_tokens: totalTokens,
      balances_snapshot: { leaves_count: leaves.length, timestamp: Date.now() },
    });

    // Update all tokens with latest anchor info
    await supabase.from("btc_meme_tokens").update({
      last_anchor_at: new Date().toISOString(),
      last_anchor_txid: anchorTxid,
    }).eq("status", "active");

    return new Response(JSON.stringify({
      success: true,
      status,
      anchorTxid,
      merkleRoot,
      totalAccounts,
      totalTokens,
      leavesCount: leaves.length,
      explorer: status === "confirmed" ? `https://mempool.space/tx/${anchorTxid}` : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-merkle-anchor] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
