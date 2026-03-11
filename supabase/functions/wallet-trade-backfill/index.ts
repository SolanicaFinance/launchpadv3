import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS = 1e9;

interface HeliusEnrichedTx {
  signature: string;
  slot?: number;
  timestamp?: number;
  type?: string;
  source?: string;
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

function parseSwapTrade(tx: HeliusEnrichedTx, walletAddress: string) {
  const swap = tx.events?.swap;
  if (!swap) return null;

  const nativeIn = swap.nativeInput ? Number(swap.nativeInput.amount) / LAMPORTS : 0;
  const nativeOut = swap.nativeOutput ? Number(swap.nativeOutput.amount) / LAMPORTS : 0;
  const tokenInputs = (swap.tokenInputs || []).filter((t) => t.mint !== WSOL_MINT);
  const tokenOutputs = (swap.tokenOutputs || []).filter((t) => t.mint !== WSOL_MINT);

  let solAmount = 0, tokenAmount = 0, tokenMint = "", tradeType: "buy" | "sell" = "buy";

  if (nativeIn > 0 && tokenOutputs.length > 0) {
    tradeType = "buy"; solAmount = nativeIn; tokenAmount = tokenOutputs[0].tokenAmount; tokenMint = tokenOutputs[0].mint;
  } else if (nativeOut > 0 && tokenInputs.length > 0) {
    tradeType = "sell"; solAmount = nativeOut; tokenAmount = tokenInputs[0].tokenAmount; tokenMint = tokenInputs[0].mint;
  } else if (tokenInputs.length > 0 && tokenOutputs.length > 0) {
    tradeType = "buy"; tokenMint = tokenOutputs[0].mint; tokenAmount = tokenOutputs[0].tokenAmount;
  } else return null;

  if (!tokenMint) return null;
  return { solAmount, tokenAmount, tokenMint, tradeType };
}

function parseTransferTrade(tx: HeliusEnrichedTx, walletAddress: string) {
  const tokenTransfers = tx.tokenTransfers || [];
  const nativeTransfers = tx.nativeTransfers || [];

  const tokensOut = tokenTransfers.filter(t => t.fromUserAccount === walletAddress && t.mint !== WSOL_MINT && t.tokenAmount > 0);
  const tokensIn = tokenTransfers.filter(t => t.toUserAccount === walletAddress && t.mint !== WSOL_MINT && t.tokenAmount > 0);

  let solOut = 0, solIn = 0;
  for (const nt of nativeTransfers) {
    if (nt.fromUserAccount === walletAddress) solOut += nt.amount;
    if (nt.toUserAccount === walletAddress) solIn += nt.amount;
  }
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
    tradeType = "buy"; solAmount = netSolOut; tokenAmount = tokensIn[0].tokenAmount; tokenMint = tokensIn[0].mint;
  } else if (tokensOut.length > 0 && netSolIn > 0.0001) {
    tradeType = "sell"; solAmount = netSolIn; tokenAmount = tokensOut[0].tokenAmount; tokenMint = tokensOut[0].mint;
  } else if (tokensIn.length > 0 && tokensOut.length > 0) {
    tradeType = "buy"; tokenMint = tokensIn[0].mint; tokenAmount = tokensIn[0].tokenAmount;
  } else if (tokensIn.length > 0) {
    tradeType = "buy"; tokenMint = tokensIn[0].mint; tokenAmount = tokensIn[0].tokenAmount;
    const acct = (tx.accountData || []).find(a => a.account === walletAddress);
    if (acct && acct.nativeBalanceChange < 0) solAmount = Math.abs(acct.nativeBalanceChange) / LAMPORTS;
  } else if (tokensOut.length > 0) {
    tradeType = "sell"; tokenMint = tokensOut[0].mint; tokenAmount = tokensOut[0].tokenAmount;
    const acct = (tx.accountData || []).find(a => a.account === walletAddress);
    if (acct && acct.nativeBalanceChange > 0) solAmount = acct.nativeBalanceChange / LAMPORTS;
  } else return null;

