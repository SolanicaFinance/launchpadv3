import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedData, setCachedData } from "@/lib/fetchWithTimeout";

export type SortOption = "hot" | "new" | "top" | "rising" | "discussed";

interface UseSubTunaPostsOptions {
  subtunaId?: string;
  ticker?: string;
  sort?: SortOption;
  limit?: number;
}

// Smaller default limit to reduce DB load
const DEFAULT_LIMIT = 20;
// Time window for global feed (7 days)
const GLOBAL_FEED_DAYS = 7;

export function useSaturnPosts({
  subtunaId,
  ticker,
  sort = "new",
  limit = DEFAULT_LIMIT,
}: UseSubTunaPostsOptions = {}) {
  const queryClient = useQueryClient();
  const cacheKey = `posts_${subtunaId || "global"}_${sort}_${limit}`;

  const postsQuery = useQuery({
    queryKey: ["subtuna-posts", subtunaId, ticker, sort, limit],
    queryFn: async () => {
      // Phase B: Split query to avoid heavy joins
      // Step 1: Fetch posts only (no joins)
      let postsQuery = supabase
        .from("subtuna_posts")
        .select(`
          id,
          title,
          content,
          image_url,
          post_type,
          upvotes,
          downvotes,
          guest_upvotes,
          guest_downvotes,
          comment_count,
          is_pinned,
          is_agent_post,
          created_at,
          slug,
          subtuna_id,
          author_id,
          author_agent_id
        `)
        .limit(limit);

      // Filter by subtuna if provided
      if (subtunaId) {
        postsQuery = postsQuery.eq("subtuna_id", subtunaId);
      } else {
        // Global feed: only last N days to avoid huge scans
        const cutoffDate = new Date(Date.now() - GLOBAL_FEED_DAYS * 24 * 60 * 60 * 1000).toISOString();
        postsQuery = postsQuery.gte("created_at", cutoffDate);
      }

      // Apply sorting
      switch (sort) {
        case "new":
          postsQuery = postsQuery.order("created_at", { ascending: false });
          break;
        case "top":
          postsQuery = postsQuery
            .order("guest_upvotes", { ascending: false })
            .order("upvotes", { ascending: false })
            .order("created_at", { ascending: false });
          break;
        case "rising":
          postsQuery = postsQuery
            .order("guest_upvotes", { ascending: false })
            .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
          break;
        case "discussed":
          postsQuery = postsQuery
            .order("comment_count", { ascending: false })
            .order("created_at", { ascending: false });
          break;
        case "hot":
        default:
          if (subtunaId) {
            postsQuery = postsQuery
              .order("is_pinned", { ascending: false })
              .order("guest_upvotes", { ascending: false })
              .order("created_at", { ascending: false });
          } else {
            postsQuery = postsQuery
              .order("guest_upvotes", { ascending: false })
              .order("created_at", { ascending: false });
          }
          break;
      }

      // Execute query - need to await it directly, not wrap in withTimeout
      const { data: posts, error: postsError } = await postsQuery;

      if (postsError) throw postsError;
      if (!posts || posts.length === 0) return [];

      // Step 2: Collect unique IDs for batch fetching
      const subtunaIds = [...new Set(posts.map(p => p.subtuna_id).filter(Boolean))] as string[];
      const authorIds = [...new Set(posts.map(p => p.author_id).filter(Boolean))] as string[];
      const agentIds = [...new Set(posts.map(p => p.author_agent_id).filter(Boolean))] as string[];

      // Step 3: Batch fetch related data in parallel
      const [subtunaRes, authorRes, agentRes] = await Promise.all([
        subtunaIds.length > 0
          ? supabase
              .from("subtuna")
              .select("id, name, ticker, icon_url, fun_token_id")
              .in("id", subtunaIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        authorIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, username, avatar_url")
              .in("id", authorIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        agentIds.length > 0
          ? supabase
              .from("agents")
              .select("id, name, avatar_url, twitter_handle")
              .in("id", agentIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      // Build lookup maps
      const subtunaMap = new Map((subtunaRes.data || []).map((s: any) => [s.id, s]));
      const authorMap = new Map((authorRes.data || []).map((a: any) => [a.id, a]));
      const agentMap = new Map((agentRes.data || []).map((a: any) => [a.id, a]));

      // Step 4: If we have subtuna fun_token_ids, fetch token images + twitter attribution
      const tokenIds = [...new Set(
        (subtunaRes.data || [])
          .map((s: any) => s.fun_token_id)
          .filter(Boolean)
      )];

      // Also collect token IDs from agent_tokens for avatar fallback
      let agentTokenMap = new Map<string, string>();
      if (agentIds.length > 0) {
        const { data: agentTokens } = await supabase
          .from("agent_tokens")
          .select("agent_id, fun_token_id")
          .in("agent_id", agentIds)
          .order("created_at", { ascending: true });
        if (agentTokens) {
          for (const at of agentTokens) {
            if (!agentTokenMap.has(at.agent_id)) {
              agentTokenMap.set(at.agent_id, at.fun_token_id);
              if (!tokenIds.includes(at.fun_token_id)) tokenIds.push(at.fun_token_id);
            }
          }
        }
      }

      let tokenMap = new Map<string, any>();
      if (tokenIds.length > 0) {
        const { data: tokens } = await supabase
          .from("fun_tokens")
          .select("id, ticker, image_url, twitter_url, twitter_avatar_url, twitter_verified, twitter_verified_type")
          .in("id", tokenIds);
        tokenMap = new Map((tokens || []).map(t => [t.id, t]));
      }

      // Transform posts with joined data
      const result = posts.map((post: any) => {
        const subtuna = subtunaMap.get(post.subtuna_id);
        const author = authorMap.get(post.author_id);
        const agent = agentMap.get(post.author_agent_id);
        const funToken = subtuna?.fun_token_id ? tokenMap.get(subtuna.fun_token_id) : null;

        // Get agent avatar: agent.avatar_url > first token image > null
        let agentAvatarUrl: string | null = null;
        let launcherTwitter: { handle: string; avatarUrl?: string; verified?: boolean; verifiedType?: string | null } | undefined;

        if (agent) {
          agentAvatarUrl = agent.avatar_url || null;
          // Fallback to first launched token image
          if (!agentAvatarUrl) {
            const firstTokenId = agentTokenMap.get(agent.id);
            if (firstTokenId) {
              const firstToken = tokenMap.get(firstTokenId);
              agentAvatarUrl = firstToken?.image_url || null;
            }
          }
          // Get twitter attribution from the community's token
          if (funToken) {
            const twitterUrl = funToken.twitter_url;
            // Extract handle from twitter URL
            let handle = '';
            if (twitterUrl) {
              const match = twitterUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
              handle = match?.[1] || '';
            }
            if (handle) {
              launcherTwitter = {
                handle,
                avatarUrl: funToken.twitter_avatar_url || undefined,
                verified: funToken.twitter_verified || false,
                verifiedType: funToken.twitter_verified_type || null,
              };
            }
          }
        }

        const totalUpvotes = (post.upvotes || 0) + (post.guest_upvotes || 0);
        const totalDownvotes = (post.downvotes || 0) + (post.guest_downvotes || 0);

        return {
          id: post.id,
          title: post.title,
          content: post.content,
          imageUrl: post.image_url,
          postType: post.post_type,
          upvotes: totalUpvotes,
          downvotes: totalDownvotes,
          commentCount: post.comment_count,
          isPinned: post.is_pinned,
          isAgentPost: post.is_agent_post,
          createdAt: post.created_at,
          slug: post.slug,
          author: author ? {
            id: author.id,
            username: author.username,
            avatarUrl: author.avatar_url,
          } : undefined,
          agent: agent ? {
            id: agent.id,
            name: agent.name,
            avatarUrl: agentAvatarUrl,
          } : undefined,
          launcherTwitter,
          subtuna: {
            name: subtuna?.name || "",
            ticker: subtuna?.ticker || funToken?.ticker || ticker || "",
            iconUrl: subtuna?.icon_url || funToken?.image_url,
          },
        };
      });

      // Cache result for offline/retry
      setCachedData(cacheKey, result);
      return result;
    },
    enabled: true,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1, // Only retry once
    retryDelay: 1000,
    placeholderData: getCachedData<any[]>(cacheKey) ?? undefined,
  });

  // Authenticated user vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({
      postId,
      voteType,
      userId,
    }: {
      postId: string;
      voteType: 1 | -1;
      userId: string;
    }) => {
      // Check if user already voted
      const { data: existingVote } = await supabase
        .from("subtuna_votes")
        .select("*")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await supabase.from("subtuna_votes").delete().eq("id", existingVote.id);
        } else {
          // Change vote
          await supabase
            .from("subtuna_votes")
            .update({ vote_type: voteType })
            .eq("id", existingVote.id);
        }
      } else {
        // Create new vote
        await supabase.from("subtuna_votes").insert({
          post_id: postId,
          user_id: userId,
          vote_type: voteType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  // Guest vote mutation (via edge function)
  const guestVoteMutation = useMutation({
    mutationFn: async ({
      postId,
      voteType,
    }: {
      postId: string;
      voteType: 1 | -1;
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ postId, voteType }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to vote");
      }

      const data = await response.json();
      return { ...data, postId };
    },
    onSuccess: (data) => {
      // Immediately update the cache with the response data for instant UI feedback
      queryClient.setQueryData(
        ["subtuna-posts", subtunaId, ticker, sort, limit],
        (oldData: any[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map((post) => {
            if (post.id === data.postId) {
              return {
                ...post,
                upvotes: data.totalUpvotes,
                downvotes: data.totalDownvotes,
              };
            }
            return post;
          });
        }
      );
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  return {
    posts: postsQuery.data || [],
    isLoading: postsQuery.isLoading,
    error: postsQuery.error,
    vote: voteMutation.mutate,
    isVoting: voteMutation.isPending,
    guestVote: guestVoteMutation.mutate,
    isGuestVoting: guestVoteMutation.isPending,
  };
}
