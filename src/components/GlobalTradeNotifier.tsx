import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTradeSounds } from "@/hooks/useTradeSounds";

/**
 * Global trade notifier — mounted once at App root.
 * Listens to alpha_trades realtime inserts via WebSocket (~50-200ms latency).
 * Fires toast + audio on EVERY page for ALL visitors.
 * Sounds are ON by default — no opt-in needed.
 */
export function GlobalTradeNotifier() {
  const { playBuy, playSell } = useTradeSounds();
  const playBuyRef = useRef(playBuy);
  const playSellRef = useRef(playSell);
  playBuyRef.current = playBuy;
  playSellRef.current = playSell;

  // Auto-unlock AudioContext on first user interaction (click/touch/key)
  useEffect(() => {
    const unlock = () => {
      try {
        // Attempt to create/resume AudioContext on any gesture
        const ctx = new AudioContext();
        if (ctx.state === "suspended") ctx.resume();
        ctx.close();
      } catch {}
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    console.log("[GlobalTradeNotifier] Subscribing to alpha_trades...");

    const channel = supabase
      .channel("global-trade-notifier-v3")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alpha_trades" },
        (payload) => {
          const trade = payload.new as any;
          if (!trade) return;
          console.log("[GlobalTradeNotifier] Trade received:", trade.trade_type, trade.token_ticker);

          const isBuy = trade.trade_type === "buy";
          const name = trade.trader_display_name || shortenAddr(trade.wallet_address);
          const ticker = trade.token_ticker || trade.token_name || shortenAddr(trade.token_mint);
          const amount = formatAmount(trade.amount_sol);
          const chain = trade.chain === "bnb" ? "BNB" : "SOL";

          // Play sound
          try {
            if (isBuy) playBuyRef.current();
            else playSellRef.current();
          } catch (e) {
            console.warn("[GlobalTradeNotifier] Sound error:", e);
          }

          // Show toast
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
        console.log("[GlobalTradeNotifier] Status:", status);
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