  if (!tokenMint) return null;
  return { solAmount, tokenAmount, tokenMint, tradeType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: "Missing wallet_address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    if (!heliusApiKey) {
      return new Response(JSON.stringify({ error: "HELIUS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get tracked wallet ID
    const { data: trackedWallet } = await supabase
      .from("tracked_wallets")
      .select("id")
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    // Fetch recent transactions from Helius parsed transaction API
    const url = `https://api.helius.xyz/v0/addresses/${wallet_address}/transactions?api-key=${heliusApiKey}&limit=50&type=SWAP`;
    console.log(`[Backfill] Fetching swaps for ${wallet_address.slice(0, 8)}…`);

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Helius API error: ${res.status} ${errText}`);
      return new Response(JSON.stringify({ error: `Helius API error: ${res.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactions: HeliusEnrichedTx[] = await res.json();
    console.log(`[Backfill] Got ${transactions.length} swap txs for ${wallet_address.slice(0, 8)}…`);

    // Collect unique mints for metadata lookup
    const mintSet = new Set<string>();
    const rawInserts: any[] = [];

    for (const tx of transactions) {
      if (!tx.signature) continue;
      const result = parseSwapTrade(tx, wallet_address) || parseTransferTrade(tx, wallet_address);
      if (!result) continue;

      mintSet.add(result.tokenMint);
      const pricePerToken = result.tokenAmount > 0 && result.solAmount > 0
        ? result.solAmount / result.tokenAmount : 0;

      // Use Helius timestamp (unix seconds) for real tx time
      const txTime = tx.timestamp
        ? new Date(tx.timestamp * 1000).toISOString()
        : new Date().toISOString();

      rawInserts.push({
        signature: tx.signature,
        slot: tx.slot ?? null,
        wallet_address,
        trade_type: result.tradeType,
        token_mint: result.tokenMint,
        sol_amount: result.solAmount,
        token_amount: result.tokenAmount,
        price_per_token: pricePerToken,
        tracked_wallet_id: trackedWallet?.id || null,
        created_at: txTime,
      });
    }

    // Fetch token metadata from Helius DAS for all unique mints
    const mintMeta: Record<string, { name: string; symbol: string; image: string }> = {};
    const mints = [...mintSet];
    if (mints.length > 0) {
      try {
        const heliusRpc = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
        const dasRes = await fetch(heliusRpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "backfill-meta",
            method: "getAssetBatch",
            params: { ids: mints },
          }),
        });
        const dasData = await dasRes.json();
        for (const asset of dasData?.result || []) {
          if (asset?.id && asset?.content?.metadata) {
            const imageUrl = asset.content?.links?.image
              || (asset.content?.files?.[0]?.uri)
              || null;
            mintMeta[asset.id] = {
              name: asset.content.metadata.name || "",
              symbol: asset.content.metadata.symbol || "",
              image: imageUrl || "",
            };
          }
        }
        console.log(`[Backfill] Fetched metadata for ${Object.keys(mintMeta).length}/${mints.length} tokens`);
      } catch (metaErr) {
        console.error("[Backfill] Metadata fetch failed:", metaErr);
      }
    }

    // Enrich inserts with metadata
    const inserts = rawInserts.map(insert => ({
      ...insert,
      token_name: mintMeta[insert.token_mint]?.name || null,
      token_ticker: mintMeta[insert.token_mint]?.symbol || null,
      token_image_url: mintMeta[insert.token_mint]?.image || null,
    }));

    let insertedCount = 0;
    if (inserts.length > 0) {
      const { error } = await supabase
        .from("wallet_trades")
        .upsert(inserts, { onConflict: "signature" });

      if (error) {
        console.error("Backfill insert error:", error.message);
      } else {
        insertedCount = inserts.length;
        console.log(`[Backfill] ✅ Inserted ${insertedCount} trades for ${wallet_address.slice(0, 8)}…`);
      }
    }

    return new Response(JSON.stringify({ ok: true, fetched: transactions.length, inserted: insertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("wallet-trade-backfill error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
