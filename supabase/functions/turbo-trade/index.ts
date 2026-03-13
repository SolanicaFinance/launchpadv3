/**
 * Turbo Trade — Server-Side Fast Execution Pipeline
 * 
 * All-in-one edge function that builds, signs, and broadcasts swap transactions
 * server-side for maximum speed. Eliminates client-side Privy round-trips.
 * 
 * Flow: Resolve wallet → Build tx (Jupiter) → Privy sign-only → Parallel broadcast to Jito + Helius
 * Target latency: ~550ms (vs ~1600-3000ms client-side)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  getPrivyUser,
  findSolanaEmbeddedWallet,
  signTransaction,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Jito sendTransaction endpoints (all regions)
const JITO_TX_ENDPOINTS = [
  "https://mainnet.block-engine.jito.wtf/api/v1/transactions",
  "https://ny.mainnet.block-engine.jito.wtf/api/v1/transactions",
  "https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/transactions",
  "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/transactions",
  "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/transactions",
];

// Jito tip accounts for priority inclusion
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
];

/**
 * Broadcast signed tx to all Jito regions + Helius in parallel (fire-and-forget)
 */
function broadcastToAll(base64Tx: string, heliusRpcUrl: string): void {
  // Jito endpoints
  for (const endpoint of JITO_TX_ENDPOINTS) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [base64Tx, { encoding: "base64" }],
      }),
    }).catch(() => {});
  }

  // Helius RPC
  fetch(heliusRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        base64Tx,
        {
          encoding: "base64",
          skipPreflight: true,
          preflightCommitment: "processed",
          maxRetries: 0,
        },
      ],
    }),
  }).catch(() => {});
}

/**
 * Extract signature from a signed base64 transaction
 */
