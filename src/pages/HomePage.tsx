import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { JustLaunched } from "@/components/launchpad/JustLaunched";
import { KolTweetCard } from "@/components/x-tracker/KolTweetCard";
import { useKolTweets } from "@/hooks/useKolTweets";
import { useAlphaTrades, type AlphaTrade } from "@/hooks/useAlphaTrades";
import { useAsterMarkets, type AsterMarket } from "@/hooks/useAsterMarkets";
import { useFunTokensPaginated } from "@/hooks/useFunTokensPaginated";
import { useCodexNewPairs, SOLANA_NETWORK_ID } from "@/hooks/useCodexNewPairs";
import { useSolPrice } from "@/hooks/useSolPrice";
import { AxiomTerminalGrid } from "@/components/launchpad/AxiomTerminalGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Zap, Rocket, ArrowRight, Crosshair, Radar, CandlestickChart,
  ArrowUpRight, ArrowDownRight, ExternalLink, TrendingUp, Shield, Users, Bot
} from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import saturnLogo from "@/assets/saturn-logo.png";

/* ── Compact Alpha Trade Row ── */
function AlphaTradeRow({ trade }: { trade: AlphaTrade }) {
  const isBuy = trade.trade_type === "buy";
  return (
    <Link
      to={`/trade/${trade.token_mint}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all group"
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        isBuy ? "bg-emerald-500/10" : "bg-red-500/10"
      )}>
        {isBuy
          ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          : <ArrowDownRight className="w-4 h-4 text-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground truncate">
            {trade.token_ticker || trade.token_name || "Unknown"}
          </span>
          <span className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded",
            isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          )}>
            {isBuy ? "BUY" : "SELL"}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {trade.trader_display_name || `${trade.wallet_address.slice(0, 4)}...${trade.wallet_address.slice(-4)}`}
        </span>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-bold text-foreground">{trade.amount_sol.toFixed(2)} SOL</div>
        <div className="text-[10px] text-muted-foreground">
          {format(new Date(trade.created_at), "HH:mm")}
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
      className="flex flex-col gap-2 p-3.5 rounded-xl bg-card/60 border border-border/50 hover:border-primary/30 transition-all group"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">{market.baseAsset}/{market.quoteAsset}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{market.maxLeverage}x</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-foreground">${parseFloat(market.lastPrice).toLocaleString()}</span>
        <span className={cn(
          "text-xs font-bold",
          isPositive ? "text-emerald-400" : "text-red-400"
        )}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground">Vol {formatVol}</div>
    </Link>
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
  const [quickBuyAmount, setQuickBuyAmount] = useState(0.3);
  const { solPrice } = useSolPrice();
  const { tokens, isLoading: tokensLoading } = useFunTokensPaginated(1, 20);
  const { newPairs: codexNewPairs, completing: codexCompleting, graduated: codexGraduated, isLoading: codexLoading } = useCodexNewPairs(SOLANA_NETWORK_ID);
  const { data: kolTweets } = useKolTweets("all");
  const { trades: alphaTrades, loading: alphaLoading } = useAlphaTrades(10);
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
          {/* Gradient bg */}
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

            {/* Feature pills */}
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

        {/* ═══ Mini Pulse Section ═══ */}
        <section className="max-w-7xl mx-auto px-4 py-6">
          <SectionHeader icon={Zap} title="Live Pulse" linkTo="/trade" linkLabel="Full Terminal" />
          <AxiomTerminalGrid
            tokens={tokens.slice(0, 5)}
            solPrice={solPrice}
            isLoading={tokensLoading || codexLoading}
            codexNewPairs={limitedNewPairs}
            codexCompleting={limitedCompleting}
            codexGraduated={limitedGraduated}
            quickBuyAmount={quickBuyAmount}
            onQuickBuyChange={setQuickBuyAmount}
          />
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
                <AlphaTradeRow key={t.id} trade={t} />
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
