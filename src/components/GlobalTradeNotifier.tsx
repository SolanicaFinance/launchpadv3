import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTradeSounds } from "@/hooks/useTradeSounds";
import { showTradeNotification } from "@/components/TradeNotificationToast";

const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens default

/**
 * Global trade notifier — mounted once at App root.
 * Listens to alpha_trades realtime inserts via WebSocket (~50-200ms latency).
 * Fires custom toast + audio on EVERY page for ALL visitors.
 * Sounds are ON by default — no opt-in needed.
 */
export function GlobalTradeNotifier() {
  const { playBuy, playSell, playLaunch } = useTradeSounds();
  const playBuyRef = useRef(playBuy);
  const playSellRef = useRef(playSell);
  const playLaunchRef = useRef(playLaunch);
  playBuyRef.current = playBuy;
  playSellRef.current = playSell;
  playLaunchRef.current = playLaunch;

  // Cached SOL price for market cap calculation
  const solPriceRef = useRef<number>(0);
  const tokenImageCacheRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    try {
      const cached = localStorage.getItem("sol_price_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.price) solPriceRef.current = parsed.price;
      }
    } catch {}
    const iv = setInterval(() => {
      try {
        const cached = localStorage.getItem("sol_price_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.price) solPriceRef.current = parsed.price;
        }
      } catch {}
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // Audio unlock is now handled globally in useTradeSounds module

  // Subscribe to alpha_trades
  useEffect(() => {
    console.log("[GlobalTradeNotifier] Subscribing to alpha_trades...");

    const channel = supabase
      .channel("global-trade-notifier-v4")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const trade = payload.new as any;
          if (!trade) return;
          console.log("[GlobalTradeNotifier] Trade received:", trade.trade_type, trade.token_ticker);

          const isBuy = trade.trade_type === "buy";

          try {
            if (isBuy) playBuyRef.current();
            else playSellRef.current();
          } catch (e) {
            console.warn("[GlobalTradeNotifier] Sound error:", e);
          }

          let marketCapUsd: number | null = null;
          if (trade.price_sol && trade.price_sol > 0 && solPriceRef.current > 0) {
            marketCapUsd = trade.price_sol * TOTAL_SUPPLY * solPriceRef.current;
          } else if (trade.price_usd && trade.price_usd > 0) {
            marketCapUsd = trade.price_usd * TOTAL_SUPPLY;
          }

          const notify = (tokenImageUrl: string | null) => {
            showTradeNotification({
              traderName: trade.trader_display_name || shortenAddr(trade.wallet_address),
              traderAvatar: trade.trader_avatar_url || null,
              tokenTicker: trade.token_ticker || trade.token_name || shortenAddr(trade.token_mint),
              tokenMint: trade.token_mint,
              tradeType: isBuy ? "buy" : "sell",
              amountSol: trade.amount_sol || 0,
              marketCapUsd,
              chain: trade.chain || "solana",
              tokenImageUrl,
            });
          };

          const mint = trade.token_mint as string | undefined;
          if (!mint) {
            notify(null);
            return;
          }

          if (Object.prototype.hasOwnProperty.call(tokenImageCacheRef.current, mint)) {
            notify(tokenImageCacheRef.current[mint]);
            return;
          }

          (async () => {
            let imageUrl: string | null = null;

            // Check fun_tokens
            const { data: funToken } = await supabase
              .from("fun_tokens")
              .select("image_url")
              .eq("mint_address", mint)
              .not("image_url", "is", null)
              .limit(1)
              .maybeSingle();

            if (funToken?.image_url) {
              imageUrl = funToken.image_url;
            }

            // Check tokens table
            if (!imageUrl) {
              const { data: tokenRow } = await supabase
                .from("tokens")
                .select("image_url")
                .eq("mint_address", mint)
                .not("image_url", "is", null)
                .limit(1)
                .maybeSingle();

              if (tokenRow?.image_url) {
                imageUrl = tokenRow.image_url;
              }
            }

            // Check claw_tokens table
            if (!imageUrl) {
              const { data: clawRow } = await supabase
                .from("claw_tokens")
                .select("image_url")
                .eq("mint_address", mint)
                .not("image_url", "is", null)
                .limit(1)
                .maybeSingle();

              if (clawRow?.image_url) {
                imageUrl = clawRow.image_url;
              }
            }

            tokenImageCacheRef.current[mint] = imageUrl;
            notify(imageUrl);
          })().catch(() => {
            tokenImageCacheRef.current[mint] = null;
            notify(null);
          });
        }
      )
      .subscribe((status) => {
        console.log("[GlobalTradeNotifier] Trades status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Subscribe to fun_tokens for new coin launches
  useEffect(() => {
    console.log("[GlobalTradeNotifier] Subscribing to fun_tokens launches...");

    const channel = supabase
      .channel("global-launch-notifier-v1")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "fun_tokens" },
        (payload) => {
          const token = payload.new as any;
          if (!token) return;

          // Skip punch tokens
          if (token.launchpad_type === "punch") return;

          console.log("[GlobalTradeNotifier] New launch:", token.ticker, token.name);

          try {
            playLaunchRef.current();
          } catch (e) {
            console.warn("[GlobalTradeNotifier] Launch sound error:", e);
          }

          let marketCapUsd: number | null = null;
          if (token.market_cap_sol && token.market_cap_sol > 0 && solPriceRef.current > 0) {
            marketCapUsd = token.market_cap_sol * solPriceRef.current;
          }

          const chain = token.chain === "bsc" ? "bnb" : "solana";

          showTradeNotification({
            traderName: shortenAddr(token.creator_wallet),
            traderAvatar: null,
            tokenTicker: token.ticker || token.name || "???",
            tokenMint: token.mint_address || "",
            tradeType: "launch",
            amountSol: 0,
            marketCapUsd,
            chain,
            tokenImageUrl: token.image_url || null,
          });
        }
      )
      .subscribe((status) => {
        console.log("[GlobalTradeNotifier] Launches status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

function shortenAddr(addr?: string): string {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatAmount(amount?: number): string {
  if (!amount || amount === 0) return "0";
  if (amount < 0.001) return "<0.001";
  if (amount < 1) return amount.toFixed(3);
  if (amount < 100) return amount.toFixed(2);
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
