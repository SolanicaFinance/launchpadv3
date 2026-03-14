import { useState, useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_API = 'https://api.jup.ag/swap/v1';

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: any[];
}

interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
}

const JUPITER_API_KEY = (import.meta as any).env?.VITE_JUPITER_API_KEY || '';

function buildQuoteUrl(params: URLSearchParams): string {
  const base = `${JUPITER_API}/quote?${params}`;
  return JUPITER_API_KEY ? `${base}&api-key=${JUPITER_API_KEY}` : base;
}

export function useJupiterSwap() {
  const [isLoading, setIsLoading] = useState(false);

  const getQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    inputDecimals: number = 9,
    slippageBps: number = 500,
  ): Promise<QuoteResponse | null> => {
    try {
      const amountLamports = Math.floor(amount * (10 ** inputDecimals));
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountLamports.toString(),
        slippageBps: slippageBps.toString(),
      });

      // Try with API key first
      let res = await fetch(buildQuoteUrl(params));

      // Fallback: retry without API key if 401
      if (res.status === 401 && JUPITER_API_KEY) {
        console.warn('[Jupiter] API key rejected, retrying without key');
        res = await fetch(`${JUPITER_API}/quote?${params}`);
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[Jupiter] Quote error:', res.status, errData);
        throw new Error(`Jupiter quote failed (${res.status})`);
      }
      return await res.json();
    } catch (error) {
      console.error('Jupiter quote error:', error);
      return null;
    }
  }, []);

  const executeSwap = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    userWallet: string,
    inputDecimals: number = 9,
    slippageBps: number = 500,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>,
  ): Promise<SwapResult> => {
    setIsLoading(true);

    try {
      const quote = await getQuote(inputMint, outputMint, amount, inputDecimals, slippageBps);
      if (!quote) {
        throw new Error('Failed to get swap quote');
      }

      const swapUrl = JUPITER_API_KEY
        ? `${JUPITER_API}/swap?api-key=${JUPITER_API_KEY}`
        : `${JUPITER_API}/swap`;

      const res = await fetch(swapUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userWallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[Jupiter] Swap error:', res.status, errData);
        throw new Error(`Jupiter swap failed (${res.status})`);
      }

      const swapData = await res.json();
      const { swapTransaction } = swapData;

      const txBytes = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);
      const { signature } = await signAndSendTx(transaction);

      const inputAmount = parseInt(quote.inAmount, 10) / (10 ** inputDecimals);
      const outputAmount = parseInt(quote.outAmount, 10) / (10 ** 9);
      const priceImpact = parseFloat(quote.priceImpactPct);

      return {
        success: true,
        signature,
        inputAmount,
        outputAmount,
        priceImpact,
      };
    } catch (error) {
      console.error('Jupiter swap error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getQuote]);

  const buyToken = useCallback(async (
    tokenMint: string,
    solAmount: number,
    userWallet: string,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>,
    slippageBps: number = 500,
  ): Promise<SwapResult> => {
    return executeSwap(SOL_MINT, tokenMint, solAmount, userWallet, 9, slippageBps, signAndSendTx);
  }, [executeSwap]);

  const sellToken = useCallback(async (
    tokenMint: string,
    tokenAmount: number,
    tokenDecimals: number,
    userWallet: string,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>,
    slippageBps: number = 500,
  ): Promise<SwapResult> => {
    return executeSwap(tokenMint, SOL_MINT, tokenAmount, userWallet, tokenDecimals, slippageBps, signAndSendTx);
  }, [executeSwap]);

  const getBuyQuote = useCallback(async (
    tokenMint: string,
    solAmount: number,
    slippageBps: number = 500,
  ) => {
    return getQuote(SOL_MINT, tokenMint, solAmount, 9, slippageBps);
  }, [getQuote]);

  const getSellQuote = useCallback(async (
    tokenMint: string,
    tokenAmount: number,
    tokenDecimals: number = 9,
    slippageBps: number = 500,
  ) => {
    return getQuote(tokenMint, SOL_MINT, tokenAmount, tokenDecimals, slippageBps);
  }, [getQuote]);

  return {
    isLoading,
    getQuote,
    getBuyQuote,
    getSellQuote,
    executeSwap,
    buyToken,
    sellToken,
  };
}
