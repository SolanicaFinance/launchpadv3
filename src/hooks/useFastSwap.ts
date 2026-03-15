/**
 * Ultra-Fast Swap Hook
 * 
 * Optimized for Axiom-level speed:
 * - No pre-flight balance check
 * - Cached blockhash (0ms)
 * - Parallel Jito + Helius submission
 * - Optimistic UI (no confirmation wait)
 * - Eager module imports (no dynamic import)
 */

import { useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import bs58 from 'bs58';
import { useSolanaWalletWithPrivy } from '@/hooks/useSolanaWalletPrivy';
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getRpcUrl } from '@/hooks/useSolanaWallet';
import { startBlockhashPoller, getCachedBlockhash } from '@/lib/blockhashCache';
import { sendRawToAllEndpoints } from '@/lib/jitoBundle';
import { recordAlphaTrade } from '@/lib/recordAlphaTrade';
import type { Token } from '@/hooks/useLaunchpad';
import { useQueryClient } from '@tanstack/react-query';

const SOL_DECIMALS = 9;
const DEFAULT_TOKEN_DECIMALS = 6;

interface FastSwapResult {
  success: boolean;
  signature: string;
  tokensOut?: number;
  solOut?: number;
  graduated?: boolean;
}

// Module-level cached DBC client singleton
let cachedDbcClient: DynamicBondingCurveClient | null = null;
let cachedDbcRpcUrl: string | null = null;

function getOrCreateDbcClient(connection: Connection, rpcUrl: string): DynamicBondingCurveClient {
  if (cachedDbcClient && cachedDbcRpcUrl === rpcUrl) return cachedDbcClient;
  cachedDbcClient = DynamicBondingCurveClient.create(connection, 'confirmed');
  cachedDbcRpcUrl = rpcUrl;
  return cachedDbcClient;
}

