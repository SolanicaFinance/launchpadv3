import { useParams, Link } from "react-router-dom";
import defaultAvatar from "@/assets/moondexo-logo.png";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useUserProfile, isWalletAddress } from "@/hooks/useUserProfile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ExternalLink, Copy, CheckCircle, BadgeCheck, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, BarChart3, Wallet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VerifyAccountModal } from "@/components/launchpad/VerifyAccountModal";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { ProfilePositionsTab, ProfileActivityTab } from "@/components/profile/ProfileTradingTabs";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { formatSol, truncateWallet } from "@/lib/tradeUtils";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";

import { fetchBnbBalance } from "@/lib/bscRpc";

export default function UserProfilePage() {
  const { identifier } = useParams<{ identifier: string }>();
  const { profile, isLoading, error, tokens, tokensLoading, trades, tradesLoading, alphaTrades, alphaTradesLoading, alphaPositions, tradingStats, isBnb } = useUserProfile(identifier);
  const { profileId } = useAuth();

  const solWallet = profile?.solana_wallet_address ?? (identifier && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier) ? identifier : null);
  const evmWallet = profile?.evm_wallet_address ?? (identifier && /^0x[a-fA-F0-9]{40}$/.test(identifier) ? identifier : null);
  const wallet = isBnb ? evmWallet : solWallet;
  const currencyLabel = isBnb ? "BNB" : "SOL";
  const explorerBase = isBnb ? "https://bscscan.com" : "https://solscan.io";

  const { data: walletHoldings = [], isLoading: holdingsLoading } = useWalletHoldings(isBnb ? null : solWallet);

  // Balance query - chain aware
  const { data: nativeBalance } = useQuery({
    queryKey: ["profile-native-balance", wallet, isBnb],
    queryFn: async () => {
      if (!wallet) return null;
      if (isBnb) {
        return fetchBnbBalance(wallet);
      } else {
        const { url: rpcUrl } = getRpcUrl();
        const connection = new Connection(rpcUrl, "confirmed");
        const lamports = await connection.getBalance(new PublicKey(wallet));
        return lamports / LAMPORTS_PER_SOL;
      }
    },
    enabled: !!wallet,
    staleTime: 30_000,
  });

  const [copied, setCopied] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  const isOwnProfile = profileId && profile?.id === profileId && profile?.isRegistered !== false;
  const isRegistered = profile?.isRegistered !== false;
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const copyWallet = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <LaunchpadLayout>
        <div className="flex-1 min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </LaunchpadLayout>
    );
  }

  if (error || !profile) {
    return (
      <LaunchpadLayout>
        <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-2">
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">Profile not found</p>
          <Link to="/" className="text-primary text-xs hover:underline">← Back home</Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const displayName = profile.display_name || profile.username || truncateWallet(wallet || '');
  const hasAlphaData = alphaTrades.length > 0;
  const hasHoldings = walletHoldings.length > 0;
  const showPositionsTab = hasAlphaData || hasHoldings;
  const pnlPositive = tradingStats.realizedPnl >= 0;
  const totalTxns = tradingStats.totalBuys + tradingStats.totalSells;
  const maxDistCount = Math.max(...tradingStats.pnlDistribution.map((d) => d.count), 1);

  return (
    <LaunchpadLayout noPadding>
      <div>
        <div className="h-36 md:h-48 bg-gradient-to-r from-primary/20 via-primary/5 to-accent/20 relative overflow-hidden">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-20">
          {/* Avatar + Info Row */}
          <div className="relative -mt-14 md:-mt-16 flex items-end gap-4 md:gap-6 mb-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background bg-muted overflow-hidden shrink-0 shadow-lg">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <img src={defaultAvatar} alt="Default avatar" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">{displayName}</h1>
                {profile.verified_type && (
                  <VerifiedBadge type={profile.verified_type === "gold" ? "gold" : "blue"} className="w-5 h-5 shrink-0" />
                )}
                {!isRegistered && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/40">
                    Global Wallet
                  </span>
                )}
              </div>
              {profile.username && (
                <p className="text-muted-foreground text-sm font-mono mt-0.5">@{profile.username}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 self-center">
              {isOwnProfile && isRegistered && !profile.verified_type && (
                <button
                  onClick={() => setVerifyOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-2 rounded-lg border border-primary/20"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Verify
                </button>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-muted/50 transition-colors"
                >
                  Edit profile
                </button>
              )}
            </div>
          </div>

          {/* Wallet + Bio */}
          <div className="mb-6">
            {wallet && (
              <button
                onClick={copyWallet}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/30 mb-3"
              >
                {truncateWallet(wallet)}
                {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
            {profile.bio && (
              <p className="text-sm text-muted-foreground max-w-2xl">{profile.bio}</p>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Coins Held" value={holdingsLoading ? "..." : walletHoldings.length.toString()} />
            <StatCard label="Coins Created" value={tokens.length.toString()} />
            <StatCard label="Followers" value={(profile.followers_count || 0).toString()} />
            <StatCard label="Following" value={(profile.following_count || 0).toString()} />
          </div>

          <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider mb-6">
            Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
          </p>

          {/* Trading Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Balance Card */}
            <div className="border border-border/30 rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Balance</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">{currencyLabel} Balance</p>
                    <p className="text-lg font-bold font-mono text-foreground">
                      {nativeBalance !== null && nativeBalance !== undefined ? `${nativeBalance.toFixed(4)} ${currencyLabel}` : "—"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Total Bought</p>
                    <p className="text-sm font-bold font-mono text-foreground">{tradingStats.totalBuySol.toFixed(4)} {currencyLabel}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Total Sold</p>
                    <p className="text-sm font-bold font-mono text-foreground">{tradingStats.totalSellSol.toFixed(4)} {currencyLabel}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Card */}
            <div className="border border-border/30 rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", pnlPositive ? "bg-green-500/10" : "bg-red-500/10")}>
                  {pnlPositive ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Performance</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Total PnL</p>
                  <p className={cn("text-base font-bold font-mono", pnlPositive ? "text-green-400" : "text-red-400")}>
                    {pnlPositive ? "+" : ""}{tradingStats.totalPnl.toFixed(4)} {currencyLabel}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Realized PnL</p>
                  <p className={cn("text-base font-bold font-mono", pnlPositive ? "text-green-400" : "text-red-400")}>
                    {pnlPositive ? "+" : ""}{tradingStats.realizedPnl.toFixed(4)} {currencyLabel}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Total TXNs</p>
                  <p className="text-base font-bold font-mono text-foreground">
                    {totalTxns}{" "}
                    <span className="text-xs font-normal">
                      (<span className="text-green-400">{tradingStats.totalBuys} <ArrowUpRight className="w-3 h-3 inline" /></span>
                      {" / "}
                      <span className="text-red-400">{tradingStats.totalSells} <ArrowDownRight className="w-3 h-3 inline" /></span>)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* PnL Distribution Card */}
            <div className="border border-border/30 rounded-xl bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">PnL Distribution</span>
              </div>
              <div className="space-y-2.5">
                {tradingStats.pnlDistribution.map((bucket) => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground w-16 text-right shrink-0 leading-tight">{bucket.label}</span>
                    <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
                      <div
                        className={cn("h-full rounded transition-all duration-500", bucket.color)}
                        style={{
                          width: bucket.count > 0 ? `${Math.max((bucket.count / maxDistCount) * 100, 8)}%` : "0%",
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-foreground/70 w-6 text-right tabular-nums">{bucket.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue={showPositionsTab ? "positions" : trades.length > 0 ? "trades" : "tokens"} className="mt-2">
            <TabsList className="bg-muted/30 border border-border/30 w-full justify-start rounded-xl p-1">
              {showPositionsTab && (
                <TabsTrigger value="positions" className="font-mono text-xs uppercase tracking-wider rounded-lg">Positions</TabsTrigger>
              )}
              {hasAlphaData && (
                <TabsTrigger value="activity" className="font-mono text-xs uppercase tracking-wider rounded-lg">Activity</TabsTrigger>
              )}
              <TabsTrigger value="tokens" className="font-mono text-xs uppercase tracking-wider rounded-lg">Tokens</TabsTrigger>
              <TabsTrigger value="trades" className="font-mono text-xs uppercase tracking-wider rounded-lg">Trades</TabsTrigger>
            </TabsList>

            {showPositionsTab && (
              <TabsContent value="positions">
                <div className="border border-border/30 rounded-xl bg-card overflow-hidden">
                  <ProfilePositionsTab alphaTrades={alphaTrades} positions={alphaPositions} loading={alphaTradesLoading} onChainHoldings={walletHoldings} holdingsLoading={holdingsLoading} />
                </div>
              </TabsContent>
            )}
            {hasAlphaData && (
              <TabsContent value="activity">
                <div className="border border-border/30 rounded-xl bg-card overflow-hidden">
                  <ProfileActivityTab alphaTrades={alphaTrades} loading={alphaTradesLoading} />
                </div>
              </TabsContent>
            )}

            <TabsContent value="tokens">
              <div className="border border-border/30 rounded-xl bg-card overflow-hidden">
                {tokensLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : tokens.length === 0 ? (
                  <p className="p-8 text-center text-muted-foreground text-sm font-mono">No tokens created</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {tokens.map((t) => (
                      <Link
                        key={t.id}
                        to={t.mint_address ? `/trade/${t.mint_address}` : "#"}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                          {t.image_url ? (
                            <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                              {t.ticker?.[0]}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground truncate block">{t.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">${t.ticker}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono text-foreground">{formatSol(t.market_cap_sol)} {currencyLabel}</span>
                          <span className={cn("block text-[10px] font-mono", t.status === 'active' ? 'text-green-400' : 'text-muted-foreground')}>
                            {t.status?.toUpperCase() || "—"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="trades">
              <div className="border border-border/30 rounded-xl bg-card overflow-hidden">
                {tradesLoading ? (
                  <div className="p-8 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : trades.length === 0 ? (
                  <p className="p-8 text-center text-muted-foreground text-sm font-mono">No trades found</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {trades.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                        <span className={cn(
                          "text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-md",
                          t.transaction_type === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        )}>
                          {t.transaction_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-mono text-foreground">{formatSol(t.sol_amount)} {currencyLabel}</span>
                          {t.token_amount > 0 && (
                            <span className="text-[11px] text-muted-foreground font-mono ml-2">
                              ({t.token_amount.toLocaleString()} tokens)
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                          </span>
                          {t.signature && (
                            <a
                              href={isBnb ? `${explorerBase}/tx/${t.signature}` : `${explorerBase}/tx/${t.signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["user-profile", identifier] })}
        />
        <VerifyAccountModal open={verifyOpen} onOpenChange={setVerifyOpen} />
      </div>
    </LaunchpadLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/30 rounded-xl bg-card p-4 text-center">
      <div className="text-lg md:text-xl font-bold font-mono text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
