import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchSparklines(addresses: string[]): Promise<Record<string, number[]>> {
  if (addresses.length === 0) return {};

  const { data, error } = await supabase.functions.invoke("codex-sparklines", {
    body: { addresses },
  });

  if (error) {
    console.error("Sparkline fetch error:", error);
    return {};
  }

  return data?.sparklines ?? {};
}

export function useSparklineBatch(addresses: string[]) {
  // Deduplicate and filter empty
  const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
  const key = uniqueAddresses.sort().join(",");

  return useQuery({
    queryKey: ["sparklines-batch", key],
    queryFn: () => fetchSparklines(uniqueAddresses),
    enabled: uniqueAddresses.length > 0,
    refetchInterval: 1500,
    staleTime: 1000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });
}
