import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseSubTunaMembershipOptions {
  subtunaId?: string;
  userId?: string;
}

export function useSaturnMembership({ subtunaId, userId }: UseSubTunaMembershipOptions) {
  const queryClient = useQueryClient();

  // Check if user is a member
  const membershipQuery = useQuery({
    queryKey: ["subtuna-membership", subtunaId, userId],
    queryFn: async () => {
      if (!subtunaId || !userId) return null;

      const { data, error } = await supabase
        .from("subtuna_members")
        .select("id, is_moderator, joined_at")
        .eq("subtuna_id", subtunaId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!subtunaId && !!userId,
  });

  // Join community
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!subtunaId || !userId) throw new Error("Missing subtunaId or userId");

      const { error } = await supabase.from("subtuna_members").insert({
        subtuna_id: subtunaId,
        user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-membership", subtunaId, userId] });
      queryClient.invalidateQueries({ queryKey: ["subtuna", subtunaId] });
    },
  });

  // Leave community
  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!subtunaId || !userId) throw new Error("Missing subtunaId or userId");

      const { error } = await supabase
        .from("subtuna_members")
        .delete()
        .eq("subtuna_id", subtunaId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtuna-membership", subtunaId, userId] });
      queryClient.invalidateQueries({ queryKey: ["subtuna", subtunaId] });
    },
  });

  return {
    isMember: !!membershipQuery.data,
    isModerator: membershipQuery.data?.is_moderator || false,
    isLoading: membershipQuery.isLoading,
    join: joinMutation.mutate,
    leave: leaveMutation.mutate,
    isJoining: joinMutation.isPending,
    isLeaving: leaveMutation.isPending,
  };
}
