import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateReportInput {
  contentType: "post" | "comment";
  contentId: string;
  reporterId: string;
  reason: string;
}

export function useCreateSaturnReport() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateReportInput) => {
      const { data, error } = await supabase
        .from("subtuna_reports")
        .insert({
          content_type: input.contentType,
          content_id: input.contentId,
          reporter_id: input.reporterId,
          reason: input.reason,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-reports"] });
    },
  });

  return {
    createReport: mutation.mutateAsync,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}

export function useSaturnAdminReports() {
  const queryClient = useQueryClient();

  // Fetch all pending reports (admin only)
  const reportsQuery = useQuery({
    queryKey: ["subtuna-reports", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtuna_reports")
        .select(`
          *,
          reporter:reporter_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Resolve a report
  const resolveMutation = useMutation({
    mutationFn: async ({
      reportId,
      status,
      notes,
    }: {
      reportId: string;
      status: "reviewed" | "dismissed" | "actioned";
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_resolve_report", {
        _report_id: reportId,
        _status: status,
        _notes: notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-reports"] });
    },
  });

  // Delete post as admin
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_post", {
        _post_id: postId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
      queryClient.invalidateQueries({ queryKey: ["subtuna-reports"] });
    },
  });

  // Delete comment as admin
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_comment", {
        _comment_id: commentId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-comments"] });
      queryClient.invalidateQueries({ queryKey: ["subtuna-reports"] });
    },
  });

  // Toggle pin on post
  const togglePinMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc("admin_toggle_pin_post", {
        _post_id: postId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  // Toggle lock on post
  const toggleLockMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc("admin_toggle_lock_post", {
        _post_id: postId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-posts"] });
    },
  });

  return {
    reports: reportsQuery.data || [],
    isLoading: reportsQuery.isLoading,
    resolveReport: resolveMutation.mutate,
    isResolving: resolveMutation.isPending,
    deletePost: deletePostMutation.mutate,
    isDeletingPost: deletePostMutation.isPending,
    deleteComment: deleteCommentMutation.mutate,
    isDeletingComment: deleteCommentMutation.isPending,
    togglePin: togglePinMutation.mutate,
    isTogglingPin: togglePinMutation.isPending,
    toggleLock: toggleLockMutation.mutate,
    isTogglingLock: toggleLockMutation.isPending,
  };
}
