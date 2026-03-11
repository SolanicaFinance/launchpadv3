import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/config/branding";

interface SubTuna {
  id: string;
  name: string;
  description?: string;
  bannerUrl?: string;
  iconUrl?: string;
  memberCount: number;
  postCount: number;
  rules?: Record<string, any>;
  settings?: Record<string, any>;
  createdAt: string;
  styleSourceUsername?: string;
  agent?: {
    id: string;
    name: string;
    karma: number;
    styleSourceUsername?: string;
    styleSourceTwitterUrl?: string;
  };
  funToken?: {
    id: string;
    ticker: string;
    name: string;
    imageUrl?: string;
    marketCapSol?: number;
    priceSol?: number;
    priceChange24h?: number;
    mintAddress?: string;
    launchpadType?: string;
    holderCount?: number;
    bondingProgress?: number;
    totalFeesEarned?: number;
    totalFeesClaimed?: number;
    status?: string;
    dbcPoolAddress?: string;
  };
  tradingAgent?: {
    id: string;
    walletAddress: string;
    tradingCapitalSol: number;
  };
}

export function useSaturnCommunity(ticker?: string) {
  return useQuery({
    queryKey: ["subtuna", ticker],
    queryFn: async (): Promise<SubTuna | null> => {
      if (!ticker) return null;

      // First try to find the fun_token by ticker (get most recent if duplicates)
      const { data: funTokens, error: tokenError } = await supabase
        .from("fun_tokens")
        .select("id, ticker, name, image_url, market_cap_sol, price_sol, price_change_24h, mint_address, launchpad_type, created_at, holder_count, bonding_progress, total_fees_earned, total_fees_claimed, status, dbc_pool_address")
        .ilike("ticker", ticker)
        .order("created_at", { ascending: false })
        .limit(1);

      const funToken = funTokens?.[0] || null;

      // If no token found, try to find a system SubTuna directly by ticker (e.g., t/TUNA)
      if (tokenError || !funToken) {
        const { data: directSubtuna, error: directError } = await supabase
          .from("subtuna")
          .select(`
            *,
            agent:agent_id (
              id,
              name,
              karma,
              style_source_username,
              style_source_twitter_url
            )
          `)
          .ilike("ticker", ticker)
          .maybeSingle();

        if (directError || !directSubtuna) return null;

        // Check if this is the CLAW system community - inject token info
        const isClawSubtuna = ticker?.toUpperCase() === "CLAW";

        // Return system SubTuna with TUNA token info if applicable
        return {
          id: directSubtuna.id,
          name: directSubtuna.name,
          description: directSubtuna.description,
          bannerUrl: directSubtuna.banner_url,
          iconUrl: directSubtuna.icon_url,
          memberCount: directSubtuna.member_count || 0,
          postCount: directSubtuna.post_count || 0,
          rules: directSubtuna.rules as Record<string, any> | undefined,
          settings: directSubtuna.settings as Record<string, any> | undefined,
          createdAt: directSubtuna.created_at,
          styleSourceUsername: directSubtuna.style_source_username || directSubtuna.agent?.style_source_username,
          agent: directSubtuna.agent ? {
            id: directSubtuna.agent.id,
            name: directSubtuna.agent.name,
            karma: directSubtuna.agent.karma || 0,
            styleSourceUsername: directSubtuna.agent.style_source_username,
            styleSourceTwitterUrl: directSubtuna.agent.style_source_twitter_url,
          } : undefined,
          // Inject TUNA token info for the platform token SubTuna
          funToken: isClawSubtuna ? {
            id: "claw-platform-token",
            ticker: "CLAW",
            name: "CLAW",
            imageUrl: BRAND.logoPath,
            mintAddress: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
            // Price/market cap fetched separately via useSaturnTokenData
            marketCapSol: undefined,
            priceSol: undefined,
            priceChange24h: undefined,
          } : undefined,
        };
      }

      // Then get the subtuna via token
      const { data: subtuna, error } = await supabase
        .from("subtuna")
        .select(`
          *,
          agent:agent_id (
            id,
            name,
            karma,
            style_source_username,
            style_source_twitter_url,
            trading_agent:trading_agent_id (
              id,
              wallet_address,
              trading_capital_sol
            )
          )
        `)
        .eq("fun_token_id", funToken.id)
        .single();

      if (error || !subtuna) {
        // No real SubTuna community exists - return null
        // This makes SubTunaPage show "Community Not Found" 
        // and directs users to the trade page instead
        return null;
      }

      // Get trading agent data if available
      const tradingAgentData = subtuna.agent?.trading_agent;

      return {
        id: subtuna.id,
        name: subtuna.name,
        description: subtuna.description,
        bannerUrl: subtuna.banner_url,
        iconUrl: subtuna.icon_url,
        memberCount: subtuna.member_count || 0,
        postCount: subtuna.post_count || 0,
        rules: subtuna.rules as Record<string, any> | undefined,
        settings: subtuna.settings as Record<string, any> | undefined,
        createdAt: subtuna.created_at,
        styleSourceUsername: subtuna.style_source_username || subtuna.agent?.style_source_username,
        agent: subtuna.agent ? {
          id: subtuna.agent.id,
          name: subtuna.agent.name,
          karma: subtuna.agent.karma || 0,
          styleSourceUsername: subtuna.agent.style_source_username,
          styleSourceTwitterUrl: subtuna.agent.style_source_twitter_url,
        } : undefined,
        tradingAgent: tradingAgentData ? {
          id: tradingAgentData.id,
          walletAddress: tradingAgentData.wallet_address,
          tradingCapitalSol: tradingAgentData.trading_capital_sol || 0,
        } : undefined,
        funToken: {
          id: funToken.id,
          ticker: funToken.ticker,
          name: funToken.name,
          imageUrl: funToken.image_url,
          marketCapSol: funToken.market_cap_sol,
          priceSol: funToken.price_sol,
          priceChange24h: funToken.price_change_24h,
          mintAddress: funToken.mint_address,
          launchpadType: funToken.launchpad_type,
          holderCount: funToken.holder_count,
          bondingProgress: funToken.bonding_progress,
          totalFeesEarned: funToken.total_fees_earned,
          totalFeesClaimed: funToken.total_fees_claimed,
          status: funToken.status,
          dbcPoolAddress: funToken.dbc_pool_address,
        },
      };
    },
    enabled: !!ticker,
  });
}