export function useFastSwap() {
  const { signAndSendTransaction, walletAddress, getConnection, getTokenBalanceRaw } = useSolanaWalletWithPrivy();
  const { buyToken, sellToken } = useJupiterSwap();
  const { profileId, solanaAddress } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const recordTradeForAlphaTracker = useCallback((
    token: Token,
    amount: number,
    isBuy: boolean,
    signature: string,
    outputAmount?: number,
  ) => {
    const resolvedWallet = walletAddress || solanaAddress;

    if (!signature) return;
    if (!resolvedWallet) {
      console.warn('[FastSwap] Missing wallet for alpha tracker recording; skipping', {
        signature: signature.slice(0, 12),
      });
      return;
    }

    const amountSolForInsert = isBuy ? amount : (outputAmount ?? 0);
    const amountTokensForInsert = isBuy ? (outputAmount ?? 0) : amount;

    // Path 1: direct client upsert (fire-and-forget to avoid swap latency)
    void recordAlphaTrade({
      walletAddress: resolvedWallet,
      tokenMint: token.mint_address,
      tokenName: token.name,
      tokenTicker: token.ticker,
      tradeType: isBuy ? 'buy' : 'sell',
      amountSol: amountSolForInsert,
      amountTokens: amountTokensForInsert,
      txHash: signature,
      chain: 'solana',
    });

    // Path 2: service-role alpha_only fallback (critical for unindexed tokens)
    void supabase.functions.invoke('launchpad-swap', {
      body: {
        mintAddress: token.mint_address,
        userWallet: resolvedWallet,
        amount,
        isBuy,
        profileId: profileId || undefined,
        signature,
        outputAmount: outputAmount ?? null,
        tokenName: token.name,
        tokenTicker: token.ticker,
        mode: 'alpha_only',
      },
    }).then(({ error }) => {
      if (error) {
        console.warn('[FastSwap] alpha_only record failed:', error.message);
      }
    }).catch((err) => {
      console.warn('[FastSwap] alpha_only invoke failed:', err);
    });
  }, [walletAddress, solanaAddress, profileId]);

  // Start blockhash poller on mount
  useEffect(() => {
    startBlockhashPoller();
  }, []);

  /**
   * Fast bonding curve swap via Meteora DBC SDK
   * Uses cached DBC client singleton + step-level timing
   */
  const swapBondingCurve = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
    tokenDecimals?: number,
  ): Promise<FastSwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!token.dbc_pool_address) throw new Error('Token has no DBC pool address');

    const t1 = performance.now();
    const connection = getConnection();
    const rpcUrl = getRpcUrl().url;
    const client = getOrCreateDbcClient(connection, rpcUrl);
    console.log(`[FastSwap] DBC client ready: ${Math.round(performance.now() - t1)}ms`);

    const poolAddress = new PublicKey(token.dbc_pool_address);
    const ownerPubkey = new PublicKey(walletAddress);

    // Resolve decimals dynamically for sells
    let resolvedDecimals = tokenDecimals ?? DEFAULT_TOKEN_DECIMALS;
    if (!isBuy && !tokenDecimals) {
      // Fetch real decimals from on-chain token account
      try {
        const raw = await getTokenBalanceRaw(token.mint_address);
        resolvedDecimals = raw.decimals;
        console.log(`[FastSwap] Resolved token decimals from chain: ${resolvedDecimals}`);
      } catch (e) {
        console.warn('[FastSwap] Failed to resolve decimals, using default:', DEFAULT_TOKEN_DECIMALS);
      }
    }

    const amountIn = isBuy
      ? new BN(Math.floor(amount * 10 ** SOL_DECIMALS))
      : new BN(Math.floor(amount * 10 ** resolvedDecimals));

    const minimumAmountOut = new BN(0);

    // Fetch on-chain pool state
    const t2 = performance.now();
    let virtualSolReserves: number | undefined;
    let virtualTokenReserves: number | undefined;
    let poolInvalid = false;
    try {
      const poolState = await client.state.getPool(poolAddress);
      console.log(`[FastSwap] Pool fetch: ${Math.round(performance.now() - t2)}ms`);
      if (poolState) {
        virtualSolReserves = Number(poolState.quoteReserve) / 10 ** SOL_DECIMALS;
        virtualTokenReserves = Number(poolState.baseReserve) / 10 ** resolvedDecimals;
      }
    } catch (e) {
      console.log(`[FastSwap] Pool fetch failed: ${Math.round(performance.now() - t2)}ms`);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Invalid account discriminator') || msg.includes('Account does not exist')) {
        console.warn('[FastSwap] Pool invalid/closed, falling back to Jupiter:', msg);
        poolInvalid = true;
      } else {
        console.warn('[FastSwap] Failed to fetch pool state, will use DB reserves:', e);
      }
    }

    if (poolInvalid) {
      return swapGraduated(token, amount, isBuy, slippageBps);
    }

    const t3 = performance.now();
    const swapTx = await client.pool.swap({
      owner: ownerPubkey,
      pool: poolAddress,
      amountIn,
      minimumAmountOut,
      swapBaseForQuote: !isBuy,
      referralTokenAccount: null,
    });
    console.log(`[FastSwap] Build tx: ${Math.round(performance.now() - t3)}ms`);

    // Estimate output for PnL display using constant-product formula
    let estimatedSolOut: number | undefined;
    let estimatedTokensOut: number | undefined;
    if (!isBuy && virtualSolReserves && virtualTokenReserves) {
      const amtTokens = amount; // human-readable token count
      estimatedSolOut = (amtTokens * virtualSolReserves) / (virtualTokenReserves + amtTokens);
      console.log(`[FastSwap] Estimated solOut: ${estimatedSolOut}`);
    } else if (isBuy && virtualSolReserves && virtualTokenReserves) {
      estimatedTokensOut = (amount * virtualTokenReserves) / (virtualSolReserves + amount);
    }

    const t4 = performance.now();
    const { signature } = await signAndSendTransaction(swapTx);
    console.log(`[FastSwap] Sign+send: ${Math.round(performance.now() - t4)}ms`);

    // ── Record trade (direct + service-role alpha_only fallback) ──
    recordTradeForAlphaTracker(token, amount, isBuy, signature, isBuy ? estimatedTokensOut : estimatedSolOut);

    // Optional DB record mode (best-effort only for indexed tokens)
    if (token.id) {
      void (async () => {
        try {
          const { error } = await supabase.functions.invoke('launchpad-swap', {
            body: {
              mintAddress: token.mint_address,
              userWallet: walletAddress,
              amount,
              isBuy,
              profileId: profileId || undefined,
              signature,
              mode: 'record',
              onChainVirtualSol: virtualSolReserves,
              onChainVirtualToken: virtualTokenReserves,
            },
          });
          if (error) {
            console.warn('[FastSwap] DB record failed (non-fatal):', error.message);
          }
        } catch (err) {
          console.warn('[FastSwap] DB record invoke failed (non-fatal):', err);
        }
      })();
    }

    return { success: true, signature, graduated: false, solOut: estimatedSolOut, tokensOut: estimatedTokensOut };
  }, [walletAddress, getConnection, signAndSendTransaction, profileId, recordTradeForAlphaTracker, getTokenBalanceRaw]);

  /**
   * Fast graduated token swap via Jupiter
   */
  const swapGraduated = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
    tokenDecimals?: number,
  ): Promise<FastSwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');

    // Resolve decimals dynamically for sells
    let resolvedDecimals = tokenDecimals ?? DEFAULT_TOKEN_DECIMALS;
    if (!isBuy && !tokenDecimals) {
      try {
        const raw = await getTokenBalanceRaw(token.mint_address);
        resolvedDecimals = raw.decimals;
      } catch (e) {
        console.warn('[FastSwap] Failed to resolve decimals for graduated sell:', e);
      }
    }

    let result;
    if (isBuy) {
      result = await buyToken(
        token.mint_address, amount, walletAddress,
        signAndSendTransaction as any, slippageBps,
      );
    } else {
      result = await sellToken(
        token.mint_address, amount, resolvedDecimals, walletAddress,
        signAndSendTransaction as any, slippageBps,
      );
    }

    return {
      success: true,
      signature: result.signature || '',
      tokensOut: isBuy ? result.outputAmount : undefined,
      solOut: !isBuy ? result.outputAmount : undefined,
    };
  }, [walletAddress, signAndSendTransaction, buyToken, sellToken, getTokenBalanceRaw]);

  /**
   * Main fast swap — routes based on token status, optimistic UI
   */
  const executeFastSwap = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<FastSwapResult> => {
    setIsLoading(true);
    const t0 = performance.now();

    try {
      let result: FastSwapResult;

      if (token.status === 'graduated') {
        result = await swapGraduated(token, amount, isBuy, slippageBps);

        recordTradeForAlphaTracker(
          token,
          amount,
          isBuy,
          result.signature,
          isBuy ? result.tokensOut : result.solOut,
        );

        // Optional DB record (best-effort only for indexed tokens)
        if (token.id) {
          void (async () => {
            try {
              const { error } = await supabase.functions.invoke('launchpad-swap', {
                body: {
                  mintAddress: token.mint_address,
                  userWallet: walletAddress,
                  amount,
                  isBuy,
                  profileId: profileId || undefined,
                  signature: result.signature,
                  mode: 'record',
                },
              });
              if (error) {
                console.warn('[FastSwap] DB record for graduated swap failed (non-fatal):', error.message);
              }
            } catch (err) {
              console.warn('[FastSwap] DB record invoke for graduated swap failed (non-fatal):', err);
            }
          })();
        }
      } else {
        result = await swapBondingCurve(token, amount, isBuy, slippageBps);
      }

      const latency = Math.round(performance.now() - t0);
      setLastLatencyMs(latency);
      console.log(`[FastSwap] Done in ${latency}ms, sig: ${result.signature.slice(0, 12)}...`);

      // Invalidate queries in background (non-blocking)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['launchpad-token', token.mint_address] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
        queryClient.invalidateQueries({ queryKey: ['user-holdings', walletAddress] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });
      }, 500);

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [swapBondingCurve, swapGraduated, queryClient, walletAddress, recordTradeForAlphaTracker, profileId]);

  return {
    executeFastSwap,
    isLoading,
    walletAddress,
    lastLatencyMs,
  };
}
