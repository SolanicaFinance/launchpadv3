import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KolTweet {
  id: string;
  kol_account_id: string;
  tweet_id: string;
  tweet_text: string | null;
  tweet_url: string | null;
  contract_address: string;
  chain: string;
  kol_username: string;
  kol_profile_image: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_image_url: string | null;
  token_price_usd: number | null;
  token_market_cap: number | null;
  tweeted_at: string;
  created_at: string;
}

export function useKolTweets(chain: "all" | "solana" | "evm" = "all") {
  return useQuery<KolTweet[]>({
    queryKey: ["kol-tweets", chain],
    queryFn: async () => {
      let query = supabase
        .from("kol_contract_tweets")
        .select("*")
        .order("tweeted_at", { ascending: false })
        .limit(100);

      if (chain !== "all") {
        query = query.eq("chain", chain);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as KolTweet[]) || [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
