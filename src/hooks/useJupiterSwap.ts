import { useState, useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_PRO_API = 'https://api.jup.ag/swap/v1';
const JUPITER_LITE_API = 'https://lite-api.jup.ag/swap/v1';

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

interface JupiterEndpoint {
  baseUrl: string;
  includeApiKey: boolean;
  name: 'pro' | 'lite';
}

async function parseJupiterError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string') return data.error;
    if (typeof data?.message === 'string') return data.message;
    return JSON.stringify(data);
  } catch {
    const text = await response.text();
    return text || response.statusText || 'Unknown Jupiter error';
  }
}

function buildJupiterEndpoints(hasApiKey: boolean): JupiterEndpoint[] {
  if (hasApiKey) {
    return [
      { baseUrl: JUPITER_PRO_API, includeApiKey: true, name: 'pro' },
      { baseUrl: JUPITER_LITE_API, includeApiKey: false, name: 'lite' },
    ];
  }

  return [{ baseUrl: JUPITER_LITE_API, includeApiKey: false, name: 'lite' }];
}

async function requestJupiterWithFallback(
  path: string,
  init: RequestInit,
  jupApiKey?: string,
): Promise<Response> {
  const endpoints = buildJupiterEndpoints(Boolean(jupApiKey));
  let lastErrorMessage = 'Jupiter request failed';

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    const headers = new Headers(init.headers ?? {});

    if (endpoint.includeApiKey && jupApiKey) {
      headers.set('x-api-key', jupApiKey);
    }

    const response = await fetch(`${endpoint.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.ok) {
      if (i > 0) {
        console.warn(`[Jupiter] Recovered via ${endpoint.name} endpoint fallback.`);
      }
      return response;
    }

    const endpointError = await parseJupiterError(response);
    lastErrorMessage = `[${endpoint.name}] ${endpointError} (${response.status})`;

    if (i < endpoints.length - 1) {
      console.warn(`[Jupiter] ${endpoint.name} request failed (${response.status}), trying fallback...`);
    }
  }

  throw new Error(lastErrorMessage);
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

      const jupApiKey = (import.meta as any).env?.VITE_JUPITER_API_KEY;
      const response = await requestJupiterWithFallback(`/quote?${params}`, { method: 'GET' }, jupApiKey);

      return await response.json();
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

      const jupApiKey = (import.meta as any).env?.VITE_JUPITER_API_KEY;
      const swapResponse = await requestJupiterWithFallback(
        '/swap',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: quote,
            userPublicKey: userWallet,
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          }),
        },
        jupApiKey,
      );

      const { swapTransaction } = await swapResponse.json();

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
