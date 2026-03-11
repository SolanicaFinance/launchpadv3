import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Comment } from "@/components/forum/ForumCommentTree";

interface UseSubTunaCommentsOptions {
  postId: string;
  enabled?: boolean;
}

export function useSaturnComments({ postId, enabled = true }: UseSubTunaCommentsOptions) {
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: ["subtuna-comments", postId],
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from("subtuna_comments")
        .select(`
          id,
          content,
          upvotes,
          downvotes,
          is_agent_comment,
          created_at,
          parent_comment_id,
          author:author_id (
            id,
            username,
            avatar_url
          ),
          agent:author_agent_id (
            id,
            name
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Build nested comment tree
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      // First pass: create all comment objects
      for (const row of data || []) {
        // Type assertions for the nested objects
        const authorData = row.author as { id: string; username: string; avatar_url?: string } | null;
        const agentData = row.agent as { id: string; name: string } | null;

        const comment: Comment = {
          id: row.id,
          content: row.content,
          upvotes: row.upvotes || 0,
          downvotes: row.downvotes || 0,
          isAgentComment: row.is_agent_comment || false,
          createdAt: row.created_at,
          author: authorData ? {
            id: authorData.id,
            username: authorData.username,
            avatarUrl: authorData.avatar_url,
          } : undefined,
          agent: agentData ? {
            id: agentData.id,
            name: agentData.name,
          } : undefined,
          replies: [],
        };
        commentMap.set(row.id, comment);
      }

      // Second pass: build tree structure
      for (const row of data || []) {
        const comment = commentMap.get(row.id)!;
        if (row.parent_comment_id && commentMap.has(row.parent_comment_id)) {
          const parent = commentMap.get(row.parent_comment_id)!;
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      }

      return rootComments;
    },
    enabled: enabled && !!postId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({
      content,
      parentCommentId,
      userId,
    }: {
      content: string;
      parentCommentId?: string;
      userId: string;
    }) => {
      console.log("[useSaturnComments] Adding comment:", { postId, userId, content: content.slice(0, 50) });
      
      const { data, error } = await supabase
        .from("subtuna_comments")
        .insert({
          post_id: postId,
          author_id: userId,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();

      if (error) {
        console.error("[useSaturnComments] Error adding comment:", error);
        throw error;
      }

      console.log("[useSaturnComments] Comment added successfully:", data.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
      queryClient.invalidateQueries({ queryKey: ["subtuna-post", postId] });
    },
    onError: (error: any) => {
      console.error("[useSaturnComments] Mutation error:", error);
    },
  });

  const voteCommentMutation = useMutation({
    mutationFn: async ({
      commentId,
      voteType,
      userId,
    }: {
      commentId: string;
      voteType: 1 | -1;
      userId: string;
    }) => {
      // Check existing vote
      const { data: existingVote } = await supabase
        .from("subtuna_comment_votes")
        .select("*")
        .eq("comment_id", commentId)
        .eq("user_id", userId)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote
          await supabase
            .from("subtuna_comment_votes")
            .delete()
            .eq("id", existingVote.id);
        } else {
          // Change vote
          await supabase
            .from("subtuna_comment_votes")
            .update({ vote_type: voteType })
            .eq("id", existingVote.id);
        }
      } else {
        // Create new vote
        await supabase.from("subtuna_comment_votes").insert({
          comment_id: commentId,
          user_id: userId,
          vote_type: voteType,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-comments", postId] });
    },
  });

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    addComment: addCommentMutation.mutate,
    isAddingComment: addCommentMutation.isPending,
    voteComment: voteCommentMutation.mutate,
    isVotingComment: voteCommentMutation.isPending,
  };
}
