import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedTx {
  signature: string;
  type: "send" | "receive" | "swap" | "fee_payout" | "unknown";
  timestamp: number;
  fee: number;
  status: "success" | "failed";
  description: string;
  amount?: number;
  token?: string;
  counterparty?: string;
  label?: string;
  tokenName?: string;
}

const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { walletAddress, limit = 20 } = await req.json();
    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(JSON.stringify({ error: "walletAddress required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcUrl = (Deno.env.get("HELIUS_RPC_URL") ?? "").trim();
    if (!rpcUrl) {
      return new Response(JSON.stringify({ error: "RPC not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract Helius API key from RPC URL for REST API
    const urlObj = new URL(rpcUrl);
    const apiKey = urlObj.searchParams.get("api-key") || urlObj.pathname.split("/").pop() || "";

    // Use Helius enhanced transactions API
    const heliusApiUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${apiKey}&limit=${Math.min(limit, 50)}`;

    const res = await fetch(heliusApiUrl);

    if (!res.ok) {
      // Fallback: use RPC getSignaturesForAddress
      const sigRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignaturesForAddress",
          params: [walletAddress, { limit: Math.min(limit, 50) }],
        }),
      });

      const sigJson = await sigRes.json();
      const signatures = sigJson?.result ?? [];

      const transactions: ParsedTx[] = signatures.map((sig: any) => ({
        signature: sig.signature,
        type: "unknown" as const,
        timestamp: (sig.blockTime || 0) * 1000,
        fee: 0,
        status: sig.err ? "failed" : "success",
        description: sig.memo || "Transaction",
      }));

      return new Response(JSON.stringify({ transactions }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enhancedTxs = await res.json();

    const transactions: ParsedTx[] = (enhancedTxs || []).map((tx: any) => {
      const type = inferTxType(tx, walletAddress);
      const nativeTransfers = tx.nativeTransfers || [];
      const tokenTransfers = tx.tokenTransfers || [];

      let amount: number | undefined;
      let token: string | undefined;
      let counterparty: string | undefined;

      // Parse native SOL transfers
      const solSent = nativeTransfers.find((t: any) => t.fromUserAccount === walletAddress);
      const solReceived = nativeTransfers.find((t: any) => t.toUserAccount === walletAddress);

      if (type === "send" && solSent) {
        amount = solSent.amount / 1e9;
        token = "SOL";
        counterparty = solSent.toUserAccount;
      } else if (type === "receive" && solReceived) {
        amount = solReceived.amount / 1e9;
        token = "SOL";
        counterparty = solReceived.fromUserAccount;
      } else if (tokenTransfers.length > 0) {
        const tt = tokenTransfers[0];
        amount = tt.tokenAmount;
        token = tt.mint;
        counterparty = tt.fromUserAccount === walletAddress ? tt.toUserAccount : tt.fromUserAccount;
      }

      return {
        signature: tx.signature,
        type,
        timestamp: (tx.timestamp || 0) * 1000,
        fee: (tx.fee || 0) / 1e9,
        status: tx.transactionError ? "failed" : "success",
        description: tx.description || tx.type || "Transaction",
        amount,
        token,
        counterparty,
      };
    });

    // ── Sync swap transactions to alpha_trades (non-blocking) ──
    syncSwapsToAlphaTracker(walletAddress, enhancedTxs || [], transactions).catch((err) =>
      console.warn("[fetch-wallet-transactions] alpha sync failed (non-fatal):", err)
    );

    return new Response(JSON.stringify({ transactions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-wallet-transactions error:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch transactions" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function inferTxType(tx: any, wallet: string): "send" | "receive" | "swap" | "unknown" {
  const type = (tx.type || "").toUpperCase();
  if (type === "SWAP") return "swap";
  if (type === "TRANSFER") {
    const nativeTransfers = tx.nativeTransfers || [];
    const tokenTransfers = tx.tokenTransfers || [];
    const isSender =
      nativeTransfers.some((t: any) => t.fromUserAccount === wallet) ||
      tokenTransfers.some((t: any) => t.fromUserAccount === wallet);
    return isSender ? "send" : "receive";
  }
  // Check native transfers as fallback
  const nt = tx.nativeTransfers || [];
  if (nt.some((t: any) => t.fromUserAccount === wallet && t.toUserAccount !== wallet)) return "send";
  if (nt.some((t: any) => t.toUserAccount === wallet && t.fromUserAccount !== wallet)) return "receive";
  return "unknown";
}

/**
 * Detect if a transaction looks like a DeFi swap even if Helius classified it
 * as "unknown", "receive", or "send". Pattern: wallet sends SOL AND receives
 * tokens (buy), or wallet sends tokens AND receives SOL (sell).
 */
function isLikelySwap(tx: any, wallet: string): boolean {
  const nativeTransfers = tx.nativeTransfers || [];
  const tokenTransfers = tx.tokenTransfers || [];
  const WSOL = "So11111111111111111111111111111111111111112";

  const solOut = nativeTransfers.some((t: any) => t.fromUserAccount === wallet && t.amount > 10000);
  const solIn = nativeTransfers.some((t: any) => t.toUserAccount === wallet && t.amount > 10000);
  const tokenIn = tokenTransfers.some((t: any) => t.toUserAccount === wallet && t.mint !== WSOL);
  const tokenOut = tokenTransfers.some((t: any) => t.fromUserAccount === wallet && t.mint !== WSOL);

  // Buy pattern: SOL out + token in
  if (solOut && tokenIn) return true;
  // Sell pattern: token out + SOL in
  if (tokenOut && solIn) return true;

  return false;
}

/**
 * Sync swap transactions from Helius enhanced data into alpha_trades.
 * Uses service role to bypass RLS. Upserts on tx_hash to prevent duplicates.
 * Now detects swaps that Helius misclassifies as unknown/receive/send.
 */
async function syncSwapsToAlphaTracker(
  walletAddress: string,
  enhancedTxs: any[],
  parsedTxs: ParsedTx[]
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const sb = createClient(supabaseUrl, serviceKey);
  const WSOL = "So11111111111111111111111111111111111111112";
  const swapRows: any[] = [];

  for (let i = 0; i < parsedTxs.length; i++) {
    const parsed = parsedTxs[i];
    const raw = enhancedTxs[i];
    if (parsed.status !== "success") continue;

    // Accept explicit swaps OR likely-swap heuristic
    const isSwap = parsed.type === "swap" || isLikelySwap(raw, walletAddress);
    if (!isSwap) continue;

    const tokenTransfers = raw?.tokenTransfers || [];
    const nativeTransfers = raw?.nativeTransfers || [];

    const solOut = nativeTransfers
      .filter((t: any) => t.fromUserAccount === walletAddress)
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) / 1e9;
    const solIn = nativeTransfers
      .filter((t: any) => t.toUserAccount === walletAddress)
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0) / 1e9;

    const isBuy = solOut > solIn;
    const solAmount = Math.abs(isBuy ? solOut - solIn : solIn - solOut);

    if (solAmount < 0.0001) continue;

    const nonSolTransfer = tokenTransfers.find((t: any) => t.mint !== WSOL);
    const tokenMint = nonSolTransfer?.mint || parsed.token || "unknown";
    const tokenAmount = nonSolTransfer?.tokenAmount || parsed.amount || 0;

    swapRows.push({
      wallet_address: walletAddress,
      token_mint: tokenMint,
      token_name: null,
      token_ticker: null,
      trade_type: isBuy ? "buy" : "sell",
      amount_sol: Number(solAmount.toFixed(6)),
      amount_tokens: tokenAmount,
      price_sol: null,
      price_usd: null,
      tx_hash: parsed.signature,
      chain: "solana",
      created_at: new Date(parsed.timestamp).toISOString(),
    });
  }

  if (swapRows.length === 0) return;

  const { error } = await sb
    .from("alpha_trades")
    .upsert(swapRows, { onConflict: "tx_hash", ignoreDuplicates: true });

  if (error) {
    console.warn("[syncSwapsToAlphaTracker] upsert error:", error.message);
  } else {
    console.log(`[syncSwapsToAlphaTracker] ✅ Synced ${swapRows.length} swaps to alpha_trades`);
  }
}
