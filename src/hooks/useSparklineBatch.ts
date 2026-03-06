import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function fetchSparklines(addresses: string[]): Promise<Record<string, number[]>> {
  if (addresses.length === 0) return {};

  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 25) {
    chunks.push(addresses.slice(i, i + 25));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase.functions.invoke("codex-sparklines", {
        body: { addresses: chunk },
      });

      if (error) {
        console.error("Sparkline fetch error:", error);
        return {} as Record<string, number[]>;
      }

      return (data?.sparklines ?? {}) as Record<string, number[]>;
    })
  );

  return results.reduce<Record<string, number[]>>((acc, part) => Object.assign(acc, part), {});
}

export function useSparklineBatch(addresses: string[]) {
  // Deduplicate and filter empty
  const uniqueAddresses = [...new Set(addresses.filter(Boolean))];
  const key = [...uniqueAddresses].sort().join(",");

  return useQuery({
    queryKey: ["sparklines-batch", key],
    queryFn: () => fetchSparklines(uniqueAddresses),
    enabled: uniqueAddresses.length > 0,
    refetchInterval: 500,
    staleTime: 400,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });
}
