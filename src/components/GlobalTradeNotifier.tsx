import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTradeSounds } from "@/hooks/useTradeSounds";

/**
 * Global trade notifier — mounted once at App root.
 * Subscribes to alpha_trades realtime inserts and fires
 * toast notifications + audio on EVERY page, not just Alpha Tracker.
 * 
 * Latency: Supabase Realtime (WebSocket) delivers in ~50-200ms from DB insert.
 */
export function GlobalTradeNotifier() {
  const { playBuy, playSell } = useTradeSounds();
  const playBuyRef = useRef(playBuy);
  const playSellRef = useRef(playSell);
  playBuyRef.current = playBuy;
  playSellRef.current = playSell;

  useEffect(() => {
    console.log("[GlobalTradeNotifier] Subscribing to alpha_trades realtime...");
    
    const channel = supabase
      .channel("global-trade-notifier-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          console.log("[GlobalTradeNotifier] Received trade:", payload.new);
          const trade = payload.new as any;
          if (!trade) return;

          const isBuy = trade.trade_type === "buy";
          const name = trade.trader_display_name || shortenAddr(trade.wallet_address);
          const ticker = trade.token_ticker || trade.token_name || shortenAddr(trade.token_mint);
          const amount = formatAmount(trade.amount_sol);
          const chain = trade.chain === "bnb" ? "BNB" : "SOL";

          // Play sound — always attempt (useTradeSounds checks enabled internally)
          try {
            if (isBuy) {
              playBuyRef.current();
            } else {
              playSellRef.current();
            }
          } catch (e) {
            console.warn("[GlobalTradeNotifier] Sound error:", e);
          }

          // Show toast notification
          toast(
            `${name} ${isBuy ? "bought" : "sold"} $${ticker}`,
            {
              description: `${amount} ${chain}`,
              duration: 4000,
              icon: isBuy ? "🟢" : "🔴",
              position: "bottom-right",
            }
          );
        }
      )
      .subscribe((status) => {
        console.log("[GlobalTradeNotifier] Channel status:", status);
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
