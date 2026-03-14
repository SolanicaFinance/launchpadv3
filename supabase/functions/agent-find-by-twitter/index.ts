import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  mint: string | null;
  imageUrl: string | null;
  createdAt: string;
  totalFeesEarned: number;      // 80% creator share of all collected fees
  totalFeesClaimed: number;     // What's been paid out via creator_claim
  unclaimedFees: number;        // Difference (what they can withdraw)
  volume24h: number;
  marketCapSol: number;
  priceSol: number;
  holderCount: number;
  poolAddress: string | null;
}

interface ClaimableAgent {
  id: string;
  name: string;
  walletAddress: string;
  avatarUrl: string | null;
  description: string | null;
  launchedAt: string;
  tokensLaunched: number;
  totalFeesEarned: number;
  totalFeesClaimed: number;
  unclaimedFees: number;
  verified: boolean;
  tokens: TokenInfo[];
}

// Unified fee calculation: creator_fee_bps / trading_fee_bps
// Platform always takes 1% (100 bps), creator gets the rest
function getCreatorRatio(creatorFeeBps: number | null, tradingFeeBps: number | null): number {
  const bps = tradingFeeBps || 200;
  const cBps = creatorFeeBps || 0;
  if (bps <= 0) return 0;
  return cBps / bps;
}

