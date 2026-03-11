import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { JustLaunched } from "@/components/launchpad/JustLaunched";
import { LazySection } from "@/components/ui/LazySection";
import { useCodexNewPairs, SOLANA_NETWORK_ID, type CodexPairToken } from "@/hooks/useCodexNewPairs";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Zap, Rocket, ArrowRight, Crosshair, Radar, CandlestickChart,
  ArrowUpRight, ArrowDownRight, Shield, Users, Bot, ChevronLeft, ChevronRight
} from "lucide-react";
import { useMemo, useRef, useState, useCallback, useEffect, lazy, Suspense } from "react";
import saturnLogo from "@/assets/saturn-logo.png";

// Lazy load heavy below-fold section components
const AlphaSection = lazy(() => import("@/components/home/AlphaSection"));
const XTrackerSection = lazy(() => import("@/components/home/XTrackerSection"));
const LeverageSection = lazy(() => import("@/components/home/LeverageSection"));
const TradingAgentsShowcase = lazy(() => import("@/components/home/TradingAgentsShowcase"));

/* ── Premium Pulse Token Card ── */
function PulseTokenRow({ token }: { token: CodexPairToken }) {
  const mcap = token.marketCap;
  const formatMcap = mcap >= 1e6 ? `$${(mcap / 1e6).toFixed(2)}M` : mcap >= 1e3 ? `$${(mcap / 1e3).toFixed(1)}K` : `$${mcap.toFixed(0)}`;
  const change = token.change24h;
  const isPositive = change >= 0;

  return (
    <Link
      to={`/trade/${token.address}`}
      className="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-300
                 bg-card/30 backdrop-blur-sm border-border/20
                 hover:border-primary/40 hover:bg-card/60 hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)] hover:scale-[1.02]
                 overflow-hidden"
    >
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <SparklineCanvas data={[1, 1]} seed={token.address || token.symbol} />
      </div>
      <OptimizedTokenImage
        src={token.imageUrl}
        alt={token.name}
        className="w-8 h-8 rounded-full shrink-0 relative z-10 ring-1 ring-border/30 group-hover:ring-primary/30 transition-all"
      />
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground truncate">{token.symbol}</span>
          {token.graduationPercent > 0 && token.graduationPercent < 100 && (
            <span className="text-[9px] text-muted-foreground font-mono bg-muted/50 px-1 rounded">{token.graduationPercent.toFixed(0)}%</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate block">{token.name}</span>
      </div>
      <div className="text-right shrink-0 relative z-10">
        <div className="text-[11px] font-bold text-foreground font-mono">{formatMcap}</div>
        <div className={cn(
          "text-[10px] font-mono font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md mt-0.5",
          isPositive
            ? "text-emerald-400 bg-emerald-500/10"
            : "text-red-400 bg-red-500/10"
        )}>
          {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </div>
      </div>
    </Link>
  );
}

/* ── Pulse Column ── */
function PulseColumn({ title, tokens, loading }: { title: string; tokens: CodexPairToken[]; loading: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 mb-1">
        <div className="text-xs font-bold text-foreground/80 uppercase tracking-widest">{title}</div>
        <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
      </div>
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))
      ) : tokens.length > 0 ? (
        tokens.map((t) => <PulseTokenRow key={t.address || t.symbol} token={t} />)
      ) : (
        <div className="text-center py-6 text-[11px] text-muted-foreground">No tokens</div>
      )}
    </div>
  );
}

/* ── Section Header — Premium ── */
function SectionHeader({ icon: Icon, title, linkTo, linkLabel }: {
  icon: React.ElementType;
  title: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-semibold
                   px-3 py-1.5 rounded-lg border border-primary/20 hover:border-primary/40 hover:bg-primary/5"
      >
        {linkLabel}
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

export { SectionHeader };

/* ── Section Divider ── */
function SectionDivider() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
    </div>
  );
}

