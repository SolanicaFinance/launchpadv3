import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useCallback } from "react";
import { useMeteoraApi } from "./useMeteoraApi";
import { filterHiddenTokens } from "@/lib/hiddenTokens";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";

export interface Token {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  discord_url: string | null;
  creator_wallet: string;
  creator_id: string | null;
  dbc_pool_address: string | null;
  damm_pool_address: string | null;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number; // Calculated field, defaults to 0
  total_supply: number;
  bonding_curve_progress: number;
  graduation_threshold_sol: number;
  price_sol: number;
  market_cap_sol: number;
  volume_24h_sol: number;
  status: 'bonding' | 'graduated' | 'failed';
  migration_status: string;
  holder_count: number;
  created_at: string;
  updated_at: string;
  graduated_at: string | null;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
    verified_type: string | null;
  } | null;
}

export interface LaunchpadTransaction {
  id: string;
  token_id: string;
  user_wallet: string;
  transaction_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  signature: string;
  created_at: string;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface TokenHolding {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface FeeEarning {
  id: string;
  token_id: string;
  earner_type: string;
  share_bps: number;
  unclaimed_sol: number;
  total_earned_sol: number;
  wallet_address: string | null;
  tokens?: {
    id: string;
    name: string;
    ticker: string;
    image_url: string | null;
    mint_address: string;
    status: string;
    volume_24h_sol: number;
  } | null;
}

export function useLaunchpad() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { executeSwap: executeSwapApi, claimFees: claimFeesApi } = useMeteoraApi();
  const { signAndSendTransaction } = useSolanaWalletWithPrivy();

  // Fetch all tokens
  const {
    data: tokens = [],
    isLoading: isLoadingTokens,
    error: tokensError,
    refetch: refetchTokens,
  } = useQuery({
    queryKey: ['launchpad-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          profiles:creator_id (
            display_name,
            username,
            avatar_url,
            verified_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter out hidden/spam tokens
      return filterHiddenTokens(data as Token[]);
    },
    retry: 2,
  });

  useEffect(() => {
    if (tokensError) {
      toast({
        title: "Couldn't load tokens",
        description: tokensError instanceof Error ? tokensError.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [tokensError, toast]);

  // Subscribe to realtime updates for tokens and transactions
  useEffect(() => {
    const tokenChannel = supabase
      .channel('tokens-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
          if (payload.new && 'mint_address' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['launchpad-token', payload.new.mint_address] });
          }
        }
      )
      .subscribe();

    const txChannel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'launchpad_transactions' },
        (payload) => {
          if (payload.new && 'token_id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['launchpad-transactions', payload.new.token_id] });
          }
        }
      )
      .subscribe();

    const holdersChannel = supabase
      .channel('holders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'token_holdings' },
        (payload) => {
          if (payload.new && 'token_id' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['launchpad-holders', payload.new.token_id] });
          }
          if (payload.new && 'wallet_address' in payload.new) {
            queryClient.invalidateQueries({ queryKey: ['user-holdings', payload.new.wallet_address] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tokenChannel);
      supabase.removeChannel(txChannel);
      supabase.removeChannel(holdersChannel);
    };
  }, [queryClient]);

  // Fetch single token by mint address
  const useToken = (mintAddress: string) => {
    return useQuery({
      queryKey: ['launchpad-token', mintAddress],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tokens')
          .select(`
            *,
            profiles:creator_id (
              display_name,
              username,
              avatar_url,
              verified_type
            )
          `)
          .eq('mint_address', mintAddress)
          .single();

        if (error) throw error;
        return data as Token;
      },
      enabled: !!mintAddress,
    });
  };

