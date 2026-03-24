import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useBtcWallet } from '@/contexts/BtcWalletContext';
import { useBtcUsdPrice } from '@/hooks/useBtcUsdPrice';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { V2SaturnProtocolExplainer } from '@/components/bitcoin/V2SaturnProtocolExplainer';
import { BtcNetworkDashboard } from '@/components/bitcoin/BtcNetworkDashboard';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { useBtcMemeTokensAll, type BtcMemeToken } from '@/hooks/useBtcMemeTokens';
import {
  Rocket, TrendingUp, Zap, Shield, Layers, Cpu, FileText,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ArrowRight, Crown
} from 'lucide-react';
import { useChain } from '@/contexts/ChainContext';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LaunchpadLayout } from '@/components/layout/LaunchpadLayout';
import { LazySection } from '@/components/ui/LazySection';

function formatBtc(v: number) {
  if (v === 0) return '0 ₿';
  if (v >= 1) return `${v.toFixed(4)} ₿`;
  if (v >= 0.001) return `${v.toFixed(6)} ₿`;
  if (v >= 0.00000001) return `${v.toFixed(8)} ₿`;
  const s = v.toFixed(12).replace(/0+$/, '');
  return `${s} ₿`;
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ── Premium BTC Token Card ── */
function BtcPulseTokenRow({ token, btcUsdPrice }: { token: BtcMemeToken; btcUsdPrice: number }) {
  const navigate = useNavigate();
  const pct = Math.min(token.bonding_progress, 100);
  const isGraduated = token.status === 'graduated';

  return (
    <button
      onClick={() => navigate(`/btc/meme/${token.genesis_txid || token.id}`)}
      className="group relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300
                 backdrop-blur-sm overflow-hidden w-full text-left"
      style={{
        background: "linear-gradient(135deg, hsl(220 25% 8% / 0.95), hsl(225 20% 10% / 0.9))",
        borderColor: "hsl(200 40% 60% / 0.08)",
        boxShadow: "inset 0 1px 0 0 hsl(0 0% 100% / 0.04), 0 2px 12px -2px rgb(0 0 0 / 0.5)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "hsl(30 90% 55% / 0.25)";
        e.currentTarget.style.transform = "translateY(-1px) scale(1.012)";
        e.currentTarget.style.boxShadow = "0 0 30px hsl(30 90% 55% / 0.06), 0 12px 32px -4px rgb(0 0 0 / 0.6), inset 0 0 30px hsl(30 70% 50% / 0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "hsl(200 40% 60% / 0.08)";
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "inset 0 1px 0 0 hsl(0 0% 100% / 0.04), 0 2px 12px -2px rgb(0 0 0 / 0.5)";
      }}
    >
      {/* Background gradient shimmer */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{ background: `linear-gradient(135deg, hsl(30 90% 55% / ${pct / 300}) 0%, transparent 60%)` }} />

      {token.image_url ? (
        <img src={token.image_url} alt={token.ticker} className="w-9 h-9 rounded-xl shrink-0 relative z-10 object-cover"
          style={{ border: "1.5px solid hsl(30 40% 50% / 0.15)" }} />
      ) : (
        <div className="w-9 h-9 rounded-xl shrink-0 relative z-10 bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
          {token.ticker.charAt(0)}
        </div>
      )}

      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground truncate">{token.ticker}</span>
          <span className="text-[9px] text-muted-foreground font-mono">{timeAgo(token.created_at)}</span>
          {!isGraduated && pct >= 50 && (
            <span className="flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: "hsl(45 90% 50% / 0.15)", color: "hsl(45 90% 50%)" }}>
              <Crown className="w-2.5 h-2.5" /> KOTH
            </span>
          )}
          {!isGraduated && pct > 0 && pct < 50 && (
            <span className="text-[9px] text-muted-foreground font-mono px-1 rounded" style={{ background: "hsl(220 20% 18% / 0.8)" }}>
              {pct < 1 ? pct.toFixed(2) : pct.toFixed(0)}%
            </span>
          )}
          {isGraduated && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: "hsl(30 90% 55% / 0.15)", color: "hsl(30 90% 55%)" }}>
              RUNE
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate block">{token.name}</span>
      </div>

      <div className="text-right shrink-0 relative z-10">
        <div className="text-[11px] font-bold font-mono" style={{ color: "#F7931A" }}>
          {(() => {
            const usd = token.market_cap_btc * btcUsdPrice;
            if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
            if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
            if (usd > 0) return `$${usd.toFixed(0)}`;
            return formatBtc(token.market_cap_btc);
          })()}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
          {formatBtc(token.price_btc)}
        </div>
      </div>
    </button>
  );
}