/* ── Live Pulse Section with mobile horizontal scroll ── */
function LivePulseSection({ newPairs, completing, graduated, loading }: {
  newPairs: CodexPairToken[];
  completing: CodexPairToken[];
  graduated: CodexPairToken[];
  loading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollState); ro.disconnect(); };
  }, [updateScrollState]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const colWidth = el.querySelector(':scope > *')?.getBoundingClientRect().width ?? el.clientWidth;
    el.scrollBy({ left: dir === "left" ? -colWidth - 12 : colWidth + 12, behavior: "smooth" });
  };

  const mobileColumns = [
    { title: "🚀 Migrated", tokens: graduated },
    { title: "⚡ New Pairs", tokens: newPairs },
    { title: "🔥 Final Stretch", tokens: completing },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <SectionHeader icon={Zap} title="Live Pulse" linkTo="/trade" linkLabel="Launch Terminal" />
      
      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid grid-cols-3 gap-5">
        <PulseColumn title="⚡ New Pairs" tokens={newPairs} loading={loading} />
        <PulseColumn title="🔥 Final Stretch" tokens={completing} loading={loading} />
        <PulseColumn title="🚀 Migrated" tokens={graduated} loading={loading} />
      </div>

      {/* Mobile: horizontal scroll with arrows */}
      <div className="md:hidden flex items-center">
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-card/60 backdrop-blur-sm border border-border/40 transition-all",
            canScrollLeft ? "text-foreground/90 hover:bg-card hover:border-primary/30" : "text-muted-foreground/30 cursor-default",
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 flex flex-row gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide mx-1 [&>*]:snap-center [&>*]:min-w-[calc(100%-8px)] [&>*]:flex-shrink-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {mobileColumns.map(col => (
            <div key={col.title} className="min-w-0">
              <PulseColumn title={col.title} tokens={col.tokens} loading={loading} />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-card/60 backdrop-blur-sm border border-border/40 transition-all",
            canScrollRight ? "text-foreground/90 hover:bg-card hover:border-primary/30" : "text-muted-foreground/30 cursor-default",
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated, isLoading: codexLoading } = useCodexNewPairs(SOLANA_NETWORK_ID);

  const limitedNewPairs = useMemo(() => (codexNewPairs || []).slice(0, 5), [codexNewPairs]);
  const limitedCompleting = useMemo(() => (codexCompleting || []).slice(0, 5), [codexCompleting]);
  const limitedGraduated = useMemo(() => (codexGraduated || []).slice(0, 5), [codexGraduated]);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="relative z-10">
        {/* ═══ Hero Section — UNTOUCHED ═══ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-10 text-center">
            <img src={saturnLogo} alt="Saturn Trade" className="w-16 h-16 mx-auto mb-4 drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]" />
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
              Saturn Trade
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto mb-2">
              The fastest AI-powered trading terminal on Solana
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground/60 max-w-md mx-auto mb-8">
              Lightning-fast execution, built-in launchpad, referral rewards, smart alpha tracking, and AI-powered agents — all in one terminal.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/trade"
                className="btn-gradient-green flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
              >
                <Zap className="w-4 h-4" />
                Open Terminal
              </Link>
              <Link
                to="/launchpad"
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-card border border-border hover:border-primary/40 text-foreground transition-colors"
              >
                <Rocket className="w-4 h-4" />
                Launch Token
              </Link>
            </div>

            <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
              {[
                { icon: Zap, label: "Fastest Execution" },
                { icon: Shield, label: "Secure Trading" },
                { icon: Users, label: "Referral System" },
                { icon: Bot, label: "AI Agents" },
              ].map(({ icon: FIcon, label }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/50 text-xs text-muted-foreground">
                  <FIcon className="w-3.5 h-3.5 text-primary/70" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Live Pulse Section ═══ */}
        <SectionDivider />
        <LivePulseSection
          newPairs={limitedNewPairs}
          completing={limitedCompleting}
          graduated={limitedGraduated}
          loading={codexLoading}
        />

        {/* ═══ Trading Agents Showcase ═══ */}
        <SectionDivider />
        <LazySection>
          <section className="max-w-7xl mx-auto px-4 py-8">
            <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>}>
              <TradingAgentsShowcase />
            </Suspense>
          </section>
        </LazySection>

        {/* ═══ Just Launched ═══ */}
        <SectionDivider />
        <section className="max-w-7xl mx-auto px-4 py-8">
          <SectionHeader icon={Rocket} title="Just Launched" linkTo="/launchpad" linkLabel="View All" />
          <JustLaunched />
        </section>

        {/* ═══ King of the Hill ═══ */}
        <SectionDivider />
        <section className="max-w-7xl mx-auto px-4 py-8">
          <KingOfTheHill />
        </section>

        {/* ═══ Alpha Tracker (lazy) ═══ */}
        <SectionDivider />
        <LazySection>
          <section className="max-w-7xl mx-auto px-4 py-8">
            <SectionHeader icon={Crosshair} title="Alpha Trades" linkTo="/alpha-tracker" linkLabel="View All" />
            <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>}>
              <AlphaSection />
            </Suspense>
          </section>
        </LazySection>

        {/* ═══ X Tracker (lazy) ═══ */}
        <SectionDivider />
        <LazySection>
          <section className="max-w-7xl mx-auto px-4 py-8">
            <SectionHeader icon={Radar} title="X Tracker" linkTo="/x-tracker" linkLabel="View All" />
            <Suspense fallback={<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>}>
              <XTrackerSection />
            </Suspense>
          </section>
        </LazySection>

        {/* ═══ Leverage (lazy) ═══ */}
        <SectionDivider />
        <LazySection>
          <section className="max-w-7xl mx-auto px-4 py-8 pb-20">
            <SectionHeader icon={CandlestickChart} title="Leverage Trading" linkTo="/leverage" linkLabel="Open Terminal" />
            <Suspense fallback={<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}>
              <LeverageSection />
            </Suspense>
          </section>
        </LazySection>
      </div>
    </LaunchpadLayout>
  );
}
