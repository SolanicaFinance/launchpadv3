import { useQuery } from "@tanstack/react-query";
import { TokenTradeEvent } from "./useCodexTokenEvents";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface RawEvent {
  timestamp: number;
  eventType: string;
  eventDisplayType: string;
  maker: string;
  transactionHash: string | null;
  data: {
    amount0?: string;
    amount1?: string;
    priceUsd?: string;
    priceUsdTotal?: string;
    type?: string;
  } | null;
}

function normalizeEvents(events: RawEvent[]): TokenTradeEvent[] {
  return events
    .filter((e) => e.data && (e.eventDisplayType === "Buy" || e.eventDisplayType === "Sell"))
    .map((e) => ({
      timestamp: e.timestamp,
      type: e.eventDisplayType as "Buy" | "Sell",
      maker: e.maker || "",
      tokenAmount: Math.abs(parseFloat(e.data!.amount1 || e.data!.amount0 || "0")),
      totalUsd: parseFloat(e.data!.priceUsdTotal || "0"),
      priceUsd: parseFloat(e.data!.priceUsd || "0"),
      txHash: e.transactionHash || "",
    }));
}

async function fetchAllTokenTrades(tokenAddress: string): Promise<TokenTradeEvent[]> {
  const url = `${SUPABASE_URL}/functions/v1/codex-token-events`;
  const allEvents: TokenTradeEvent[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  const MAX_PAGES = 100; // up to 10,000 trades

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ tokenAddress, cursor, limit: 100 }),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch token trades page ${page + 1}`);
    }

    const data = await res.json();
    const events = normalizeEvents(data?.events || []);

    for (const event of events) {
      const key = `${event.txHash}-${event.maker}-${event.timestamp}-${event.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        allEvents.push(event);
      }
    }

    cursor = data?.cursor || null;
    if (!cursor || events.length === 0) break;
  }

  return allEvents;
}

export function useAllTokenTrades(tokenAddress: string, enabled: boolean) {
  return useQuery({
    queryKey: ["all-token-trades", tokenAddress],
    queryFn: () => fetchAllTokenTrades(tokenAddress),
    enabled: !!tokenAddress && enabled,
    staleTime: 30_000,
    refetchInterval: false,
  });
}
