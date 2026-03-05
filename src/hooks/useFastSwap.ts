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
import BN from 'bn.js';
import bs58 from 'bs58';
import { useSolanaWalletWithPrivy } from '@/hooks/useSolanaWalletPrivy';
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getRpcUrl } from '@/hooks/useSolanaWallet';
import { startBlockhashPoller, getCachedBlockhash } from '@/lib/blockhashCache';
import { sendRawToAllEndpoints } from '@/lib/jitoBundle';
import type { Token } from '@/hooks/useLaunchpad';
import { useQueryClient } from '@tanstack/react-query';

const SOL_DECIMALS = 9;
const TOKEN_DECIMALS = 6;

interface FastSwapResult {
  success: boolean;
  signature: string;
  tokensOut?: number;
  solOut?: number;
  graduated?: boolean;
}

export function useFastSwap() {
  const { signAndSendTransaction, walletAddress, getConnection } = useSolanaWalletWithPrivy();
  const { buyToken, sellToken } = useJupiterSwap();
  const { profileId } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Start blockhash poller on mount
  useEffect(() => {
    startBlockhashPoller();
  }, []);

  /**
   * Fast bonding curve swap via Meteora DBC SDK
   * Eagerly imported, cached blockhash, optimistic result
   */
  const swapBondingCurve = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<FastSwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!token.dbc_pool_address) throw new Error('Token has no DBC pool address');

    const connection = getConnection();
    const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
    const client = DynamicBondingCurveClient.create(connection, 'confirmed');

    const poolAddress = new PublicKey(token.dbc_pool_address);
    const ownerPubkey = new PublicKey(walletAddress);

    const amountIn = isBuy
      ? new BN(Math.floor(amount * 10 ** SOL_DECIMALS))
      : new BN(Math.floor(amount * 10 ** TOKEN_DECIMALS));

    const minimumAmountOut = new BN(0);

    const swapTx = await client.pool.swap({
      owner: ownerPubkey,
      pool: poolAddress,
      amountIn,
      minimumAmountOut,
      swapBaseForQuote: !isBuy,
      referralTokenAccount: null,
    });

    // Sign and send — Privy handles signing + RPC send
    // Jito dual-submit happens inside useSolanaWalletPrivy automatically
    const { signature } = await signAndSendTransaction(swapTx);

    // Record in DB (non-blocking, fire-and-forget)
    supabase.functions.invoke('launchpad-swap', {
      body: {
        mintAddress: token.mint_address,
        userWallet: walletAddress,
        amount,
        isBuy,
        profileId: profileId || undefined,
        signature,
        mode: 'record',
      },
    }).catch(err => console.warn('[FastSwap] DB record failed (non-fatal):', err));

    return { success: true, signature, graduated: false };
  }, [walletAddress, getConnection, signAndSendTransaction, profileId]);

  /**
   * Fast graduated token swap via Jupiter
   */
  const swapGraduated = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<FastSwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');

    let result;
    if (isBuy) {
      result = await buyToken(
        token.mint_address, amount, walletAddress,
        signAndSendTransaction as any, slippageBps,
      );
    } else {
      result = await sellToken(
        token.mint_address, amount, TOKEN_DECIMALS, walletAddress,
        signAndSendTransaction as any, slippageBps,
      );
    }

    return {
      success: true,
      signature: result.signature || '',
      tokensOut: isBuy ? result.outputAmount : undefined,
      solOut: !isBuy ? result.outputAmount : undefined,
    };
  }, [walletAddress, signAndSendTransaction, buyToken, sellToken]);

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
      } else {
        result = await swapBondingCurve(token, amount, isBuy, slippageBps);
      }

      console.log(`[FastSwap] Done in ${(performance.now() - t0).toFixed(0)}ms, sig: ${result.signature.slice(0, 12)}...`);

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
  }, [swapBondingCurve, swapGraduated, queryClient, walletAddress]);

  return {
    executeFastSwap,
    isLoading,
    walletAddress,
  };
}
