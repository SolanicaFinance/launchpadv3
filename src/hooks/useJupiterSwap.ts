import { useState, useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { supabase } from '@/integrations/supabase/client';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

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

      const { data, error } = await supabase.functions.invoke('jupiter-proxy', {
        body: {
          action: 'quote',
          params: {
            inputMint,
            outputMint,
            amount: amountLamports.toString(),
            slippageBps: slippageBps.toString(),
          },
        },
      });

      if (error) {
        const errorBody = typeof data === 'object' ? data : {};
        const errorCode = errorBody?.error?.errorCode || errorBody?.errorCode || '';
        if (errorCode === 'NO_ROUTES_FOUND') {
          console.warn('[Jupiter] No swap routes found for this token pair — it may only be tradeable on its bonding curve');
          return null;
        }
        console.error('[Jupiter] Proxy quote error:', error, data);
        throw new Error(`Jupiter quote failed via proxy`);
      }

      return data;
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

      const { data: swapData, error } = await supabase.functions.invoke('jupiter-proxy', {
        body: {
          action: 'swap',
          body: {
            quoteResponse: quote,
            userPublicKey: userWallet,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          },
        },
      });

      if (error) {
        console.error('[Jupiter] Proxy swap error:', error);
        throw new Error(`Jupiter swap failed via proxy`);
      }

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
