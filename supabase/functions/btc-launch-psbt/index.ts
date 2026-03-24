/**
 * btc-launch-psbt: Builds a PSBT that includes both:
 *   1. Payment output to platform address (dev buy + launch fee)
 *   2. OP_RETURN output with token "birth certificate" (genesis proof)
 *
 * Actions:
 *   - "build": Fetches UTXOs, builds unsigned PSBT → returns hex for wallet signing
 *   - "broadcast": Takes signed PSBT hex, finalizes & broadcasts to mempool.space
 *
 * OP_RETURN format (≤80 bytes):
 *   www.Saturn.Trade|TICKER|NAME_SHORT|CREATOR_PREFIX|TIMESTAMP
 */

import { Buffer } from "node:buffer";

const MEMPOOL_API_BASES = [
  "https://mempool.space/api",
  "https://mempool.emzy.de/api",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "build") {
      return await handleBuild(body);
    } else if (action === "broadcast") {
      return await handleBroadcast(body);
    } else {
      return jsonRes({ error: "Invalid action. Use 'build' or 'broadcast'." }, 400);
    }
  } catch (error) {
    console.error("[btc-launch-psbt] Error:", error);
    return jsonRes({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});

async function handleBuild(body: any) {
  const { senderAddress, platformAddress, totalSats, ticker, name, creatorWallet } = body;

  if (!senderAddress || !platformAddress || !totalSats || !ticker || !name) {
    return jsonRes({ error: "senderAddress, platformAddress, totalSats, ticker, name required" }, 400);
  }

  // Build OP_RETURN payload (max 80 bytes)
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  const nameShort = name.trim().slice(0, 20);
  const cleanTicker = ticker.toUpperCase().trim();
  const creatorPrefix = creatorWallet ? creatorWallet.slice(0, 8) : "0";

  let payload = `www.Saturn.Trade|${cleanTicker}|${nameShort}|${creatorPrefix}|${timestamp}`;
  const encoder = new TextEncoder();
  while (encoder.encode(payload).length > 80) {
    payload = payload.slice(0, -1);
  }
  console.log(`[btc-launch-psbt] OP_RETURN payload (${encoder.encode(payload).length} bytes): ${payload}`);

  // Fetch UTXOs for sender
  const utxoRes = await fetchFromMempool(`/address/${encodeURIComponent(senderAddress)}/utxo`);
  if (!utxoRes.ok) {
    const errText = await safeReadText(utxoRes);
    return jsonRes(
      {
        error:
          utxoRes.status >= 400 && utxoRes.status < 500
            ? `Could not read UTXOs for this wallet address. Please reconnect your BTC wallet and try again.`
            : "Bitcoin network lookup is temporarily unavailable. Please try again in a moment.",
        details: errText || `UTXO lookup failed with status ${utxoRes.status}`,
      },
      utxoRes.status >= 400 && utxoRes.status < 500 ? 400 : 502,
    );
  }
  const utxos = await utxoRes.json();

  if (!utxos || utxos.length === 0) {
    return jsonRes({ error: "No UTXOs found for your address. Fund your wallet first." }, 400);
  }

  // Fetch fee rate
  const feeRes = await fetchFromMempool("/v1/fees/recommended");
  const fees = feeRes.ok ? await feeRes.json() : {};
  const feeRate = fees.halfHourFee || 10;

  // Sort UTXOs by value descending, pick enough to cover totalSats + estimated fee
  const sortedUtxos = utxos
    .filter((u: any) => u.value > 0)
    .sort((a: any, b: any) => b.value - a.value);

  // Estimate tx size: ~68 vB per input + ~31 per output + ~11 overhead
  // We'll have at least: 1 input, 3 outputs (payment, OP_RETURN, change)
  const estimateVsize = (inputs: number) => inputs * 68 + 3 * 31 + 11;
  
  let selectedUtxos: any[] = [];
  let totalInput = 0;
  let estimatedFee = 0;

  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    totalInput += utxo.value;
    estimatedFee = Math.ceil(estimateVsize(selectedUtxos.length) * feeRate);
    
    if (totalInput >= totalSats + estimatedFee) break;
  }

  if (totalInput < totalSats + estimatedFee) {
    return jsonRes({ 
      error: `Insufficient funds. Need ${totalSats + estimatedFee} sats, have ${totalInput} sats.`,
      required: totalSats + estimatedFee,
      available: totalInput,
    }, 400);
  }

  // Detect address type for proper PSBT construction
  const addressType = detectAddressType(senderAddress);
  console.log(`[btc-launch-psbt] Address type: ${addressType}, inputs: ${selectedUtxos.length}, fee: ${estimatedFee} sats`);

  // Build PSBT manually (hex construction)
  // We'll use bitcoinjs-lib in Deno via npm import
  const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
  const network = bitcoinjs.networks.bitcoin;
  const psbt = new bitcoinjs.Psbt({ network });

  // Add inputs
  for (const utxo of selectedUtxos) {
    if (addressType === "p2wpkh" || addressType === "p2sh-p2wpkh" || addressType === "p2tr") {
      // For segwit inputs, we need witnessUtxo
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoinjs.address.toOutputScript(senderAddress, network),
          value: utxo.value,
        },
        ...(addressType === "p2tr" ? { tapInternalKey: undefined } : {}),
      });
    } else {
      // For legacy (p2pkh), we need the full previous tx
        const prevTxRes = await fetchFromMempool(`/tx/${utxo.txid}/hex`);
        if (!prevTxRes.ok) {
          const errText = await safeReadText(prevTxRes);
          return jsonRes({ error: "Failed to load previous transaction data.", details: errText }, 502);
        }
        const prevTxHex = await prevTxRes.text();
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        nonWitnessUtxo: Buffer.from(prevTxHex, "hex"),
      });
    }
  }

  // Output 1: Payment to platform
  psbt.addOutput({
    address: platformAddress,
    value: totalSats,
  });

  // Output 2: OP_RETURN with genesis proof
  const opReturnData = encoder.encode(payload);
  const embed = bitcoinjs.payments.embed({ data: [Buffer.from(opReturnData)] });
  psbt.addOutput({ script: embed.output!, value: 0 });

  // Output 3: Change back to sender
  const changeValue = totalInput - totalSats - estimatedFee;
  if (changeValue >= 546) {
    psbt.addOutput({ address: senderAddress, value: changeValue });
  }

  const psbtHex = psbt.toHex();
  const psbtBase64 = psbt.toBase64();

  return jsonRes({
    success: true,
    psbtHex,
    psbtBase64,
    payload,
    feeRate,
    estimatedFee,
    inputCount: selectedUtxos.length,
    totalInput,
    changeValue: changeValue >= 546 ? changeValue : 0,
  });
}

