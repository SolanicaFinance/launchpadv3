/**
 * btc-solana-proof: Posts a Solana Memo transaction as proof-of-trade
 * for every BTC meme token trade. Called by btc-meme-swap after settlement.
 *
 * Uses the platform treasury wallet (TREASURY_PRIVATE_KEY) to sign + pay.
 * Cost: ~0.000005 SOL per proof (~$0.001).
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Solana constants
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const SOLANA_MAINNET = "https://api.mainnet-beta.solana.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tradeId, tokenTicker, tokenName, tradeType, btcAmount, tokenAmount, walletAddress, genesisTxid, imageHash } = await req.json();

    if (!tradeId || !tokenTicker || !tradeType || !walletAddress) {
      return new Response(JSON.stringify({ error: "tradeId, tokenTicker, tradeType, walletAddress required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || SOLANA_MAINNET;
    const treasuryKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    if (!treasuryKey) {
      return new Response(JSON.stringify({ error: "TREASURY_PRIVATE_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build memo string: SATURN_BTC|TYPE|BTC_AMT|TOKEN_AMT|TICKER|WALLET|GENESIS|IMG_HASH
    const memoFields = [
      "SATURN_BTC",
      tradeType.toUpperCase(),
      `${btcAmount}BTC`,
      `${tokenAmount}${tokenTicker}`,
      walletAddress.slice(0, 12) + "...",
      genesisTxid ? `gen:${genesisTxid.slice(0, 16)}` : "gen:pending",
      imageHash ? `img:${imageHash.slice(0, 16)}` : "",
    ].filter(Boolean).join("|");

    console.log(`[btc-solana-proof] Memo: ${memoFields}`);

    // Import Solana Web3 for transaction building
    const { Keypair, Transaction, TransactionInstruction, PublicKey, Connection } = 
      await import("npm:@solana/web3.js@1.98.0");
    const bs58 = await import("npm:bs58@6.0.0");

    // Load treasury keypair
    const treasuryKeypair = Keypair.fromSecretKey(bs58.default.decode(treasuryKey));
    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Build memo instruction
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: new TextEncoder().encode(memoFields),
    });

    // Build and send transaction
    const tx = new Transaction().add(memoInstruction);
    tx.feePayer = treasuryKeypair.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    tx.sign(treasuryKeypair);

    const rawTx = tx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 3,
    });

    console.log(`[btc-solana-proof] ✅ Proof tx: ${signature}`);

    // Update the trade record with proof
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    await supabase.from("btc_meme_trades").update({
      solana_proof_signature: signature,
      solana_proof_memo: memoFields,
    }).eq("id", tradeId);

    return new Response(JSON.stringify({
      success: true,
      signature,
      memo: memoFields,
      explorer: `https://solscan.io/tx/${signature}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-solana-proof] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