export function useRecentCommunities(limit = 10) {
  return useQuery({
    queryKey: ["recent-subtunas-v5", limit],
    queryFn: async () => {
      // Step 1: Fetch all subtunas (we'll sort by activity later)
      const { data: subtunas, error } = await supabase
        .from("subtuna")
        .select("id, name, ticker, description, icon_url, member_count, post_count, fun_token_id")
        .limit(100);

      if (error) throw error;
      if (!subtunas || subtunas.length === 0) return [];

      // Step 2: Fetch token details for those with fun_token_id
      const tokenIds = [...new Set(subtunas.map(s => s.fun_token_id).filter(Boolean))];
      let tokenMap = new Map<string, { ticker: string; market_cap_sol: number; image_url: string }>();
      
      if (tokenIds.length > 0) {
        const { data: tokens } = await supabase
          .from("fun_tokens")
          .select("id, ticker, market_cap_sol, image_url")
          .in("id", tokenIds);
        tokenMap = new Map((tokens || []).map(t => [t.id, t]));
      }

      // Step 3: Get real post AND comment counts per community
      const subtunaIds = subtunas.map(s => s.id);
      const postCountMap = new Map<string, number>();
      const commentCountMap = new Map<string, number>();
      
      const countPromises = subtunaIds.map(async (id) => {
        const { data: posts, count } = await supabase
          .from("subtuna_posts")
          .select("comment_count", { count: "exact" })
          .eq("subtuna_id", id);
        postCountMap.set(id, count || 0);
        const totalComments = (posts || []).reduce((sum: number, p: any) => sum + (p.comment_count || 0), 0);
        commentCountMap.set(id, totalComments);
      });
      await Promise.all(countPromises);

      // Step 4: Transform and sort by total activity (posts + comments) descending
      const results = subtunas.map((s: any) => {
        const token = s.fun_token_id ? tokenMap.get(s.fun_token_id) : null;
        let ticker = s.ticker || token?.ticker || "";
        if (!ticker && s.name?.startsWith("t/")) {
          ticker = s.name.slice(2);
        }
        const posts = postCountMap.get(s.id) || 0;
        const comments = commentCountMap.get(s.id) || 0;
        return {
          id: s.id,
          name: s.name,
          ticker,
          description: s.description,
          iconUrl: s.icon_url || token?.image_url,
          memberCount: s.member_count || 0,
          postCount: posts + comments,
          marketCapSol: token?.market_cap_sol,
        };
      });

      // Sort by activity descending and take top N
      return results
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, limit);
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
}