  // Fetch token transactions
  const useTokenTransactions = (tokenId: string) => {
    return useQuery({
      queryKey: ['launchpad-transactions', tokenId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('launchpad_transactions')
          .select(`
            *,
            profiles:user_profile_id (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('token_id', tokenId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return data as LaunchpadTransaction[];
      },
      enabled: !!tokenId,
    });
  };

  // Fetch token holders
  const useTokenHolders = (tokenId: string) => {
    return useQuery({
      queryKey: ['launchpad-holders', tokenId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('token_holdings')
          .select(`
            *,
            profiles:profile_id (
              display_name,
              username,
              avatar_url
            )
          `)
          .eq('token_id', tokenId)
          .gt('balance', 0)
          .order('balance', { ascending: false })
          .limit(100);

        if (error) throw error;
        return data as TokenHolding[];
      },
      enabled: !!tokenId,
    });
  };

  // Fetch user's tokens (created by them) — merges tokens + fun_tokens tables
  const useUserTokens = (walletAddress: string | undefined) => {
    return useQuery({
      queryKey: ['user-tokens', walletAddress],
      queryFn: async () => {
        if (!walletAddress) return [];
        
        const [tokensResult, funTokensResult] = await Promise.all([
          supabase
            .from('tokens')
            .select('*')
            .eq('creator_wallet', walletAddress)
            .order('created_at', { ascending: false }),
          supabase
            .from('fun_tokens')
            .select('*')
            .eq('creator_wallet', walletAddress)
            .order('created_at', { ascending: false }),
        ]);

        if (tokensResult.error) throw tokensResult.error;

        const normalTokens = (tokensResult.data || []) as Token[];
        
        // Normalize fun_tokens to Token shape, excluding any already in tokens table
        const tokenMints = new Set(normalTokens.map(t => t.mint_address));
        const funMapped = (funTokensResult.data || [])
          .filter((ft: any) => ft.mint_address && !tokenMints.has(ft.mint_address))
          .map((ft: any) => ({
            id: ft.id,
            mint_address: ft.mint_address || '',
            name: ft.name,
            ticker: ft.ticker,
            description: ft.description,
            image_url: ft.image_url,
            website_url: ft.website_url,
            twitter_url: ft.twitter_url,
            telegram_url: ft.telegram_url,
            discord_url: ft.discord_url,
            creator_wallet: ft.creator_wallet,
            creator_id: null,
            dbc_pool_address: ft.dbc_pool_address,
            damm_pool_address: null,
            virtual_sol_reserves: 30,
            virtual_token_reserves: 1_000_000_000,
            real_sol_reserves: 0,
            real_token_reserves: 0,
            total_supply: 1_000_000_000,
            bonding_curve_progress: ft.bonding_progress || 0,
            graduation_threshold_sol: 85,
            price_sol: ft.price_sol || 0,
            market_cap_sol: ft.market_cap_sol || 0,
            volume_24h_sol: ft.volume_24h_sol || 0,
            status: ft.status === 'active' ? 'bonding' : (ft.status || 'bonding'),
            migration_status: 'pending',
            holder_count: ft.holder_count || 0,
            created_at: ft.created_at,
            updated_at: ft.updated_at,
            graduated_at: null,
          } as Token));

        // Merge and sort by created_at descending
        return [...normalTokens, ...funMapped].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      },
      enabled: !!walletAddress,
    });
  };

  // Fetch user's holdings
  const useUserHoldings = (walletAddress: string | undefined) => {
    return useQuery({
      queryKey: ['user-holdings', walletAddress],
      queryFn: async () => {
        if (!walletAddress) return [];
        
        const { data, error } = await supabase
          .from('token_holdings')
          .select(`
            *,
            tokens (
              id,
              mint_address,
              name,
              ticker,
              image_url,
              price_sol,
              status,
              dbc_pool_address,
              virtual_sol_reserves,
              virtual_token_reserves,
              real_sol_reserves,
              real_token_reserves,
              total_supply,
              graduation_threshold_sol,
              market_cap_sol,
              volume_24h_sol,
              holder_count,
              bonding_curve_progress
            )
          `)
          .eq('wallet_address', walletAddress)
          .gt('balance', 0)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!walletAddress,
    });
  };

  // Execute swap via launchpad-swap edge function (bonding curve trades)
  const executeSwap = useMutation({
    mutationFn: async ({
      mintAddress,
      userWallet,
      amount,
      isBuy,
      slippageBps = 500,
      profileId,
    }: {
      mintAddress: string;
      userWallet: string;
      amount: number;
      isBuy: boolean;
      slippageBps?: number;
      profileId?: string;
    }) => {
      console.log('[useLaunchpad] executeSwap called:', { mintAddress, userWallet, amount, isBuy, slippageBps });

      // Call launchpad-swap edge function directly
      const { data, error } = await supabase.functions.invoke('launchpad-swap', {
        body: { mintAddress, userWallet, amount, isBuy, profileId },
      });

      if (error) {
        console.error('[useLaunchpad] Edge function error:', error);
        throw new Error(error.message || 'Swap failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Swap failed');
      }

      console.log('[useLaunchpad] Swap result:', { tokensOut: data.tokensOut, solOut: data.solOut, newPrice: data.newPrice });

      return {
        success: true,
        tokensOut: data.tokensOut || 0,
        solOut: data.solOut || 0,
        newPrice: data.newPrice,
        bondingProgress: data.bondingProgress,
        graduated: data.graduated,
        marketCap: data.marketCap,
        signature: data.signature,
        transaction: null,
      };
    },
    onSuccess: (data, variables) => {
      console.log('[useLaunchpad] Swap success, invalidating queries. Signature:', data.signature);
      queryClient.invalidateQueries({ queryKey: ['launchpad-token', variables.mintAddress] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-holdings', variables.userWallet] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['launchpad-holders'] });
    },
  });

  // Claim fees using Vercel API
  const claimFees = useMutation({
    mutationFn: async ({
      tokenId,
      walletAddress,
      profileId,
    }: {
      tokenId: string;
      walletAddress: string;
      profileId?: string;
    }) => {
      const result = await claimFeesApi({
        tokenId,
        walletAddress,
        profileId,
      });

      if (!result.success) {
        throw new Error('Claim failed');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-earnings'] });
    },
  });

  // Fetch user earnings
  const useUserEarnings = (walletAddress: string | undefined, profileId: string | undefined) => {
    return useQuery({
      queryKey: ['user-earnings', walletAddress, profileId],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (walletAddress) params.set('wallet', walletAddress);
        if (profileId) params.set('profileId', profileId);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/launchpad-earnings?${params.toString()}`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const body = await response.text();
          console.warn('[useUserEarnings] Error:', response.status, body);
          // Return empty data instead of throwing for non-critical errors
          return { earnings: [], claims: [], summary: { totalEarned: 0, totalUnclaimed: 0, tokensWithEarnings: 0 } };
        }

        return response.json();
      },
      enabled: !!(walletAddress || profileId),
    });
  };

