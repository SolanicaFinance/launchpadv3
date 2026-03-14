/**
 * Client-side direct insert into alpha_trades with retry logic.
 * Exposes blocking and non-blocking helpers.
 */
import { supabase } from "@/integrations/supabase/client";

interface AlphaTradeRecord {
  walletAddress: string;
  tokenMint: string;
  tokenName?: string | null;
  tokenTicker?: string | null;
  tradeType: "buy" | "sell";
  amountSol: number;
  amountTokens?: number;
  priceSol?: number | null;
  txHash: string;
  chain?: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function recordAlphaTrade(trade: AlphaTradeRecord): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await (supabase as any)
        .from("alpha_trades")
        .upsert(
          {
            wallet_address: trade.walletAddress,
            token_mint: trade.tokenMint,
            token_name: trade.tokenName || null,
            token_ticker: trade.tokenTicker || null,
            trade_type: trade.tradeType,
            amount_sol: trade.amountSol,
            amount_tokens: trade.amountTokens || 0,
            price_sol: trade.priceSol || null,
            price_usd: null,
            tx_hash: trade.txHash,
            chain: trade.chain || "solana",
          },
          { onConflict: "tx_hash", ignoreDuplicates: true }
        );

      if (!error) {
        return;
      }

      lastError = error;
      console.warn(`[recordAlphaTrade] attempt ${attempt + 1} failed:`, error.message);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[recordAlphaTrade] attempt ${attempt + 1} exception:`, err);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // Solana fallback via backend recorder (best-effort)
  if ((trade.chain || "solana") === "solana") {
    try {
      const { error } = await supabase.functions.invoke("launchpad-swap", {
        body: {
          mintAddress: trade.tokenMint,
          userWallet: trade.walletAddress,
          amount: trade.tradeType === "buy" ? trade.amountSol : trade.amountTokens || 0,
          isBuy: trade.tradeType === "buy",
          signature: trade.txHash,
          outputAmount: trade.tradeType === "buy" ? trade.amountTokens ?? null : trade.amountSol,
          tokenName: trade.tokenName || null,
          tokenTicker: trade.tokenTicker || null,
          mode: "alpha_only",
        },
      });

      if (!error) return;
      lastError = error;
    } catch (fallbackErr) {
      lastError = fallbackErr;
    }
  }

  console.warn("[recordAlphaTrade] final failure for tx:", trade.txHash, lastError);
}

export function recordAlphaTradeInBackground(trade: AlphaTradeRecord): void {
  void recordAlphaTrade(trade);
}
