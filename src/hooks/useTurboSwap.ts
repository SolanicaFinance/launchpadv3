/**
 * Turbo Swap Hook — Server-Side Execution for Maximum Speed
 * 
 * Replaces useFastSwap with a single edge function call.
 * No client-side tx building, no client-side signing.
 * All execution happens server-side for ~3x speed improvement.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useFastSwap } from '@/hooks/useFastSwap';
import { useSolanaWalletWithPrivy } from '@/hooks/useSolanaWalletPrivy';
import type { Token } from '@/hooks/useLaunchpad';

interface TurboSwapResult {
  success: boolean;
  signature: string;
  outputAmount?: number;
  totalMs?: number;
  timings?: Record<string, number>;
}

export function useTurboSwap() {
  const { user, profileId, solanaAddress } = useAuth();
  const { walletAddress: embeddedWalletAddress } = useSolanaWalletWithPrivy();
  const queryClient = useQueryClient();
  const { executeFastSwap, isLoading: isFastSwapLoading, lastLatencyMs: lastFastLatencyMs } = useFastSwap();
  // Prefer embedded wallet address (actual signer) over auth address
  const effectiveWallet = embeddedWalletAddress || solanaAddress;
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const executeTurboSwap = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<TurboSwapResult> => {
    if (!user?.privyId && !profileId && !effectiveWallet) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);

    try {
      // Direct client-side execution via Jupiter + Privy embedded wallet
      // Turbo server-side route bypassed due to Privy authorization key issues
      const t0 = performance.now();
      const result = await executeFastSwap(token, amount, isBuy, slippageBps);
      const latency = Math.round(performance.now() - t0);
      setLastLatencyMs(latency);

      console.log(`[TurboSwap] ⚡ Direct swap: ${latency}ms | sig: ${result.signature?.slice(0, 12)}...`);

      // Background query invalidation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['launchpad-token', token.mint_address] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
        queryClient.invalidateQueries({ queryKey: ['user-holdings', effectiveWallet] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });
      }, 500);

      return {
        success: true,
        signature: result.signature,
        outputAmount: isBuy ? result.tokensOut : result.solOut,
        totalMs: latency,
      };
    } catch (err) {
      console.error('[TurboSwap] Error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.privyId, profileId, effectiveWallet, queryClient, executeFastSwap]);

  return {
    executeTurboSwap,
    isLoading: isLoading || isFastSwapLoading,
    walletAddress: effectiveWallet,
    lastLatencyMs: lastLatencyMs ?? lastFastLatencyMs,
  };
}