/**
 * Find agents and tokens by Twitter username.
 * Computes CORRECT unclaimed fees using:
 *   earned = sum(fun_fee_claims.claimed_sol) * 0.8
 *   paid = sum(fun_distributions where type='creator_claim' & status='completed')
 *   unclaimed = earned - paid
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { twitterUsername } = await req.json();

    if (!twitterUsername || typeof twitterUsername !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "twitterUsername is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize username (remove @ if present, lowercase)
    const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Strategy 1: Find agents by style_source_username (primary path)
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select(`
        id,
        name,
        wallet_address,
        verified_at,
        created_at,
        avatar_url,
        description,
        style_source_username
      `)
      .ilike("style_source_username", normalizedUsername)
      .order("created_at", { ascending: false });

    if (agentsError) {
      console.error("[agent-find-by-twitter] Agents query error:", agentsError);
    }

    // Strategy 2: Find tokens launched via Twitter by post_author
    const { data: socialPosts, error: postsError } = await supabase
      .from("agent_social_posts")
      .select(`
        id,
        post_author,
        fun_token_id,
        wallet_address,
        created_at,
        post_url
      `)
      .ilike("post_author", normalizedUsername)
      .eq("platform", "twitter")
      .eq("status", "completed")
      .not("fun_token_id", "is", null)
      .order("created_at", { ascending: false });

    if (postsError) {
      console.error("[agent-find-by-twitter] Social posts query error:", postsError);
    }

    // Collect all token IDs (from agents and social posts)
    const agentIds = (agents || []).map(a => a.id);
    const socialTokenIds = (socialPosts || [])
      .map(p => p.fun_token_id)
      .filter((id): id is string => id !== null);

    // Get tokens for all found agents
    let agentTokens: any[] = [];
    if (agentIds.length > 0) {
      const { data: tokens } = await supabase
        .from("fun_tokens")
        .select(`
          id, name, ticker, mint_address, image_url, created_at,
          volume_24h_sol, market_cap_sol, price_sol, holder_count, dbc_pool_address, agent_id
        `)
        .in("agent_id", agentIds);
      agentTokens = tokens || [];
    }

    // Get tokens from social posts (may include some not linked to agents)
    let socialTokenDetails: any[] = [];
    if (socialTokenIds.length > 0) {
      const { data: tokens } = await supabase
        .from("fun_tokens")
        .select(`
          id, name, ticker, mint_address, image_url, created_at,
          volume_24h_sol, market_cap_sol, price_sol, holder_count, dbc_pool_address, creator_wallet, agent_id
        `)
        .in("id", socialTokenIds);
      socialTokenDetails = tokens || [];
    }

    // Combine all unique token IDs
    const allTokenIds = [
      ...agentTokens.map(t => t.id),
      ...socialTokenDetails.map(t => t.id)
    ].filter((id, index, arr) => arr.indexOf(id) === index);

    // Fetch fee claims for all tokens (total collected fees)
    const tokenEarnedMap = new Map<string, number>();
    if (allTokenIds.length > 0) {
      const { data: feeClaims } = await supabase
        .from("fun_fee_claims")
        .select("fun_token_id, claimed_sol")
        .in("fun_token_id", allTokenIds);

      for (const claim of feeClaims || []) {
        if (claim.fun_token_id) {
          const current = tokenEarnedMap.get(claim.fun_token_id) || 0;
          tokenEarnedMap.set(claim.fun_token_id, current + (claim.claimed_sol || 0));
        }
      }
    }

    // Fetch completed creator_claim distributions (what's been paid out)
    const tokenPaidMap = new Map<string, number>();
    if (allTokenIds.length > 0) {
      const { data: distributions } = await supabase
        .from("fun_distributions")
        .select("fun_token_id, amount_sol")
        .in("fun_token_id", allTokenIds)
        .eq("distribution_type", "creator_claim")
        .eq("status", "completed");

      for (const dist of distributions || []) {
        if (dist.fun_token_id) {
          const current = tokenPaidMap.get(dist.fun_token_id) || 0;
          tokenPaidMap.set(dist.fun_token_id, current + (dist.amount_sol || 0));
        }
      }
    }

    // Helper to compute token info with correct fee calculations
    const computeTokenInfo = (t: any): TokenInfo => {
      const totalCollected = tokenEarnedMap.get(t.id) || 0;
      const creatorEarned = totalCollected * CREATOR_SHARE;
      const creatorPaid = tokenPaidMap.get(t.id) || 0;
      const unclaimed = Math.max(0, creatorEarned - creatorPaid);

      return {
        id: t.id,
        symbol: t.ticker,
        name: t.name,
        mint: t.mint_address,
        imageUrl: t.image_url,
        createdAt: t.created_at,
        totalFeesEarned: creatorEarned,
        totalFeesClaimed: creatorPaid,
        unclaimedFees: unclaimed,
        volume24h: t.volume_24h_sol || 0,
        marketCapSol: t.market_cap_sol || 0,
        priceSol: t.price_sol || 0,
        holderCount: t.holder_count || 0,
        poolAddress: t.dbc_pool_address,
      };
    };

    // Build agents list with tokens
    const claimableAgents: ClaimableAgent[] = [];
    const processedTokenIds = new Set<string>();

    // Process existing agents (found by style_source_username)
    for (const agent of agents || []) {
      const tokens = agentTokens
        .filter(t => t.agent_id === agent.id)
        .map(computeTokenInfo);

      tokens.forEach(t => processedTokenIds.add(t.id));

      const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
      const totalFeesClaimed = tokens.reduce((sum, t) => sum + t.totalFeesClaimed, 0);
      const unclaimedFees = tokens.reduce((sum, t) => sum + t.unclaimedFees, 0);

      claimableAgents.push({
        id: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address,
        avatarUrl: agent.avatar_url,
        description: agent.description,
        launchedAt: agent.created_at,
        tokensLaunched: tokens.length,
        totalFeesEarned,
        totalFeesClaimed,
        unclaimedFees,
        verified: agent.verified_at !== null,
        tokens,
      });
    }

    // Process tokens from social posts that may not have agents yet
    // Group by wallet OR by username for walletless tokens
    const walletTokensMap = new Map<string, TokenInfo[]>();
    const usernameTokensMap = new Map<string, TokenInfo[]>(); // NEW: For walletless tokens
    
    for (const post of socialPosts || []) {
      const token = socialTokenDetails.find(t => t.id === post.fun_token_id);
      if (!token) continue;

      // Skip if already processed via agent path
      if (processedTokenIds.has(token.id)) continue;

      const wallet = post.wallet_address || token.creator_wallet;
      const tokenInfo = computeTokenInfo(token);
      processedTokenIds.add(token.id);

      if (wallet) {
        // Has wallet - group by wallet
        const existing = walletTokensMap.get(wallet) || [];
        existing.push(tokenInfo);
        walletTokensMap.set(wallet, existing);
      } else {
        // NO wallet - group by Twitter username (walletless launch)
        const username = post.post_author?.toLowerCase();
        if (username === normalizedUsername) {
          const existing = usernameTokensMap.get(username) || [];
          existing.push(tokenInfo);
          usernameTokensMap.set(username, existing);
        }
      }
    }

    // Create pseudo-agents for wallet groups without actual agents
    for (const [wallet, tokens] of walletTokensMap.entries()) {
      const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
      const totalFeesClaimed = tokens.reduce((sum, t) => sum + t.totalFeesClaimed, 0);
      const unclaimedFees = tokens.reduce((sum, t) => sum + t.unclaimedFees, 0);

      claimableAgents.push({
        id: `wallet_${wallet.slice(0, 8)}`,
        name: `@${normalizedUsername}`,
        walletAddress: wallet,
        avatarUrl: tokens[0]?.imageUrl || null,
        description: `Tokens launched via Twitter by @${normalizedUsername}`,
        launchedAt: tokens[0]?.createdAt || new Date().toISOString(),
        tokensLaunched: tokens.length,
        totalFeesEarned,
        totalFeesClaimed,
        unclaimedFees,
        verified: false,
        tokens,
      });
    }

    // NEW: Create pseudo-agents for walletless tokens grouped by username
    for (const [username, tokens] of usernameTokensMap.entries()) {
      const totalFeesEarned = tokens.reduce((sum, t) => sum + t.totalFeesEarned, 0);
      const totalFeesClaimed = tokens.reduce((sum, t) => sum + t.totalFeesClaimed, 0);
      const unclaimedFees = tokens.reduce((sum, t) => sum + t.unclaimedFees, 0);

      claimableAgents.push({
        id: `twitter_${username}`,
        name: `@${username}`,
        walletAddress: `CLAIM_VIA_TWITTER_${username.toUpperCase()}`, // Placeholder - user will provide wallet during claim
        avatarUrl: tokens[0]?.imageUrl || null,
        description: `Walletless tokens launched via Twitter by @${username}. Connect wallet to claim fees.`,
        launchedAt: tokens[0]?.createdAt || new Date().toISOString(),
        tokensLaunched: tokens.length,
        totalFeesEarned,
        totalFeesClaimed,
        unclaimedFees,
        verified: false,
        tokens,
      });
    }

    // Compute summary totals
    const totalTokens = claimableAgents.reduce((sum, a) => sum + a.tokens.length, 0);
    const totalFeesEarned = claimableAgents.reduce((sum, a) => sum + a.totalFeesEarned, 0);
    const totalFeesClaimed = claimableAgents.reduce((sum, a) => sum + a.totalFeesClaimed, 0);
    const totalUnclaimedFees = claimableAgents.reduce((sum, a) => sum + a.unclaimedFees, 0);

    console.log(
      `[agent-find-by-twitter] Found ${claimableAgents.length} agents with ${totalTokens} tokens for @${normalizedUsername}. ` +
      `Earned: ${totalFeesEarned.toFixed(4)} SOL, Paid: ${totalFeesClaimed.toFixed(4)} SOL, Unclaimed: ${totalUnclaimedFees.toFixed(4)} SOL`
    );

    return new Response(
      JSON.stringify({
        success: true,
        twitterUsername: normalizedUsername,
        agents: claimableAgents,
        summary: {
          totalAgents: claimableAgents.length,
          totalTokens,
          totalFeesEarned,
          totalFeesClaimed,
          totalUnclaimedFees,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-find-by-twitter] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
