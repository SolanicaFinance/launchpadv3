import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { getRpcUrl } from '@/hooks/useSolanaWallet';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_QUOTE_API = 'https://api.jup.ag/swap/v1';

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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get a quote for swapping tokens
  const getQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    inputDecimals: number = 9,
    slippageBps: number = 500
  ): Promise<QuoteResponse | null> => {
    try {
      const amountLamports = Math.floor(amount * (10 ** inputDecimals));
      
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountLamports.toString(),
        slippageBps: slippageBps.toString(),
      });

      const headers: Record<string, string> = {};
      const jupApiKey = (import.meta as any).env?.VITE_JUPITER_API_KEY;
      if (jupApiKey) headers['x-api-key'] = jupApiKey;

      const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get quote');
      }

      return await response.json();
    } catch (error) {
      console.error('Jupiter quote error:', error);
      return null;
    }
  }, []);

  // Execute swap via Jupiter using signAndSendTransaction (Privy compatible)
  const executeSwap = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    userWallet: string,
    inputDecimals: number = 9,
    slippageBps: number = 500,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>
  ): Promise<SwapResult> => {
    setIsLoading(true);
    
    try {
      // Step 1: Get quote
      const quote = await getQuote(inputMint, outputMint, amount, inputDecimals, slippageBps);
      
      if (!quote) {
        throw new Error('Failed to get swap quote');
      }

      // Step 2: Get swap transaction
      const swapHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const jupKey = (import.meta as any).env?.VITE_JUPITER_API_KEY;
      if (jupKey) swapHeaders['x-api-key'] = jupKey;

      const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
        method: 'POST',
        headers: swapHeaders,
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: userWallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!swapResponse.ok) {
        const error = await swapResponse.json();
        throw new Error(error.error || 'Failed to create swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      // Step 3: Deserialize transaction
      const txBytes = Uint8Array.from(atob(swapTransaction), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);

      // Step 4: Sign and send via Privy embedded wallet
      const { signature } = await signAndSendTx(transaction);

      const inputAmount = parseInt(quote.inAmount) / (10 ** inputDecimals);
      const outputAmount = parseInt(quote.outAmount) / (10 ** 9);
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

  // Helper: Buy token with SOL
  const buyToken = useCallback(async (
    tokenMint: string,
    solAmount: number,
    userWallet: string,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>,
    slippageBps: number = 500
  ): Promise<SwapResult> => {
    return executeSwap(SOL_MINT, tokenMint, solAmount, userWallet, 9, slippageBps, signAndSendTx);
  }, [executeSwap]);

  // Helper: Sell token for SOL
  const sellToken = useCallback(async (
    tokenMint: string,
    tokenAmount: number,
    tokenDecimals: number,
    userWallet: string,
    signAndSendTx: (tx: VersionedTransaction) => Promise<{ signature: string; confirmed: boolean }>,
    slippageBps: number = 500
  ): Promise<SwapResult> => {
    return executeSwap(tokenMint, SOL_MINT, tokenAmount, userWallet, tokenDecimals, slippageBps, signAndSendTx);
  }, [executeSwap]);

  // Get buy quote (SOL -> Token)
  const getBuyQuote = useCallback(async (
    tokenMint: string,
    solAmount: number,
    slippageBps: number = 500
  ) => {
    return getQuote(SOL_MINT, tokenMint, solAmount, 9, slippageBps);
  }, [getQuote]);

  // Get sell quote (Token -> SOL)
  const getSellQuote = useCallback(async (
    tokenMint: string,
    tokenAmount: number,
    tokenDecimals: number = 9,
    slippageBps: number = 500
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
