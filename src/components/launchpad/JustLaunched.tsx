import { Link } from "react-router-dom";
import { Rocket, Clock, Bot, Flame } from "lucide-react";
import { LiveAge } from "@/components/ui/LiveAge";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useJustLaunched, type JustLaunchedToken } from "@/hooks/useJustLaunched";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PumpBadge } from "@/components/forum/PumpBadge";
import { BagsBadge } from "@/components/forum/BagsBadge";
import { PhantomBadge } from "@/components/forum/PhantomBadge";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";

function formatUsdMarketCap(marketCapSol: number, solPrice: number): string {
  const usdValue = marketCapSol * solPrice;
  if (!Number.isFinite(usdValue) || usdValue <= 0) return "$0";
  if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
  if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
  return `$${usdValue.toFixed(0)}`;
}

function isHot(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 60 * 60 * 1000;
}

function JustLaunchedCard({ token, index }: { token: JustLaunchedToken; index: number }) {
  const { solPrice } = useSolPrice();
  const isTradingAgent = !!(token.trading_agent_id || token.is_trading_agent_token);
  const isPumpFun = token.launchpad_type === "pumpfun";
  const isBags = token.launchpad_type === "bags";
  const isPhantom = token.launchpad_type === "phantom";
  const linkPath =
    token.agent_id || isTradingAgent || isPumpFun || isBags
      ? `/t/${token.ticker}`
      : `/trade/${token.mint_address || token.id}`;
  const hot = isHot(token.created_at);

  return (
    <Link
      to={linkPath}
      className="group relative flex-shrink-0 w-[180px] sm:w-[200px] rounded-2xl border transition-all duration-250 overflow-hidden"
      style={{
        background: "linear-gradient(168deg, hsl(240 10% 8% / 0.9), hsl(240 7% 4% / 0.95))",
        borderColor: "rgba(0,212,255,0.10)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.3)",
        animationDelay: `${index * 60}ms`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,212,255,0.30)";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(0,212,255,0.12), 0 8px 24px rgba(0,0,0,0.4)";
        e.currentTarget.style.transform = "scale(1.035)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,212,255,0.10)";
        e.currentTarget.style.boxShadow =
          "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.3)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* Hot badge */}
      {hot && (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase"
          style={{ background: "rgba(0,212,255,0.15)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)" }}>
          <Flame className="w-2.5 h-2.5" />
          Hot
        </div>
      )}

      <div className="p-3 flex flex-col items-center gap-2">
        {/* Token Icon */}
        <div className="relative">
          <OptimizedTokenImage
            src={token.image_url}
            fallbackText={token.ticker}
            alt={token.name}
            size={96}
            className="w-11 h-11 rounded-full object-cover border flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
            style={{ borderColor: "rgba(0,212,255,0.12)", boxShadow: "0 0 12px rgba(0,212,255,0.06)" }}
          />
          {isTradingAgent && (
            <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", boxShadow: "0 0 6px rgba(245,158,11,0.4)" }}>
              <Bot className="w-2.5 h-2.5 text-white" />
            </span>
          )}
        </div>

        {/* Name + badges */}
        <div className="w-full text-center min-w-0">
          <h3 className="font-semibold text-[13px] text-foreground truncate leading-tight flex items-center justify-center gap-1 transition-colors group-hover:text-[#00D4FF]">
            {token.name}
            {isPumpFun && <PumpBadge size="sm" showText={false} mintAddress={token.mint_address ?? undefined} />}
            {isBags && <BagsBadge showText={false} mintAddress={token.mint_address ?? undefined} />}
            {isPhantom && <PhantomBadge showText={false} size="sm" mintAddress={token.mint_address ?? undefined} />}
          </h3>
          <span className="text-[10px] font-mono tracking-wide" style={{ color: "#B0B0C0" }}>
            ${token.ticker}
          </span>
        </div>

        {/* Price + Time */}
        <div className="w-full flex items-center justify-between px-0.5">
          <span className="text-[13px] font-bold font-mono" style={{ color: "#FFD700", textShadow: "0 0 8px rgba(255,215,0,0.2)" }}>
            {formatUsdMarketCap(token.market_cap_sol ?? 0, solPrice)}
          </span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.10)" }}>
            <Clock className="w-2.5 h-2.5" style={{ color: "#00D4FF" }} />
            <LiveAge createdAt={token.created_at} className="text-[9px] font-mono font-medium" style={{ color: "#00D4FF" }} />
          </div>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)" }} />
    </Link>
  );
}

export function JustLaunched() {
  const { tokens, isLoading } = useJustLaunched();

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg"
          style={{ background: "rgba(0,255,157,0.1)", boxShadow: "0 0 10px rgba(0,255,157,0.08)" }}>
          <Rocket className="w-3.5 h-3.5" style={{ color: "#00FF9D" }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">
          Just Launched
        </span>
        <span className="text-[11px] font-medium" style={{ color: "#B0B0C0" }}>
          — Last 24 Hours
        </span>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(240 4% 16%), transparent)" }} />
      </div>

      {isLoading ? (
        <div className="flex gap-3 pb-1 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-[180px] sm:w-[200px] rounded-2xl border p-3"
              style={{ background: "hsl(240 10% 6%)", borderColor: "rgba(0,212,255,0.06)" }}>
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="w-11 h-11 rounded-full" />
                <div className="space-y-1 w-full flex flex-col items-center">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2.5 w-10" />
                </div>
                <div className="flex w-full justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tokens.length === 0 ? null : (
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {tokens.map((token, i) => (
              <JustLaunchedCard key={token.id} token={token} index={i} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