/* ── Pulse Column ── */
function BtcPulseColumn({ title, icon, tokens, loading, btcUsdPrice }: {
  title: string; icon: string; tokens: BtcMemeToken[]; loading: boolean; btcUsdPrice: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 mb-1">
        <span>{icon}</span>
        <div className="text-xs font-bold text-foreground/80 uppercase tracking-widest">{title}</div>
        <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
      </div>
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))
      ) : tokens.length > 0 ? (
        tokens.map((t) => <BtcPulseTokenRow key={t.id} token={t} btcUsdPrice={btcUsdPrice} />)
      ) : (
        <div className="text-center py-8 text-[11px] text-muted-foreground border border-dashed border-border/30 rounded-xl">
          No tokens yet
        </div>
      )}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, linkTo, linkLabel }: {
  icon: React.ElementType; title: string; linkTo: string; linkLabel: string;
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

/* ── Live Pulse Section ── */
function BtcLivePulseSection({ newPairs, finalStretch, graduated, loading, btcUsdPrice }: {
  newPairs: BtcMemeToken[]; finalStretch: BtcMemeToken[]; graduated: BtcMemeToken[]; loading: boolean; btcUsdPrice: number;
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
    { title: "New Pairs", icon: "⚡", tokens: newPairs },
    { title: "Final Stretch", icon: "🔥", tokens: finalStretch },
    { title: "Graduated", icon: "🚀", tokens: graduated },
  ];

  return (
    <section className="py-6">
      <SectionHeader icon={Zap} title="BTC Live Pulse" linkTo="/btc/meme/launch" linkLabel="Launch Token" />

      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-4">
        <BtcPulseColumn title="New Pairs" icon="⚡" tokens={newPairs} loading={loading} btcUsdPrice={btcUsdPrice} />
        <BtcPulseColumn title="Final Stretch" icon="🔥" tokens={finalStretch} loading={loading} btcUsdPrice={btcUsdPrice} />
        <BtcPulseColumn title="Graduated" icon="🚀" tokens={graduated} loading={loading} btcUsdPrice={btcUsdPrice} />
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="md:hidden flex items-center">
        <button
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          className={cn(
            "flex-shrink-0 z-20 w-8 h-8 rounded-full flex items-center justify-center",
            "bg-card/60 backdrop-blur-sm border border-border/40 transition-all",
            canScrollLeft ? "text-foreground/90 hover:bg-card hover:border-primary/30" : "text-muted-foreground/30 cursor-default",
          )}
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
              <BtcPulseColumn title={col.title} icon={col.icon} tokens={col.tokens} loading={loading} btcUsdPrice={btcUsdPrice} />
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
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

/* ── Section Divider ── */
function SectionDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />;
}

interface FeeEstimates { fastestFee: number; halfHourFee: number; hourFee: number; }

export default function V2BitcoinModePage() {
  const { isConnected, address, balance } = useBtcWallet();
  const { chain, setChain } = useChain();
  const navigate = useNavigate();
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const { data: allTokens, isLoading } = useBtcMemeTokensAll();
  const btcUsdPrice = useBtcUsdPrice();

  useEffect(() => {
    if (chain !== 'bitcoin') setChain('bitcoin');
  }, []);

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
    const base = `https://${projectId}.supabase.co/functions/v1/btc-market-data`;
    Promise.all([
      fetch(`${base}?action=fees`).then(r => r.json()).catch(() => null),
      fetch(`${base}?action=block-tip`).then(r => r.json()).catch(() => null),
    ]).then(([feeData, blockData]) => {
      if (feeData && !feeData.error) setFees(feeData);
      if (blockData?.blockHeight) setBlockHeight(blockData.blockHeight);
    });
  }, []);

  // Categorize tokens into 3 columns
  const { newPairs, finalStretch, graduated } = useMemo(() => {
    if (!allTokens) return { newPairs: [], finalStretch: [], graduated: [] };

    const active = allTokens.filter(t => t.status === 'active');
    const grad = allTokens.filter(t => t.status === 'graduated');

    // Final stretch: bonding progress > 60%
    const fs = active.filter(t => t.bonding_progress >= 60).sort((a, b) => b.bonding_progress - a.bonding_progress);
    // New pairs: the rest, sorted by newest
    const np = active.filter(t => t.bonding_progress < 60).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      newPairs: np.slice(0, 8),
      finalStretch: fs.slice(0, 8),
      graduated: grad.slice(0, 8),
    };
  }, [allTokens]);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="relative z-10">
        {/* ═══ Hero Section — Bitcoin Premium ═══ */}
        <section
          className="relative overflow-hidden flex items-center justify-center py-8 sm:py-10 md:py-14 lg:py-16"
          style={{ background: "radial-gradient(ellipse 90% 70% at 50% 35%, hsl(30 60% 8%) 0%, hsl(220 40% 3%) 50%, hsl(0 0% 0%) 100%)" }}
        >
          {/* Bitcoin ambient glow */}
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse, hsl(30 90% 50% / 0.06) 0%, transparent 65%)" }} />
          <div className="absolute top-[25%] left-[18%] w-[350px] h-[350px] rounded-full pointer-events-none animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(30 80% 50% / 0.03) 0%, transparent 70%)", animationDuration: "8s" }} />

          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[
              { x: "8%", y: "18%", size: "2px", dur: "16s", delay: "0s" },
              { x: "88%", y: "25%", size: "1.5px", dur: "20s", delay: "3s" },
              { x: "22%", y: "72%", size: "1px", dur: "22s", delay: "6s" },
              { x: "72%", y: "58%", size: "2px", dur: "18s", delay: "4s" },
            ].map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  left: p.x, top: p.y,
                  width: p.size, height: p.size,
                  background: "hsl(30 90% 55% / 0.4)",
                  animationDuration: p.dur,
                  animationDelay: p.delay,
                  boxShadow: "0 0 8px hsl(30 90% 55% / 0.35)",
                }}
              />
            ))}
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none z-[2]" />

          {/* Hero Content */}
          <div className="relative z-10 w-full max-w-2xl lg:max-w-3xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(30_90%_55%/0.1)] border border-[hsl(30_90%_55%/0.2)] text-xs font-semibold mb-4 animate-fade-in"
              style={{ color: "#F7931A" }}>
              <Cpu className="w-3 h-3" /> TAT Protocol — Transaction-Attributed Tokens
            </div>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[4rem] font-black tracking-tight mb-2 animate-fade-in"
              style={{
                background: "linear-gradient(135deg, #F7931A 0%, #FFD700 50%, #F7931A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 40px hsl(30 90% 55% / 0.2))",
                animationDelay: "0.1s",
                animationFillMode: "both",
              }}
            >
              TAT Protocol
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-foreground/85 max-w-xl mx-auto mb-2 font-semibold animate-fade-in"
              style={{ animationDelay: "0.15s", animationFillMode: "both", textShadow: "0 2px 20px hsl(0 0% 0% / 0.5)" }}>
              The first Bitcoin-native meme token protocol
            </p>

            <p className="text-[11px] sm:text-xs text-muted-foreground/65 max-w-lg mx-auto mb-5 leading-relaxed animate-fade-in"
              style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
              Born on <span style={{ color: "#F7931A" }} className="font-semibold">Bitcoin Mainnet</span> (OP_RETURN genesis),
              trades instantly on <span style={{ color: "#F7931A" }} className="font-semibold">Saturn Execution Layer</span>,
              audited on <span style={{ color: "#F7931A" }} className="font-semibold">Mainnet</span> via Merkle anchors. Graduates to native Rune at 0.5 BTC.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-3 flex-wrap mb-5 animate-fade-in"
              style={{ animationDelay: "0.25s", animationFillMode: "both" }}>
              {isConnected ? (
                <>
                  <Button
                    onClick={() => navigate('/btc/meme/launch')}
                    className="relative px-5 py-2 rounded-full font-bold text-xs min-h-[36px] hover:scale-[1.05] transition-all duration-300"
                    style={{
                      background: "linear-gradient(135deg, #F7931A 0%, #FFD700 60%, #F7931A 100%)",
                      color: "hsl(0 0% 5%)",
                      boxShadow: "0 0 24px hsl(30 90% 55% / 0.18), 0 4px 16px hsl(0 0% 0% / 0.3)",
                    }}
                  >
                    <Rocket className="w-3.5 h-3.5 mr-1.5" /> Launch
                  </Button>
                  <Button
                    onClick={() => navigate('/btc/meme/launch')}
                    className="relative px-5 py-2 rounded-full font-bold text-xs min-h-[36px] hover:scale-[1.05] transition-all duration-300
                               border border-primary/30 hover:border-primary/60 bg-card/20 backdrop-blur-sm text-foreground"
                    style={{ boxShadow: "0 4px 16px hsl(0 0% 0% / 0.3)" }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Trade
                  </Button>
                </>
              ) : (
                <>
                  <BtcConnectWalletModal
                    trigger={
                      <Button
                        className="relative px-5 py-2 rounded-full font-bold text-xs min-h-[36px] hover:scale-[1.05] transition-all duration-300"
                        style={{
                          background: "linear-gradient(135deg, #F7931A 0%, #FFD700 60%, #F7931A 100%)",
                          color: "hsl(0 0% 5%)",
                          boxShadow: "0 0 24px hsl(30 90% 55% / 0.18), 0 4px 16px hsl(0 0% 0% / 0.3)",
                        }}
                      >
                        <Rocket className="w-3.5 h-3.5 mr-1.5" /> Launch
                      </Button>
                    }
                  />
                  <BtcConnectWalletModal
                    trigger={
                      <Button
                        className="relative px-5 py-2 rounded-full font-bold text-xs min-h-[36px] hover:scale-[1.05] transition-all duration-300
                                   border border-primary/30 hover:border-primary/60 bg-card/20 backdrop-blur-sm text-foreground"
                        style={{ boxShadow: "0 4px 16px hsl(0 0% 0% / 0.3)" }}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Trade
                      </Button>
                    }
                  />
                </>
              )}
              <a
                href="/btc/whitepaper"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs min-h-[36px] 
                           border border-primary/30 hover:border-primary/60 bg-card/20 backdrop-blur-sm
                           text-foreground hover:scale-[1.05] transition-all duration-300"
                style={{ boxShadow: "0 4px 16px hsl(0 0% 0% / 0.3)" }}
              >
                <FileText className="w-3.5 h-3.5" style={{ color: "#F7931A" }} /> Whitepaper
              </a>
            </div>

            {/* Feature badges */}
            <div className="flex items-center justify-center gap-2 flex-wrap mb-4 animate-fade-in"
              style={{ animationDelay: "0.35s", animationFillMode: "both" }}>
              {[
                { icon: Shield, label: "OP_RETURN Genesis" },
                { icon: Zap, label: "Instant Execution" },
                { icon: Layers, label: "Merkle Anchoring" },
                { icon: TrendingUp, label: "0.5 BTC → Rune" },
              ].map(({ icon: FIcon, label }) => (
                <div
                  key={label}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full
                             bg-card/15 backdrop-blur-xl border border-border/20
                             text-[10px] sm:text-[11px] text-muted-foreground/80
                             transition-all duration-300
                             hover:border-[hsl(30_90%_55%/0.4)] hover:-translate-y-1 hover:scale-105"
                >
                  <FIcon className="w-3 h-3" style={{ color: "#F7931A" }} />
                  {label}
                </div>
              ))}
            </div>

            {/* Trust badge + BitcoinTalk */}
            <div className="flex items-center justify-center gap-3 mt-3 animate-fade-in"
              style={{ animationDelay: "0.45s", animationFillMode: "both" }}>
              <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-card/10 backdrop-blur-md border border-border/10 text-[9px] text-muted-foreground/40">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#F7931A" }} />
                  {blockHeight ? `Block #${blockHeight.toLocaleString()}` : 'Syncing...'}
                </span>
                <span className="w-px h-3 bg-border/20" />
                <span className="font-mono">{fees ? `${fees.halfHourFee} sat/vB` : '—'}</span>
              </div>
              <a
                href="https://bitcointalk.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/10 backdrop-blur-md border border-border/10 text-[9px] text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-colors"
                title="Read the TAT Protocol announcement on BitcoinTalk"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12.3 2C6.6 2 2 6.6 2 12.3s4.6 10.3 10.3 10.3 10.3-4.6 10.3-10.3S18 2 12.3 2zm2.5 14.7h-1.8v-1.5h-1v1.5H10v-1.5H9v1.5H7.3v-1.3h.7v-6.8h-.7V7.3H9v1.5h1V7.3h2v1.5h1V7.3h1.8c1.7 0 3 1.3 3 3v3.4c0 1.7-1.3 3-3 3zm0-7.4h-.8v6.1h.8c.9 0 1.7-.7 1.7-1.7v-2.7c0-1-.8-1.7-1.7-1.7z"/></svg>
                BitcoinTalk
              </a>
            </div>
          </div>
        </section>

        {/* ═══ Live Pulse Section ═══ */}
        <SectionDivider />
        <div className="max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] 2xl:max-w-[92vw] mx-auto px-4">
          <BtcLivePulseSection
            newPairs={newPairs}
            finalStretch={finalStretch}
            graduated={graduated}
            loading={isLoading}
            btcUsdPrice={btcUsdPrice}
          />
        </div>

        {/* ═══ Network Dashboard ═══ */}
        <SectionDivider />
        <div className="max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] 2xl:max-w-[92vw] mx-auto px-4 py-6">
          <SectionHeader icon={Cpu} title="Network Stats" linkTo="/btc" linkLabel="Live Data" />
          <BtcNetworkDashboard />
        </div>

        {/* ═══ TAT Protocol Explainer ═══ */}
        <SectionDivider />
        <LazySection>
          <div className="max-w-7xl lg:max-w-[1600px] xl:max-w-[1800px] 2xl:max-w-[92vw] mx-auto px-4 py-6 pb-20">
            <SectionHeader icon={Layers} title="How TAT Protocol Works" linkTo="/btc" linkLabel="Learn More" />
            <V2SaturnProtocolExplainer />
          </div>
        </LazySection>
      </div>
    </LaunchpadLayout>
  );
}
