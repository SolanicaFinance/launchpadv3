import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS = 1e9;

interface HeliusEnrichedTx {
  signature: string;
  timestamp?: number;
  slot?: number;
  type?: string;
  source?: string;
  description?: string;
  feePayer?: string;
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number }[];
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs?: { mint: string; tokenAmount: number; userAccount: string }[];
      tokenOutputs?: { mint: string; tokenAmount: number; userAccount: string }[];
    };
  };
  accountData?: { account: string; nativeBalanceChange: number }[];
}

/**
 * Find which tracked wallet is involved in this tx.
 */
function findTrackedWallet(tx: HeliusEnrichedTx, tracked: Set<string>): string | null {
  // Check feePayer first (most common signer)
  if (tx.feePayer && tracked.has(tx.feePayer)) return tx.feePayer;

  // Check native transfers
  for (const nt of tx.nativeTransfers || []) {
    if (tracked.has(nt.fromUserAccount)) return nt.fromUserAccount;
    if (tracked.has(nt.toUserAccount)) return nt.toUserAccount;
  }

  // Check token transfers
  for (const tt of tx.tokenTransfers || []) {
    if (tracked.has(tt.fromUserAccount)) return tt.fromUserAccount;
    if (tracked.has(tt.toUserAccount)) return tt.toUserAccount;
  }

  // Check swap event accounts
  const swap = tx.events?.swap;
  if (swap) {
    if (swap.nativeInput?.account && tracked.has(swap.nativeInput.account)) return swap.nativeInput.account;
    if (swap.nativeOutput?.account && tracked.has(swap.nativeOutput.account)) return swap.nativeOutput.account;
    for (const t of swap.tokenInputs || []) { if (tracked.has(t.userAccount)) return t.userAccount; }
    for (const t of swap.tokenOutputs || []) { if (tracked.has(t.userAccount)) return t.userAccount; }
  }

  return null;
}

/**
 * Parse trade from swap event (best data quality).
 */
function parseFromSwapEvent(
  tx: HeliusEnrichedTx,
  walletAddress: string,
) {
  const swap = tx.events?.swap;
  if (!swap) return null;

  const nativeIn = swap.nativeInput ? Number(swap.nativeInput.amount) / LAMPORTS : 0;
  const nativeOut = swap.nativeOutput ? Number(swap.nativeOutput.amount) / LAMPORTS : 0;
  const tokenInputs = (swap.tokenInputs || []).filter((t) => t.mint !== WSOL_MINT);
  const tokenOutputs = (swap.tokenOutputs || []).filter((t) => t.mint !== WSOL_MINT);

  let solAmount = 0, tokenAmount = 0, tokenMint = "", tradeType: "buy" | "sell" = "buy";

  if (nativeIn > 0 && tokenOutputs.length > 0) {
    tradeType = "buy";
    solAmount = nativeIn;
    tokenAmount = tokenOutputs[0].tokenAmount;
    tokenMint = tokenOutputs[0].mint;
  } else if (nativeOut > 0 && tokenInputs.length > 0) {
    tradeType = "sell";
    solAmount = nativeOut;
    tokenAmount = tokenInputs[0].tokenAmount;
    tokenMint = tokenInputs[0].mint;
  } else if (tokenInputs.length > 0 && tokenOutputs.length > 0) {
    tradeType = "buy";
    tokenMint = tokenOutputs[0].mint;
    tokenAmount = tokenOutputs[0].tokenAmount;
  } else {
    return null;
  }

  if (!tokenMint) return null;
  return { solAmount, tokenAmount, tokenMint, tradeType };
}

/**
 * Parse trade from tokenTransfers + nativeTransfers (fallback).
 * Covers Jupiter, Raydium, PumpSwap, etc. where swap event may be missing.
 */