async function handleBroadcast(body: any) {
  const { signedPsbtHex } = body;

  if (!signedPsbtHex) {
    return jsonRes({ error: "signedPsbtHex required" }, 400);
  }

  try {
    const bitcoinjs = await import("npm:bitcoinjs-lib@6.1.6");
    const psbt = bitcoinjs.Psbt.fromHex(signedPsbtHex);
    
    // Finalize all inputs
    psbt.finalizeAllInputs();
    
    // Extract raw transaction
    const rawTx = psbt.extractTransaction().toHex();
    console.log(`[btc-launch-psbt] Broadcasting tx (${rawTx.length / 2} bytes)`);

    // Broadcast via mempool.space
    const broadcastRes = await fetchFromMempool("/tx", {
      method: "POST",
      body: rawTx,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      throw new Error(`Broadcast failed: ${errText}`);
    }

    const txid = await broadcastRes.text();
    console.log(`[btc-launch-psbt] ✅ Broadcast success: ${txid}`);

    return jsonRes({
      success: true,
      txid,
      explorer: `https://mempool.space/tx/${txid}`,
    });
  } catch (error) {
    console.error("[btc-launch-psbt] Broadcast error:", error);
    return jsonRes({ error: error instanceof Error ? error.message : "Broadcast failed" }, 500);
  }
}

function detectAddressType(address: string): string {
  if (address.startsWith("bc1q")) return "p2wpkh";
  if (address.startsWith("bc1p")) return "p2tr";
  if (address.startsWith("3")) return "p2sh-p2wpkh";
  if (address.startsWith("1")) return "p2pkh";
  return "p2wpkh"; // default
}

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchFromMempool(path: string, init?: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (const base of MEMPOOL_API_BASES) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (response.ok) return response;
      if (response.status < 500) return response;
      lastResponse = response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastResponse) return lastResponse;

  throw new Error(
    lastError instanceof Error
      ? `Mempool API request failed: ${lastError.message}`
      : "Mempool API request failed",
  );
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
