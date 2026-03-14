import { useState, useEffect, useMemo } from "react";
import { Crown, Trophy, TrendingUp, Shield, Gem, ExternalLink, RefreshCw, Timer, Sparkles, ChevronUp, Dice5, Lock, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { SATURN_TOKEN_CA } from "@/hooks/useSaturnTokenData";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Link } from "react-router-dom";

interface HolderEntry {
  address: string;
  tokenAmount: number;
  percentage: number;
  solBalance: number;
}

function useTop69Holders() {
  return useQuery({
    queryKey: ["top-69-holders", SATURN_TOKEN_CA],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-token-holders", {
        body: { mintAddress: SATURN_TOKEN_CA },
      });
      if (error) throw error;
      const holders = (data.holders || []).slice(0, 69);
      return {
        holders,
        totalSupply: data.totalSupply,
        count: data.count,
        lastUpdated: new Date().toISOString(),
      };
    },
    staleTime: 1000 * 60 * 55,
    refetchInterval: 1000 * 60 * 60,
  });
}

function shortenAddress(addr: string) {
  return addr.slice(0, 6) + "···" + addr.slice(-4);
}

function formatTokenAmount(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

// Countdown hook — minutes:seconds until next hour + 5min
function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    function calc() {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes(5, 0, 0);
      if (now.getMinutes() >= 5) next.setHours(next.getHours() + 1);
      const diff = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

// Estimated weekly earnings based on rank position
function estWeeklyEarnings(rank: number): string {
  // Mock: top ranks earn more based on even split of 69% of fees
  const baseEarning = 0.42; // SOL per week estimate per holder
  if (rank <= 3) return (baseEarning * 2.5).toFixed(2);
  if (rank <= 10) return (baseEarning * 1.5).toFixed(2);
  return baseEarning.toFixed(2);
}

function getRankMedal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

function HolderRow({ holder, rank, animDelay }: { holder: HolderEntry; rank: number; animDelay: number }) {
  const isTop3 = rank <= 3;
  const isTop10 = rank <= 10;

  return (
    <div
      className={`
        group relative grid grid-cols-[44px_1fr_90px_70px_70px] sm:grid-cols-[50px_1fr_130px_100px_90px] 
        items-center gap-1 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border transition-all duration-300
        hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-[0_0_20px_hsl(var(--primary)/0.06)]
        ${isTop3
          ? "border-primary/20 bg-primary/[0.04]"
          : isTop10
            ? "border-border/40 bg-card/40"
            : "border-border/20 bg-card/20"
        }
      `}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      {/* Rank */}
      <div className="flex items-center gap-1">
        {isTop3 ? (
          <span className="text-lg sm:text-xl" title={`Rank #${rank}`}>
            {getRankMedal(rank)}
          </span>
        ) : (
          <span className={`font-mono text-sm font-bold ${isTop10 ? "text-primary" : "text-muted-foreground"}`}>
            #{rank}
          </span>
        )}
      </div>

      {/* Address */}
      <a
        href={`https://solscan.io/account/${holder.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 min-w-0 group/addr"
      >
        {/* Avatar circle */}
        <div
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0 border border-border/30"
          style={{
            background: `linear-gradient(135deg, hsl(${(rank * 37) % 360} 60% 50%), hsl(${(rank * 37 + 120) % 360} 50% 40%))`,
          }}
        />
        <span className="font-mono text-xs text-muted-foreground group-hover/addr:text-foreground transition-colors truncate">
          {shortenAddress(holder.address)}
        </span>
        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover/addr:opacity-50 transition-opacity" />
      </a>

      {/* Holdings */}
      <div className="text-right">
        <div className="text-xs sm:text-sm font-bold text-foreground">{formatTokenAmount(holder.tokenAmount)}</div>
        <div className="text-[10px] text-muted-foreground">{holder.percentage.toFixed(2)}%</div>
      </div>

      {/* Est. Weekly */}
      <div className="text-right">
        <div className="text-xs font-semibold text-primary">{estWeeklyEarnings(rank)} SOL</div>
        <div className="text-[10px] text-muted-foreground">est/wk</div>
      </div>

      {/* SOL Balance */}
      <div className="text-right text-xs text-muted-foreground">
        {holder.solBalance.toFixed(2)} SOL
      </div>

      {/* Rank glow line for top 3 */}
      {isTop3 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
      )}
    </div>
  );
}

export default function SixtyNineListPage() {
  const { data, isLoading, refetch, isFetching } = useTop69Holders();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"holdings" | "sol">("holdings");
  const countdown = useCountdown();

  const sortedHolders = useMemo(() => {
    if (!data?.holders) return [];
    const copy = [...data.holders];
    if (sortBy === "sol") {
      copy.sort((a: HolderEntry, b: HolderEntry) => b.solBalance - a.solBalance);
    }
    // "holdings" is already default sorted
    return copy;
  }, [data?.holders, sortBy]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse 60% 50% at 50% -10%, hsl(var(--primary) / 0.08) 0%, transparent 70%),
              radial-gradient(circle at 15% 80%, hsl(var(--primary) / 0.04) 0%, transparent 40%),
              radial-gradient(circle at 85% 60%, hsl(var(--primary) / 0.03) 0%, transparent 35%)
            `,
          }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />

          <div className="relative max-w-5xl mx-auto px-4 pt-8 sm:pt-14 pb-6 sm:pb-10">
            {/* Eyebrow */}
            <div className="flex justify-center mb-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] font-semibold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" />
                Saturn Terminal Presents
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 sm:gap-4 mb-3">
                <Crown className="h-8 w-8 sm:h-12 sm:w-12 text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] animate-pulse" strokeWidth={2} />
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-none">
                  <span className="text-primary">69</span> Under <span className="text-primary">69</span>
                </h1>
                <Crown className="h-8 w-8 sm:h-12 sm:w-12 text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)] animate-pulse" strokeWidth={2} style={{ animationDelay: "500ms" }} />
              </div>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                The Elite Ranking of $SATURN's Most Loyal Holders
              </p>
            </div>

            {/* Intro paragraph — Forbes-inspired copy */}
            <div className="max-w-3xl mx-auto mb-8">
              <div className="relative bg-card/50 backdrop-blur-sm border border-border/30 rounded-xl p-5 sm:p-7">
                {/* Decorative quote mark */}
                <div className="absolute -top-3 left-6 text-primary/20 text-5xl font-serif leading-none select-none">"</div>
                <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed relative z-10">
                  Inspired by <span className="text-foreground font-semibold">Forbes' legendary 30 Under 30</span> — the annual
                  roster celebrating trailblazers who've redefined success before age 30 — we present the{" "}
                  <span className="text-primary font-bold">69 Under 69 List</span>. This elite ranking honors the top 69{" "}
                  <span className="text-primary font-semibold">$SATURN</span> holders (excluding liquidity pools), spotlighting 
                  those who've committed to the long game. By holding strong, you climb the ladder to lifetime rewards:{" "}
                  <span className="text-foreground font-semibold">69% of our 1% launchpad fees</span> from every coin swap is 
                  distributed evenly among the top 69, based on the last 60 minutes' profits. Plus, immovable holders have a 
                  high chance at <span className="text-foreground font-semibold">weekly bonuses of 69 SOL</span>. The mission? 
                  Don't sell — ascend to the top and earn passively from every token launched on Saturn Terminal.{" "}
                  <span className="text-primary font-bold italic">Hold $SATURN, get rich like a Forbes lister.</span>
                </p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mb-6">
              {[
                { value: "69%", label: "Fees Distributed", icon: Trophy },
                { value: "1%", label: "Per Swap Fee", icon: TrendingUp },
                { value: "69 SOL", label: "Weekly Bonus Draw", icon: Dice5 },
                { value: "∞", label: "Lifetime Earnings", icon: Gem },
              ].map(({ value, label, icon: Icon }) => (
                <div
                  key={label}
                  className="group relative bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-3 sm:p-4 text-center transition-all duration-300 hover:border-primary/30 hover:bg-primary/[0.03]"
                >
                  <Icon className="h-4 w-4 text-primary mx-auto mb-1.5 transition-transform duration-300 group-hover:scale-110" />
                  <div className="text-xl sm:text-2xl font-black text-primary mb-0.5">{value}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {/* How It Works */}
            <div className="max-w-3xl mx-auto bg-card/30 border border-border/20 rounded-xl p-4 sm:p-5 mb-6">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                How It Works
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { n: "01", text: "Top 69 holders scanned every hour, 5 minutes past — LP wallets excluded" },
                  { n: "02", text: "69% of the 1% platform swap fee split evenly among all 69 listed holders" },
                  { n: "03", text: "Diamond hands (no transfers in 7 days) enter a weekly 69 SOL lottery draw" },
                  { n: "04", text: "Lifetime passive income — hold your rank and earn from every token forever" },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-3 bg-background/40 rounded-lg p-3 border border-border/10">
                    <span className="text-primary font-black text-sm mt-0.5 flex-shrink-0">{n}</span>
                    <span className="text-xs text-muted-foreground leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Countdown + Refresh */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/40 border border-border/20">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Next scan in</span>
                <span className="font-mono text-sm font-bold text-foreground">{countdown}</span>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                {isFetching ? "Scanning..." : "Refresh Now"}
              </button>
              {data?.count && (
                <span className="text-xs text-muted-foreground">
                  {data.count.toLocaleString()} total holders
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
        <section className="max-w-5xl mx-auto w-full px-4 pb-20">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* ────── List Column ────── */}
            <div className="flex-1 min-w-0">
              {/* List Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  The List
                </h2>
                <div className="flex items-center gap-1 bg-card/40 rounded-lg border border-border/20 p-0.5">
                  <button
                    onClick={() => setSortBy("holdings")}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${sortBy === "holdings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    By Holdings
                  </button>
                  <button
                    onClick={() => setSortBy("sol")}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${sortBy === "sol" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    By SOL
                  </button>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-[44px_1fr_90px_70px_70px] sm:grid-cols-[50px_1fr_130px_100px_90px] gap-1 sm:gap-3 px-3 sm:px-4 py-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border/20 mb-2">
                <span>Rank</span>
                <span>Holder</span>
                <span className="text-right">$SATURN</span>
                <span className="text-right">Est/Wk</span>
                <span className="text-right">SOL Bal</span>
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {isLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="px-3 py-3 rounded-lg bg-card/20 border border-border/10">
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))
                ) : (
                  sortedHolders.map((h: HolderEntry, i: number) => (
                    <HolderRow
                      key={h.address}
                      holder={h}
                      rank={i + 1}
                      animDelay={Math.min(i * 30, 600)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ────── Sidebar Column ────── */}
            <div className="w-full lg:w-[280px] flex-shrink-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              {/* Weekly Lottery Card */}
              <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Dice5 className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-foreground text-sm">Weekly 69 SOL Lottery</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Holders who haven't transferred any <span className="text-primary font-semibold">$SATURN</span> in{" "}
                  <span className="text-foreground font-semibold">7 days</span> are automatically entered into a weekly draw 
                  for <span className="text-primary font-bold">69 SOL</span>. Your odds increase with rank — top 10 holders get 3× entries.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3 w-3" /> Diamond Hand Bonus
                    </span>
                    <span className="text-primary font-bold">3× odds</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ChevronUp className="h-3 w-3" /> Top 10 Multiplier
                    </span>
                    <span className="text-primary font-bold">3× entries</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Trophy className="h-3 w-3" /> Prize Pool
                    </span>
                    <span className="text-foreground font-bold">69 SOL / week</span>
                  </div>
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="rounded-xl border border-border/20 bg-card/30 p-5">
                <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Fee Architecture
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">To Top 69 Holders</span>
                      <span className="text-primary font-bold">69%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: "69%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Platform Operations</span>
                      <span className="text-foreground font-semibold">31%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: "31%" }} />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                  Every swap on Saturn Launchpad generates a 1% fee. 69% flows directly to the top 69 holders, 
                  calculated from the last 60 minutes of revenue.
                </p>
              </div>

              {/* Why Forbes comparison */}
              <div className="rounded-xl border border-border/20 bg-card/30 p-5">
                <h3 className="font-bold text-foreground text-sm mb-2">Why "69 Under 69"?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Forbes' 30 Under 30 spotlights founders who build empires. We spotlight holders who believe in one. 
                  Where Forbes celebrates creation, Saturn celebrates <span className="text-primary font-semibold">conviction</span>. 
                  The result? A new loyalty meta — gamifying holding, combating dumps, and building a 
                  prestige system that turns users into crypto elites.
                </p>
              </div>
            </div>
          </div>

          {/* ═══════════════════ CTA FOOTER ═══════════════════ */}
          <div className="mt-12 relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-primary/[0.03] to-transparent p-6 sm:p-10 text-center">
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />
            <div className="relative z-10">
              <Crown className="h-10 w-10 text-primary mx-auto mb-4 drop-shadow-[0_0_16px_hsl(var(--primary)/0.4)]" strokeWidth={1.5} />
              <h3 className="text-xl sm:text-2xl font-black text-foreground mb-2">
                Climb the 69 Under 69
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
                Buy <span className="text-primary font-bold">$SATURN</span>, hold your position, and earn lifetime passive income 
                from every token launched on Saturn Terminal. The higher your rank, the more you earn.
              </p>
              <Link
                to={`/trade/${SATURN_TOKEN_CA}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
              >
                Buy $SATURN Now
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
