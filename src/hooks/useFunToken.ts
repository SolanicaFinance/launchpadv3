import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FunToken {
  id: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  telegram_url?: string | null;
  discord_url?: string | null;
  creator_wallet: string;
  mint_address: string | null;
  dbc_pool_address: string | null;
  status: string;
  price_sol: number;
  price_change_24h?: number | null;
  volume_24h_sol: number;
  total_fees_earned: number;
  holder_count?: number;
  market_cap_sol?: number;
  bonding_progress?: number;
  trading_fee_bps?: number | null;
  creator_fee_bps?: number | null;
  last_distribution_at: string | null;
  created_at: string;
  updated_at: string;
  // Social launch attribution
  launch_author?: string | null;
  launch_post_url?: string | null;
}

/**
 * Fetch a single fun token by mint address OR dbc_pool_address OR id
 * Also fetches launch attribution from agent_social_posts
 */
export function useFunToken(identifier: string) {
  return useQuery({
    queryKey: ['fun-token', identifier],
    queryFn: async () => {
      // Try to find by mint_address first
      let { data, error } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('mint_address', identifier)
        .maybeSingle();

      // If not found, try by dbc_pool_address
      if (!data && !error) {
        const poolResult = await supabase
          .from('fun_tokens')
          .select('*')
          .eq('dbc_pool_address', identifier)
          .maybeSingle();
        
        data = poolResult.data;
        error = poolResult.error;
      }

      // If still not found, try by id
      if (!data && !error) {
        const idResult = await supabase
          .from('fun_tokens')
          .select('*')
          .eq('id', identifier)
          .maybeSingle();
        
        data = idResult.data;
        error = idResult.error;
      }

      if (error) throw error;
      if (!data) return null;

      // Fetch launch attribution from agent_social_posts
      const { data: socialPost } = await supabase
        .from('agent_social_posts')
        .select('post_author, post_url')
        .eq('fun_token_id', data.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...data,
        launch_author: socialPost?.post_author || null,
        launch_post_url: socialPost?.post_url || null,
      } as FunToken;
    },
    enabled: !!identifier && identifier.length > 0,
  });
}
