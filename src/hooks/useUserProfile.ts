import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  verified_type: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
  solana_wallet_address: string | null;
}

export interface CreatedToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol: number | null;
  status: string | null;
  created_at: string;
}

export interface UserTrade {
  id: string;
  transaction_type: string;
  sol_amount: number;
  token_amount: number;
  price_per_token: number | null;
  created_at: string;
  token_id: string;
  signature: string | null;
}

function isWalletAddress(identifier: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier);
}

export function useUserProfile(identifier: string | undefined) {
  const profileQuery = useQuery({
    queryKey: ["user-profile", identifier],
    queryFn: async () => {
      if (!identifier) throw new Error("No identifier");

      let query = supabase.from("profiles").select("*");

      if (isWalletAddress(identifier)) {
        query = query.eq("solana_wallet_address", identifier);
      } else {
        query = query.eq("username", identifier);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Profile not found");
      return data as UserProfile;
    },
    enabled: !!identifier,
  });

  const wallet = profileQuery.data?.solana_wallet_address;
  const profileId = profileQuery.data?.id;

  const tokensQuery = useQuery({
    queryKey: ["user-profile-tokens", wallet],
    queryFn: async () => {
      if (!wallet) return [];
      const { data, error } = await supabase
        .from("fun_tokens")
        .select("id, name, ticker, image_url, mint_address, market_cap_sol, status, created_at")
        .eq("creator_wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CreatedToken[];
    },
    enabled: !!wallet,
  });

  const tradesQuery = useQuery({
    queryKey: ["user-profile-trades", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("launchpad_transactions")
        .select("id, transaction_type, sol_amount, token_amount, price_per_token, created_at, token_id, signature")
        .eq("user_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as UserTrade[];
    },
    enabled: !!profileId,
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    tokens: tokensQuery.data ?? [],
    tokensLoading: tokensQuery.isLoading,
    trades: tradesQuery.data ?? [],
    tradesLoading: tradesQuery.isLoading,
  };
}
