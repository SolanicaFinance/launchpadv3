import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { JustLaunched } from "@/components/launchpad/JustLaunched";
import { KolTweetCard } from "@/components/x-tracker/KolTweetCard";
import { useKolTweets } from "@/hooks/useKolTweets";
import { useAlphaTrades, type AlphaTrade, type PositionSummary } from "@/hooks/useAlphaTrades";
import { useAsterMarkets, type AsterMarket } from "@/hooks/useAsterMarkets";
import { useCodexNewPairs, SOLANA_NETWORK_ID, type CodexPairToken } from "@/hooks/useCodexNewPairs";
import { SparklineCanvas } from "@/components/launchpad/SparklineCanvas";
import { OptimizedTokenImage } from "@/components/ui/OptimizedTokenImage";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Zap, Rocket, ArrowRight, Crosshair, Radar, CandlestickChart,
  ArrowUpRight, ArrowDownRight, Shield, Users, Bot
} from "lucide-react";
import { useMemo } from "react";
import { timeAgo, formatTokenAmt } from "@/lib/tradeUtils";
import saturnLogo from "@/assets/saturn-logo.png";

/* ── Status Pill ── */
function StatusPill({ status }: { status: "HOLDING" | "PARTIAL" | "SOLD" }) {
  const c = {
    HOLDING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    SOLD: "bg-red-500/10 text-red-400 border-red-500/20",
  }[status];
  return (
    <span className={`px-1.5 py-px rounded border text-[8px] font-bold tracking-wide ${c}`}>
      {status}
    </span>
  );
}

