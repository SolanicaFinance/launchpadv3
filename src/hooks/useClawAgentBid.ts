import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

export const MIN_BID_SOL = 5;
export const BID_INCREMENT_SOL = 0.5;

export function useSaturnAgentBid(tradingAgentId?: string) {
  const [isPlacingBid, setIsPlacingBid] = useState(false);

  const { data: bidStatus, refetch } = useQuery({
    queryKey: ["claw-agent-bid", tradingAgentId],
    queryFn: async () => {
      if (!tradingAgentId) return null;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-agent-bid?tradingAgentId=${tradingAgentId}`,
        {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch bid status");
      return response.json();
    },
    enabled: !!tradingAgentId,
    refetchInterval: 15000,
  });

  const placeBid = useCallback(async (params: {
    tradingAgentId: string;
    bidderWallet: string;
    bidAmountSol: number;
    txSignature: string;
  }) => {
    setIsPlacingBid(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-agent-bid`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bid failed");
      refetch();
      return data;
    } finally {
      setIsPlacingBid(false);
    }
  }, [refetch]);

  return { bidStatus, isPlacingBid, placeBid, refetch };
}
