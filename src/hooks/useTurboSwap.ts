/**
 * Turbo Swap Hook — Server-Side Execution for Maximum Speed
 * 
 * Replaces useFastSwap with a single edge function call.
 * No client-side tx building, no client-side signing.
 * All execution happens server-side for ~3x speed improvement.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  const executeTurboSwap = useCallback(async (
    token: Token,
    amount: number,
    isBuy: boolean,
    slippageBps: number = 500,
  ): Promise<TurboSwapResult> => {
    if (!user?.privyId && !profileId && !solanaAddress) {
      throw new Error('Not authenticated');
    }

    setIsLoading(true);
    const t0 = performance.now();

    try {
      const { data, error } = await supabase.functions.invoke('turbo-trade', {
        body: {
          privyUserId: user?.privyId || undefined,
          profileId: profileId || undefined,
          walletAddress: solanaAddress || undefined,
          mintAddress: token.mint_address,
          amount,
          isBuy,
          slippageBps,
          tokenStatus: token.status,
        },
      });

      if (error) {
        throw new Error(error.message || 'Turbo trade failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Turbo trade failed');
      }

      const clientLatency = Math.round(performance.now() - t0);
      setLastLatencyMs(clientLatency);
      
      console.log(`[TurboSwap] ⚡ Client roundtrip: ${clientLatency}ms | Server: ${data.totalMs}ms | sig: ${data.signature?.slice(0, 12)}...`);

      // Background query invalidation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['launchpad-token', token.mint_address] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
        queryClient.invalidateQueries({ queryKey: ['user-holdings', solanaAddress] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });
      }, 500);

      return {
        success: true,
        signature: data.signature,
        outputAmount: data.outputAmount,
        totalMs: data.totalMs,
        timings: data.timings,
      };
    } catch (err) {
      console.error('[TurboSwap] Error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user?.privyId, profileId, solanaAddress, queryClient]);

  return {
    executeTurboSwap,
    isLoading,
    walletAddress: solanaAddress,
    lastLatencyMs,
  };
}