function parseFromTransfers(
  tx: HeliusEnrichedTx,
  walletAddress: string,
) {
  const tokenTransfers = tx.tokenTransfers || [];
  const nativeTransfers = tx.nativeTransfers || [];

  // Find token transfers involving the tracked wallet (exclude WSOL)
  const tokensOut = tokenTransfers.filter(
    (t) => t.fromUserAccount === walletAddress && t.mint !== WSOL_MINT && t.tokenAmount > 0
  );
  const tokensIn = tokenTransfers.filter(
    (t) => t.toUserAccount === walletAddress && t.mint !== WSOL_MINT && t.tokenAmount > 0
  );

  // Calculate net SOL flow for this wallet from native transfers
  let solOut = 0, solIn = 0;
  for (const nt of nativeTransfers) {
    if (nt.fromUserAccount === walletAddress) solOut += nt.amount;
    if (nt.toUserAccount === walletAddress) solIn += nt.amount;
  }

  // Also check WSOL transfers
  for (const tt of tokenTransfers) {
    if (tt.mint === WSOL_MINT) {
      if (tt.fromUserAccount === walletAddress) solOut += tt.tokenAmount * LAMPORTS;
      if (tt.toUserAccount === walletAddress) solIn += tt.tokenAmount * LAMPORTS;
    }
  }

  const netSolOut = (solOut - solIn) / LAMPORTS;
  const netSolIn = (solIn - solOut) / LAMPORTS;

  let solAmount = 0, tokenAmount = 0, tokenMint = "", tradeType: "buy" | "sell" = "buy";

  if (tokensIn.length > 0 && netSolOut > 0.0001) {
    // Wallet sent SOL, received tokens → BUY
    tradeType = "buy";
    solAmount = netSolOut;
    tokenAmount = tokensIn[0].tokenAmount;
    tokenMint = tokensIn[0].mint;
  } else if (tokensOut.length > 0 && netSolIn > 0.0001) {
    // Wallet sent tokens, received SOL → SELL
    tradeType = "sell";
    solAmount = netSolIn;
    tokenAmount = tokensOut[0].tokenAmount;
    tokenMint = tokensOut[0].mint;
  } else if (tokensIn.length > 0 && tokensOut.length > 0) {
    // Token-to-token swap
    tradeType = "buy";
    tokenMint = tokensIn[0].mint;
    tokenAmount = tokensIn[0].tokenAmount;
  } else if (tokensIn.length > 0) {
    // Received tokens (maybe via a complex route)
    tradeType = "buy";
    tokenMint = tokensIn[0].mint;
    tokenAmount = tokensIn[0].tokenAmount;
    // Try to get SOL from accountData
    const acct = (tx.accountData || []).find((a) => a.account === walletAddress);
    if (acct && acct.nativeBalanceChange < 0) {
      solAmount = Math.abs(acct.nativeBalanceChange) / LAMPORTS;
    }
  } else if (tokensOut.length > 0) {
    // Sent tokens
    tradeType = "sell";
    tokenMint = tokensOut[0].mint;
    tokenAmount = tokensOut[0].tokenAmount;
    const acct = (tx.accountData || []).find((a) => a.account === walletAddress);
    if (acct && acct.nativeBalanceChange > 0) {
      solAmount = acct.nativeBalanceChange / LAMPORTS;
    }
  } else {
    return null;
  }

  if (!tokenMint) return null;
  return { solAmount, tokenAmount, tokenMint, tradeType };
}

/**
 * Parse a Helius enriched transaction into trade data.
 */
