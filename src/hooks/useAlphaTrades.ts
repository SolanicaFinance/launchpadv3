import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computePositions, PositionSummary } from "@/lib/tradeUtils";

export type { PositionSummary } from "@/lib/tradeUtils";

export interface AlphaTrade {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;
  amount_sol: number;
  amount_tokens: number;
  price_usd: number | null;
  price_sol: number | null;
  tx_hash: string;
  created_at: string;
  trader_display_name: string | null;
  trader_avatar_url: string | null;
  chain?: string | null;
  token_image_url?: string | null;
  token_image_fallbacks?: string[];
}

// Persistent cross-render cache so polling doesn't re-fetch known mints
const imageCache = new Map<string, { primary: string; fallbacks: string[] }>();

function buildFallbacks(mint: string, chain?: string | null): string[] {
  const c = chain === "bnb" ? "bsc" : "solana";
  const fallbacks: string[] = [];
  fallbacks.push(`https://dd.dexscreener.com/ds-data/tokens/${c}/${mint}.png`);
  if (c === "bsc") {
    fallbacks.push(`https://tokens.1inch.io/${mint.toLowerCase()}.png`);
    fallbacks.push(`https://tokens.pancakeswap.finance/images/${mint}.png`);
  }
  fallbacks.push(`https://api.dicebear.com/7.x/identicon/svg?seed=${mint}&size=32`);
  return fallbacks;
}

export function useAlphaTrades(limit = 50) {
  const [trades, setTrades] = useState<AlphaTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenImages, setTokenImages] = useState<Map<string, string>>(new Map());
  const [metadataImages, setMetadataImages] = useState<Map<string, string>>(new Map());
  const pendingMetadata = useRef<Set<string>>(new Set());

  const fetchTrades = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("alpha_trades")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[useAlphaTrades] Query failed:", error.message);
      setLoading(false);
      return;
    }
    if (data) {
      const tradesData = data as AlphaTrade[];
      setTrades(tradesData);

      const mints = [...new Set(tradesData.map((t) => t.token_mint).filter(Boolean))];
      if (mints.length > 0) {
        const imgMap = new Map<string, string>();

        // Check tokens table
        const { data: tokensData } = await supabase
          .from("tokens")
          .select("mint_address, image_url")
          .in("mint_address", mints);
        if (tokensData) {
          for (const t of tokensData) {
            if (t.image_url) imgMap.set(t.mint_address, t.image_url);
          }
        }

        // Check fun_tokens table
        const unresolvedMints = mints.filter((m) => !imgMap.has(m));
        if (unresolvedMints.length > 0) {
          const { data: funData } = await supabase
            .from("fun_tokens")
            .select("mint_address, image_url")
            .in("mint_address", unresolvedMints);
          if (funData) {
            for (const t of funData) {
              if (t.mint_address && t.image_url) imgMap.set(t.mint_address, t.image_url);
            }
          }
        }

        // Check claw_tokens table
        const stillUnresolved = mints.filter((m) => !imgMap.has(m));
        if (stillUnresolved.length > 0) {
          const { data: clawData } = await supabase
            .from("claw_tokens")
            .select("mint_address, image_url")
            .in("mint_address", stillUnresolved);
          if (clawData) {
            for (const t of clawData) {
              if (t.mint_address && t.image_url) imgMap.set(t.mint_address, t.image_url);
            }
          }
        }

        setTokenImages(imgMap);

        // Fetch metadata for still-unresolved Solana mints via edge function
        const needMetadata = mints.filter(
          (m) => !imgMap.has(m) && !imageCache.has(m) && !pendingMetadata.current.has(m)
        );
        // Only fetch for Solana mints (non-bnb)
        const solanaMints = needMetadata.filter((m) => {
          const trade = tradesData.find((t) => t.token_mint === m);
          return !trade?.chain || trade.chain === "solana";
        });

        if (solanaMints.length > 0) {
          solanaMints.forEach((m) => pendingMetadata.current.add(m));
          try {
            const { data: metaResp } = await supabase.functions.invoke("fetch-token-metadata", {
              body: { mints: solanaMints },
            });
            const metadata = metaResp?.metadata ?? {};
            const newMetaImages = new Map<string, string>();
            for (const [mint, meta] of Object.entries(metadata)) {
              const m = meta as { image?: string };
              if (m.image) {
                newMetaImages.set(mint, m.image);
                imageCache.set(mint, { primary: m.image, fallbacks: buildFallbacks(mint) });
              }
            }
            if (newMetaImages.size > 0) {
              setMetadataImages((prev) => {
                const next = new Map(prev);
                newMetaImages.forEach((v, k) => next.set(k, v));
                return next;
              });
            }
          } catch (err) {
            console.error("[useAlphaTrades] Metadata fetch failed:", err);
          } finally {
            solanaMints.forEach((m) => pendingMetadata.current.delete(m));
          }
        }
      }
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchTrades();

    const channel = supabase
      .channel("alpha-trades-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const newTrade = payload.new as AlphaTrade;
          setTrades((prev) => [newTrade, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void fetchTrades();
    }, 5000);

    const onFocus = () => {
      void fetchTrades();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchTrades, limit]);

  const positions = useMemo(() => computePositions(trades), [trades]);

  const enrichedTrades = useMemo(() => {
    return trades.map((t) => {
      const dbImage = tokenImages.get(t.token_mint);
      const metaImage = metadataImages.get(t.token_mint);
      const cached = imageCache.get(t.token_mint);
      const chain = t.chain === "bnb" ? "bsc" : "solana";
      const dexScreenerFallback = `https://dd.dexscreener.com/ds-data/tokens/${chain}/${t.token_mint}.png`;

      const primary = dbImage || metaImage || cached?.primary || dexScreenerFallback;
      const fallbacks = buildFallbacks(t.token_mint, t.chain);
      // Remove primary from fallbacks to avoid duplication
      const uniqueFallbacks = fallbacks.filter((f) => f !== primary);

      return {
        ...t,
        token_image_url: primary,
        token_image_fallbacks: uniqueFallbacks,
      };
    });
  }, [trades, tokenImages, metadataImages]);

  return { trades: enrichedTrades, loading, positions };
}