  return {
    tokens,
    isLoadingTokens,
    tokensError,
    refetchTokens,
    useToken,
    useTokenTransactions,
    useTokenHolders,
    useUserTokens,
    useUserHoldings,
    useUserEarnings,
    executeSwap,
    claimFees,
  };
}

// Bonding curve calculations
export function calculateBuyQuote(
  solIn: number,
  virtualSol: number,
  virtualToken: number
): { tokensOut: number; newPrice: number; priceImpact: number } {
  const k = virtualSol * virtualToken;
  const newVirtualSol = virtualSol + solIn;
  const newVirtualToken = k / newVirtualSol;
  const tokensOut = virtualToken - newVirtualToken;
  
  const oldPrice = virtualSol / virtualToken;
  const newPrice = newVirtualSol / newVirtualToken;
  const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;

  return { tokensOut, newPrice, priceImpact };
}

export function calculateSellQuote(
  tokensIn: number,
  virtualSol: number,
  virtualToken: number
): { solOut: number; newPrice: number; priceImpact: number } {
  const k = virtualSol * virtualToken;
  const newVirtualToken = virtualToken + tokensIn;
  const newVirtualSol = k / newVirtualToken;
  const solOut = virtualSol - newVirtualSol;
  
  const oldPrice = virtualSol / virtualToken;
  const newPrice = newVirtualSol / newVirtualToken;
  const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;

  return { solOut, newPrice, priceImpact };
}

export function formatTokenAmount(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return amount.toFixed(2);
}

export function formatSolAmount(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount >= 1) return amount.toFixed(4);
  return amount.toFixed(6);
}
