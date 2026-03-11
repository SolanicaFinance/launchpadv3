import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// Audio context singleton
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freqStart: number, freqEnd: number, duration = 0.08) {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

interface TrackedWalletRef {
  wallet_address: string;
  wallet_label: string | null;
  notifications_enabled: boolean;
}

export function useWalletTradeNotifications({
  onTrade,
}: {
  onTrade?: (tradeType: "buy" | "sell") => void;
} = {}) {
  const { profileId } = useAuth();
  const walletsRef = useRef<TrackedWalletRef[]>([]);

  // Fetch tracked wallets with notifications enabled
  useEffect(() => {
    if (!profileId) {
      walletsRef.current = [];
      return;
    }

    const fetchWallets = async () => {
      const { data } = await supabase.functions.invoke("wallet-tracker-manage", {
        body: { action: "list", user_profile_id: profileId },
      });
      walletsRef.current = (data?.data || []).map((w: any) => ({
        wallet_address: w.wallet_address,
        wallet_label: w.wallet_label,
        notifications_enabled: w.notifications_enabled,
      }));
    };

    fetchWallets();

    // Re-fetch when wallets change (listen to tracked_wallets changes)
    const walletChannel = supabase
      .channel("wallet-tracker-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracked_wallets" }, () => {
        fetchWallets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
    };
  }, [profileId]);

  // Subscribe to wallet_trades inserts globally
  useEffect(() => {
    const channel = supabase
      .channel("global-wallet-trade-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_trades" },
        (payload) => {
          const trade = payload.new as any;
          const tracked = walletsRef.current.find(
            (w) => w.wallet_address === trade.wallet_address && w.notifications_enabled
          );
          if (!tracked) return;

          // Play sound
          if (trade.trade_type === "buy") {
            playTone(600, 900, 0.08);
          } else {
            playTone(500, 300, 0.08);
          }

          // Show toast
          const label = tracked.wallet_label || shortAddr(trade.wallet_address);
          const tokenLabel = trade.token_ticker || trade.token_name || shortAddr(trade.token_mint);
          toast({
            title: `${trade.trade_type === "buy" ? "🟢 Buy" : "🔴 Sell"} — ${label}`,
            description: `${Number(trade.sol_amount).toFixed(3)} SOL → ${tokenLabel}`,
          });

          // Callback for shake
          onTrade?.(trade.trade_type === "buy" ? "buy" : "sell");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onTrade]);
}
