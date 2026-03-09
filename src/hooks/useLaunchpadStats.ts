import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LaunchpadStat {
  type: string;
  total: number;
  active: number;
  lastLaunch: string | null;
}

export function useLaunchpadStats() {
  return useQuery<LaunchpadStat[]>({
    queryKey: ["launchpad-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("launchpad-stats");
      if (error) throw error;
      return data as LaunchpadStat[];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}