function extractSignatureFromBase64Tx(base64Tx: string): string {
  const bytes = Uint8Array.from(atob(base64Tx), (c) => c.charCodeAt(0));
  // VersionedTransaction: first byte is prefix (0x80), then signatures
  // Legacy: first byte is num signatures
  // In both cases, the first 64-byte signature starts after the count byte(s)
  
  // Try versioned format first (0x80 prefix)
  let sigStart = 1; // after num_signatures byte
  if (bytes[0] === 0x80) {
    // Versioned: 0x80, then num_signatures varint, then signatures
    sigStart = 2; // 0x80 + num_sigs byte
  }
  
  // The first 64 bytes after the signature count is the primary signature
  const sigBytes = bytes.slice(sigStart, sigStart + 64);
  
  // Convert to base58
  const bs58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(0);
  for (const byte of sigBytes) {
    num = num * BigInt(256) + BigInt(byte);
  }
  if (num === BigInt(0)) return "";
  let result = "";
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    result = bs58Chars[remainder] + result;
    num = num / BigInt(58);
  }
  // Add leading '1's for leading zero bytes
  for (const byte of sigBytes) {
    if (byte === 0) result = "1" + result;
    else break;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  const timings: Record<string, number> = {};

  try {
    const {
      privyUserId,   // "did:privy:..." — primary
      profileId,     // UUID fallback
      walletAddress, // wallet fallback  
      mintAddress,
      amount,
      isBuy = true,
      slippageBps = 500,
      tokenStatus,   // "bonding" | "graduated" — hint to skip lookup
    } = await req.json();

    if (!mintAddress || !amount) {
      return new Response(
        JSON.stringify({ error: "mintAddress and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const jupiterApiKey = Deno.env.get("JUPITER_API_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Resolve wallet (fast path: DB cache) ────────────────────────
    const t1 = performance.now();
    let resolvedWalletId: string | null = null;
    let resolvedWalletAddress: string | null = walletAddress || null;
    let resolvedPrivyDid: string | null = privyUserId || null;
    let resolvedProfileId: string | null = profileId || null;

    // DB lookup (fastest path)
    if (privyUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("privy_did", privyUserId)
        .maybeSingle();
      if (profile) {
        resolvedProfileId = profile.id;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
      }
    } else if (profileId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("id", profileId)
        .maybeSingle();
      if (profile) {
        resolvedPrivyDid = profile.privy_did;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
      }
    } else if (walletAddress) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("solana_wallet_address", walletAddress)
        .maybeSingle();
      if (profile) {
        resolvedProfileId = profile.id;
        resolvedPrivyDid = profile.privy_did;
        resolvedWalletId = profile.privy_wallet_id;
      }
    }

    // Privy API fallback if wallet ID not cached
    if (!resolvedWalletId && resolvedPrivyDid) {
      console.log(`[turbo-trade] Cache miss, fetching wallet from Privy API`);
      const user = await getPrivyUser(resolvedPrivyDid);
      const wallet = findSolanaEmbeddedWallet(user);
      if (!wallet) {
        return new Response(
          JSON.stringify({ error: "No Solana embedded wallet found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedWalletId = wallet.walletId;
      resolvedWalletAddress = wallet.address;
      // Cache for future calls (non-blocking)
      if (resolvedProfileId) {
        supabase.from("profiles")
          .update({ privy_wallet_id: wallet.walletId, privy_did: resolvedPrivyDid })
          .eq("id", resolvedProfileId)
          .then(() => {});
      }
    }

    if (!resolvedWalletId || !resolvedWalletAddress) {
      return new Response(
        JSON.stringify({ error: "Could not resolve wallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    timings.resolve = Math.round(performance.now() - t1);
    console.log(`[turbo-trade] Wallet resolved in ${timings.resolve}ms`);

    // ── 2. Build swap tx via Jupiter ───────────────────────────────────
    const t2 = performance.now();

    // SOL mint
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const inputMint = isBuy ? SOL_MINT : mintAddress;
    const outputMint = isBuy ? mintAddress : SOL_MINT;
    
    // Convert amount to lamports/smallest unit
    const amountLamports = isBuy
      ? Math.floor(Number(amount) * 1e9) // SOL → lamports
      : Math.floor(Number(amount) * 1e6); // Token → smallest unit (6 decimals typical)

    // Jupiter Quote API
    const quoteHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (jupiterApiKey) quoteHeaders["x-api-key"] = jupiterApiKey;
    
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
    
    const quoteRes = await fetch(quoteUrl, { headers: quoteHeaders });
    if (!quoteRes.ok) {
      const quoteErr = await quoteRes.text();
      console.error("[turbo-trade] Jupiter quote failed:", quoteErr);
      return new Response(
        JSON.stringify({ error: `Jupiter quote failed: ${quoteRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const quoteData = await quoteRes.json();
    timings.quote = Math.round(performance.now() - t2);

    // Jupiter Swap API — get serialized transaction
    const t3 = performance.now();
    const swapRes = await fetch("https://api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: quoteHeaders,
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: resolvedWalletAddress,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: {
          jitoTipLamports: 5000000, // 0.005 SOL Jito tip built-in
        },
      }),
    });

    if (!swapRes.ok) {
      const swapErr = await swapRes.text();
      console.error("[turbo-trade] Jupiter swap build failed:", swapErr);
      return new Response(
        JSON.stringify({ error: `Jupiter swap build failed: ${swapRes.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const swapData = await swapRes.json();
    const swapTransaction = swapData.swapTransaction;
    if (!swapTransaction) {
      return new Response(
        JSON.stringify({ error: "No swap transaction returned from Jupiter" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    timings.buildTx = Math.round(performance.now() - t3);

    // ── 3. Sign via Privy (sign-only, we control broadcast) ────────────
    const t4 = performance.now();
    const signedTxBase64 = await signTransaction(resolvedWalletId, swapTransaction);
    timings.sign = Math.round(performance.now() - t4);

    if (!signedTxBase64) {
      return new Response(
        JSON.stringify({ error: "Privy sign returned empty" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Extract signature & broadcast to all endpoints ──────────────
    const t5 = performance.now();
    const signature = extractSignatureFromBase64Tx(signedTxBase64);
    
    // Parallel broadcast to Jito + Helius (fire-and-forget)
    broadcastToAll(signedTxBase64, heliusRpcUrl);
    timings.broadcast = Math.round(performance.now() - t5);

    const totalMs = Math.round(performance.now() - t0);
    console.log(`[turbo-trade] ✅ Done in ${totalMs}ms | resolve=${timings.resolve} quote=${timings.quote} build=${timings.buildTx} sign=${timings.sign} broadcast=${timings.broadcast} | sig=${signature.slice(0, 12)}...`);

    // ── 5. Record trade in DB (non-blocking) ───────────────────────────
    const outputAmount = isBuy
      ? Number(quoteData.outAmount) / 1e6
      : Number(quoteData.outAmount) / 1e9;

    // Look up token for recording
    (async () => {
      try {
        const { data: tokenData } = await supabase
          .from("tokens")
          .select("id")
          .eq("mint_address", mintAddress)
          .maybeSingle();
        const { data: funTokenData } = await supabase
          .from("fun_tokens")
          .select("id, name, ticker")
          .eq("mint_address", mintAddress)
          .maybeSingle();

        const tokenId = tokenData?.id || funTokenData?.id;
        if (tokenId) {
          await supabase.rpc("backend_record_transaction", {
            p_token_id: tokenId,
            p_user_wallet: resolvedWalletAddress,
            p_transaction_type: isBuy ? "buy" : "sell",
            p_sol_amount: isBuy ? Number(amount) : outputAmount,
            p_token_amount: isBuy ? outputAmount : Number(amount),
            p_price_per_token: 0,
            p_signature: signature,
            p_user_profile_id: resolvedProfileId,
          });
        }

        // Also record in alpha_trades
        const tokenName = funTokenData?.name || null;
        const tokenTicker = funTokenData?.ticker || null;
        await supabase.from("alpha_trades").insert({
          wallet_address: resolvedWalletAddress!,
          token_mint: mintAddress,
          token_name: tokenName,
          token_ticker: tokenTicker,
          trade_type: isBuy ? "buy" : "sell",
          amount_sol: isBuy ? Number(amount) : outputAmount,
          amount_tokens: isBuy ? outputAmount : Number(amount),
          tx_hash: signature,
        });
      } catch (e) {
        console.warn("[turbo-trade] DB record failed (non-fatal):", e);
      }
    })();

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        outputAmount,
        timings,
        totalMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const totalMs = Math.round(performance.now() - t0);
    console.error(`[turbo-trade] Error after ${totalMs}ms:`, error);
    return new Response(
      JSON.stringify({ error: message, totalMs }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
