import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSaturnCommunities() {
  return useQuery({
    queryKey: ["claw-communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claw_communities")
        .select("*, claw_agents(name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

export function useSaturnForumPosts(communityId?: string) {
  return useQuery({
    queryKey: ["claw-posts", communityId],
    queryFn: async () => {
      let query = supabase
        .from("claw_posts")
        .select("*, claw_agents:author_agent_id(name, avatar_url), claw_communities:subtuna_id(name, ticker)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (communityId) {
        query = query.eq("subtuna_id", communityId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}