/* ── Detailed Alpha Trade Row ── */
function AlphaTradeRow({ trade, position }: { trade: AlphaTrade; position?: PositionSummary }) {
  const isBuy = trade.trade_type === "buy";
  return (
    <Link
      to={`/trade/${trade.token_mint}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all group"
    >
      {/* Token Logo */}
      <div className="h-7 w-7 rounded-full bg-muted border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
        {trade.token_image_url ? (
          <img src={trade.token_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[7px] font-bold text-muted-foreground">
            {(trade.token_ticker || "??").slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Trader + Token */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-foreground truncate">
            ${trade.token_ticker || trade.token_name || "???"}
          </span>
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded",
            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {isBuy ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {isBuy ? "BUY" : "SELL"}
          </span>
          {position && <StatusPill status={position.status} />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground font-mono truncate">
            {trade.trader_display_name || `${trade.wallet_address.slice(0, 4)}...${trade.wallet_address.slice(-4)}`}
          </span>
          <span className="text-border">·</span>
          <span className="text-[9px] text-muted-foreground font-mono">
            {formatTokenAmt(trade.amount_tokens)} tokens
          </span>
        </div>
      </div>

      {/* Right: SOL + Time */}
      <div className="text-right shrink-0">
        <div className={cn("text-[11px] font-bold font-mono tabular-nums", isBuy ? "text-emerald-400" : "text-red-400")}>
          {isBuy ? "+" : "-"}{trade.amount_sol.toFixed(3)} SOL
        </div>
        <div className="text-[9px] text-muted-foreground font-mono">
          {timeAgo(trade.created_at)}
        </div>
      </div>
    </Link>
  );
}

/* ── Compact Leverage Market Card ── */
function LeverageCard({ market }: { market: AsterMarket }) {
  const change = parseFloat(market.priceChangePercent);
  const isPositive = change >= 0;
  const vol = parseFloat(market.quoteVolume);
  const formatVol = vol >= 1e6 ? `$${(vol / 1e6).toFixed(1)}M` : `$${(vol / 1e3).toFixed(0)}K`;

  return (
    <Link
      to={`/leverage?symbol=${market.symbol}`}
      className="relative flex flex-col gap-2 p-3.5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
    >
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden rounded-xl">
        <SparklineCanvas data={[1, 1]} seed={market.symbol} />
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{market.baseAsset}/{market.quoteAsset}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{market.maxLeverage}x</span>
      </div>
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-mono text-foreground">${parseFloat(market.lastPrice).toLocaleString()}</span>
        <span className={cn(
          "text-xs font-bold",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <div className="relative z-10 text-[10px] text-muted-foreground">Vol {formatVol}</div>
    </Link>
  );
}

/* ── Compact Pulse Token Row ── */
function PulseTokenRow({ token }: { token: CodexPairToken }) {
  const mcap = token.marketCap;
  const formatMcap = mcap >= 1e6 ? `$${(mcap / 1e6).toFixed(2)}M` : mcap >= 1e3 ? `$${(mcap / 1e3).toFixed(1)}K` : `$${mcap.toFixed(0)}`;
  const change = token.change24h;
  const isPositive = change >= 0;

  return (
    <Link
      to={`/trade/${token.address}`}
      className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card/40 border border-border/30 hover:border-primary/30 transition-all overflow-hidden"
    >
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <SparklineCanvas data={[1, 1]} seed={token.address || token.symbol} />
      </div>
      <OptimizedTokenImage
        src={token.imageUrl}
        alt={token.name}
        className="w-7 h-7 rounded-full shrink-0 relative z-10"
      />
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground truncate">{token.symbol}</span>
          {token.graduationPercent > 0 && token.graduationPercent < 100 && (
            <span className="text-[9px] text-muted-foreground font-mono">{token.graduationPercent.toFixed(0)}%</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate block">{token.name}</span>
      </div>
      <div className="text-right shrink-0 relative z-10">
        <div className="text-[11px] font-bold text-foreground font-mono">{formatMcap}</div>
        <div className={cn("text-[10px] font-mono font-semibold", isPositive ? "text-emerald-400" : "text-red-400")}>
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </div>
      </div>
    </Link>
  );
}

/* ── Pulse Column ── */
function PulseColumn({ title, tokens, loading }: { title: string; tokens: CodexPairToken[]; loading: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">{title}</div>
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))
      ) : tokens.length > 0 ? (
        tokens.map((t) => <PulseTokenRow key={t.address || t.symbol} token={t} />)
      ) : (
        <div className="text-center py-6 text-[11px] text-muted-foreground">No tokens</div>
      )}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, linkTo, linkLabel }: {
  icon: React.ElementType;
  title: string;
  linkTo: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <Link
        to={linkTo}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
      >
        {linkLabel}
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

export default function HomePage() {
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated, isLoading: codexLoading } = useCodexNewPairs(SOLANA_NETWORK_ID);
  const { data: kolTweets } = useKolTweets("all");
  const { trades: alphaTrades, loading: alphaLoading, positions: alphaPositions } = useAlphaTrades(10);
  const { markets: leverageMarkets, loading: leverageLoading } = useAsterMarkets();

  const limitedNewPairs = useMemo(() => (codexNewPairs || []).slice(0, 5), [codexNewPairs]);
  const limitedCompleting = useMemo(() => (codexCompleting || []).slice(0, 5), [codexCompleting]);
  const limitedGraduated = useMemo(() => (codexGraduated || []).slice(0, 5), [codexGraduated]);
  const limitedTweets = useMemo(() => (kolTweets || []).slice(0, 6), [kolTweets]);
  const topLeverage = useMemo(() => {
    if (!leverageMarkets.length) return [];
    return [...leverageMarkets]
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 6);
  }, [leverageMarkets]);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="relative z-10">
        {/* ═══ Hero Section ═══ */}
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
        <section className="max-w-7xl mx-auto px-4 py-6">
          <SectionHeader icon={Zap} title="Live Pulse" linkTo="/trade" linkLabel="Launch Terminal" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PulseColumn title="⚡ New Pairs" tokens={limitedNewPairs} loading={codexLoading} />
            <PulseColumn title="🔥 Final Stretch" tokens={limitedCompleting} loading={codexLoading} />
            <PulseColumn title="🚀 Migrated" tokens={limitedGraduated} loading={codexLoading} />
          </div>
        </section>

        {/* ═══ Just Launched ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <SectionHeader icon={Rocket} title="Just Launched" linkTo="/launchpad" linkLabel="View All" />
          <JustLaunched />
        </section>

        {/* ═══ King of the Hill ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <KingOfTheHill />
        </section>

        {/* ═══ Alpha Tracker ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <SectionHeader icon={Crosshair} title="Alpha Trades" linkTo="/alpha-tracker" linkLabel="View All" />
          {alphaLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alphaTrades.slice(0, 10).map((t) => (
                <AlphaTradeRow key={t.id} trade={t} position={alphaPositions.get(`${t.wallet_address}::${t.token_mint}`)} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ X Tracker ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <SectionHeader icon={Radar} title="X Tracker" linkTo="/x-tracker" linkLabel="View All" />
          {limitedTweets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {limitedTweets.map((t) => (
                <KolTweetCard key={t.id} tweet={t} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-muted-foreground">No KOL tweets yet.</div>
          )}
        </section>

        {/* ═══ Leverage ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6 pb-20">
          <SectionHeader icon={CandlestickChart} title="Leverage Trading" linkTo="/leverage" linkLabel="Open Terminal" />
          {leverageLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : topLeverage.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {topLeverage.map((m) => (
                <LeverageCard key={m.symbol} market={m} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-muted-foreground">No leverage markets available.</div>
          )}
        </section>
      </div>
    </LaunchpadLayout>
  );
}
