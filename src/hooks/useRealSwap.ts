import { useState, useCallback } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import BN from 'bn.js';
import { useSolanaWalletWithPrivy } from '@/hooks/useSolanaWalletPrivy';
import { useJupiterSwap } from '@/hooks/useJupiterSwap';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getRpcUrl } from '@/hooks/useSolanaWallet';
import type { Token } from '@/hooks/useLaunchpad';
import { useQueryClient } from '@tanstack/react-query';

const SOL_DECIMALS = 9;
const DEFAULT_TOKEN_DECIMALS = 6;

interface SwapResult {
  success: boolean;
  signature: string;
  tokensOut?: number;
  solOut?: number;
  graduated?: boolean;
}

export function useRealSwap() {
  const { signAndSendTransaction, walletAddress, getConnection, getBalance, getTokenBalanceRaw } = useSolanaWalletWithPrivy();
  const { buyToken, sellToken } = useJupiterSwap();
  const { profileId } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Execute a real on-chain swap for bonding curve tokens via Meteora DBC SDK
   */
  const swapBondingCurve = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
    tokenDecimals?: number,
  ): Promise<SwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');
    if (!token.dbc_pool_address) throw new Error('Token has no DBC pool address');

    const connection = getConnection();

    // Dynamically import the Meteora DBC SDK
    const { DynamicBondingCurveClient } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
    const client = DynamicBondingCurveClient.create(connection, 'confirmed');

    const poolAddress = new PublicKey(token.dbc_pool_address);
    const ownerPubkey = new PublicKey(walletAddress);

    // Resolve decimals dynamically for sells
    let resolvedDecimals = tokenDecimals ?? DEFAULT_TOKEN_DECIMALS;
    if (!isBuy && !tokenDecimals) {
      try {
        const raw = await getTokenBalanceRaw(token.mint_address);
        resolvedDecimals = raw.decimals;
      } catch (e) {
        console.warn('[useRealSwap] Failed to resolve decimals:', e);
      }
    }

    // Convert amount to lamports/smallest unit
    let amountIn: BN;
    if (isBuy) {
      // Buying: amount is in SOL
      amountIn = new BN(Math.floor(amount * 10 ** SOL_DECIMALS));
    } else {
      // Selling: amount is in tokens — use resolved decimals
      amountIn = new BN(Math.floor(amount * 10 ** resolvedDecimals));
    }

    // Calculate minimum amount out with slippage
    // For simplicity, set minimumAmountOut to 0 and rely on slippage protection from the contract
    // In production, you'd want to get a quote first
    const minimumAmountOut = new BN(0);

    console.log('[useRealSwap] Building Meteora DBC swap:', {
      pool: token.dbc_pool_address,
      owner: walletAddress,
      amountIn: amountIn.toString(),
      isBuy,
      swapBaseForQuote: !isBuy, // buy = false (quote→base), sell = true (base→quote)
    });

    // Build the swap transaction
    const swapTx = await client.pool.swap({
      owner: ownerPubkey,
      pool: poolAddress,
      amountIn,
      minimumAmountOut,
      swapBaseForQuote: !isBuy, // buy tokens = quote→base (false), sell tokens = base→quote (true)
      referralTokenAccount: null,
    });

    // Sign and send via Privy embedded wallet
    const { signature } = await signAndSendTransaction(swapTx);

    console.log('[useRealSwap] DBC swap confirmed:', signature);

    // Record the swap in the database via the edge function
    try {
      await supabase.functions.invoke('launchpad-swap', {
        body: {
          mintAddress: token.mint_address,
          userWallet: walletAddress,
          amount,
          isBuy,
          profileId: profileId || undefined,
          signature, // Pass real signature
          mode: 'record', // Tell edge function to just record, not simulate
        },
      });
    } catch (recordErr) {
      console.warn('[useRealSwap] Failed to record swap in DB (non-fatal):', recordErr);
    }

    return {
      success: true,
      signature,
      graduated: false,
    };
  }, [walletAddress, getConnection, signAndSendTransaction, profileId, getTokenBalanceRaw]);

  /**
   * Execute a real on-chain swap for graduated tokens via Jupiter
   */
  const swapGraduated = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
    tokenDecimals?: number,
  ): Promise<SwapResult> => {
    if (!walletAddress) throw new Error('Wallet not connected');

    // Resolve decimals dynamically for sells
    let resolvedDecimals = tokenDecimals ?? DEFAULT_TOKEN_DECIMALS;
    if (!isBuy && !tokenDecimals) {
      try {
        const raw = await getTokenBalanceRaw(token.mint_address);
        resolvedDecimals = raw.decimals;
      } catch (e) {
        console.warn('[useRealSwap] Failed to resolve decimals for graduated sell:', e);
      }
    }

    console.log('[useRealSwap] Jupiter swap:', { mint: token.mint_address, amount, isBuy, decimals: resolvedDecimals });

    let result;
    if (isBuy) {
      result = await buyToken(
        token.mint_address,
        amount,
        walletAddress,
        signAndSendTransaction as any,
        slippageBps,
      );
    } else {
      result = await sellToken(
        token.mint_address,
        amount,
        resolvedDecimals,
        walletAddress,
        signAndSendTransaction as any,
        slippageBps,
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
   * Main swap function - routes to correct implementation based on token status
   */
  const executeRealSwap = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<SwapResult> => {
    setIsLoading(true);
    try {
      let result: SwapResult;

      if (token.status === 'graduated') {
        result = await swapGraduated(token, amount, isBuy, slippageBps);
      } else {
        // bonding curve token
        result = await swapBondingCurve(token, amount, isBuy, slippageBps);
      }

      // Invalidate relevant queries after successful swap
      queryClient.invalidateQueries({ queryKey: ['launchpad-token', token.mint_address] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-holdings', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [swapBondingCurve, swapGraduated, queryClient, walletAddress]);

  return {
    executeRealSwap,
    isLoading,
    getBalance,
    walletAddress,
  };
}