function parseTrade(tx: HeliusEnrichedTx, trackedAddresses: Set<string>) {
  const walletAddress = findTrackedWallet(tx, trackedAddresses);
  if (!walletAddress) return null;

  // Try swap event first, then fall back to raw transfers
  const result = parseFromSwapEvent(tx, walletAddress)
    || parseFromTransfers(tx, walletAddress);

  if (!result) {
    // Log the tx type for debugging missed formats
    console.log(`[Skip] sig=${tx.signature?.slice(0, 12)}… type=${tx.type} source=${tx.source} wallet=${walletAddress.slice(0, 6)}…`);
    return null;
  }

  const pricePerToken = result.tokenAmount > 0 && result.solAmount > 0
    ? result.solAmount / result.tokenAmount
    : 0;

  const txTime = tx.timestamp
    ? new Date(tx.timestamp * 1000).toISOString()
    : new Date().toISOString();

  return {
    signature: tx.signature,
    slot: tx.slot ?? null,
    wallet_address: walletAddress,
    trade_type: result.tradeType,
    token_mint: result.tokenMint,
    sol_amount: result.solAmount,
    token_amount: result.tokenAmount,
    price_per_token: pricePerToken,
    created_at: txTime,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate webhook secret
  const webhookSecret = Deno.env.get("HELIUS_WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.error("Webhook auth failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const body = await req.json();
    const transactions: HeliusEnrichedTx[] = Array.isArray(body) ? body : [body];

    if (transactions.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all tracked wallet addresses for lookup
    const { data: trackedRows } = await supabase
      .from("tracked_wallets")
      .select("id, wallet_address");

    const addrToId = new Map<string, string>();
    const trackedAddresses = new Set<string>();
    for (const row of trackedRows || []) {
      addrToId.set(row.wallet_address, row.id);
      trackedAddresses.add(row.wallet_address);
    }

    // Debug: log what we're matching against
    const txSignatures = transactions.map(t => t.signature?.slice(0, 10)).join(", ");
    const txFeePayers = [...new Set(transactions.map(t => t.feePayer).filter(Boolean))];
    console.log(`[DEBUG] ${transactions.length} txs, feePayers: ${txFeePayers.map(f => f?.slice(0,8)).join(",")}, tracked: ${[...trackedAddresses].map(a => a.slice(0,8)).join(",")}`);

    const inserts: any[] = [];
    const seenSigs = new Set<string>();

    for (const tx of transactions) {
      if (!tx.signature || seenSigs.has(tx.signature)) continue;
      seenSigs.add(tx.signature);

      const trade = parseTrade(tx, trackedAddresses);
      if (!trade) continue;

      inserts.push({
        ...trade,
        tracked_wallet_id: addrToId.get(trade.wallet_address) || null,
      });
    }

    // Enrich with token metadata from Helius DAS
    if (inserts.length > 0) {
      const uniqueMints = [...new Set(inserts.map(i => i.token_mint))];
      try {
        const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
        const heliusRpc = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
        const dasRes = await fetch(heliusRpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0", id: "wh-meta",
            method: "getAssetBatch",
            params: { ids: uniqueMints },
          }),
        });
        const dasData = await dasRes.json();
        const meta: Record<string, { name: string; symbol: string; image: string }> = {};
        for (const asset of dasData?.result || []) {
          if (asset?.id && asset?.content?.metadata) {
            const imageUrl = asset.content?.links?.image
              || (asset.content?.files?.[0]?.uri)
              || null;
            meta[asset.id] = {
              name: asset.content.metadata.name || "",
              symbol: asset.content.metadata.symbol || "",
              image: imageUrl || "",
            };
          }
        }
        for (const ins of inserts) {
          const m = meta[ins.token_mint];
          if (m) {
            ins.token_name = m.name;
            ins.token_ticker = m.symbol;
            if (m.image) ins.token_image_url = m.image;
          }
        }
      } catch (metaErr) {
        console.error("Metadata enrichment failed:", metaErr);
      }
    }

    let insertedCount = 0;
    if (inserts.length > 0) {
      const { error } = await supabase
        .from("wallet_trades")
        .upsert(inserts, { onConflict: "signature", ignoreDuplicates: true });

      if (error) {
        console.error("Insert error:", error.message);
      } else {
        insertedCount = inserts.length;
        console.log(`✅ Inserted ${insertedCount} trade(s): ${inserts.map(i => `${i.trade_type} ${i.sol_amount.toFixed(3)} SOL ${i.token_mint.slice(0,6)}…`).join(", ")}`);
      }
    }

    if (insertedCount === 0 && transactions.length > 0) {
      console.log(`Processed ${transactions.length} txs, 0 matched trades`);
    }

    return new Response(JSON.stringify({ ok: true, inserted: insertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("wallet-trade-webhook error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Return 200 so Helius doesn't retry
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
