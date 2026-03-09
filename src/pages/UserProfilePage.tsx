import { useParams, Link } from "react-router-dom";
import defaultAvatar from "@/assets/default-avatar.png";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { Loader2, ExternalLink, Copy, CheckCircle, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { VerifyAccountModal } from "@/components/launchpad/VerifyAccountModal";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { ProfileTradingStats } from "@/components/profile/ProfileTradingStats";
import { ProfilePositionsTab, ProfileActivityTab } from "@/components/profile/ProfileTradingTabs";
import { useQueryClient } from "@tanstack/react-query";
import { formatSol, truncateWallet } from "@/lib/tradeUtils";

export default function UserProfilePage() {
  const { identifier } = useParams<{ identifier: string }>();
  const { profile, isLoading, error, tokens, tokensLoading, trades, tradesLoading, alphaTrades, alphaTradesLoading, alphaPositions, tradingStats } = useUserProfile(identifier);
  const { profileId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const isOwnProfile = profileId && profile?.id === profileId && profile?.isRegistered !== false;
  const isRegistered = profile?.isRegistered !== false;
  const queryClient = useQueryClient();

  const copyWallet = () => {
    if (!profile?.solana_wallet_address) return;
    navigator.clipboard.writeText(profile.solana_wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isLoading) {
    return (
      <LaunchpadLayout hideFooter>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </LaunchpadLayout>
    );
  }

  if (error || !profile) {
    return (
      <LaunchpadLayout hideFooter>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">Profile not found</p>
          <Link to="/" className="text-primary text-xs hover:underline">← Back home</Link>
        </div>
      </LaunchpadLayout>
    );
  }

  const hasAlphaData = alphaTrades.length > 0;

  return (
    <LaunchpadLayout hideFooter>
      <div className="max-w-3xl mx-auto pb-16">
        {/* Cover */}
        <div className="h-32 md:h-40 rounded-t-lg bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 relative overflow-hidden border border-b-0 border-border/40">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover absolute inset-0" />
          )}
        </div>

        {/* Avatar + Info */}
        <div className="border border-border/40 bg-card rounded-b-lg px-4 md:px-6 pb-6 relative">
          <div className="flex items-end gap-4 -mt-10 md:-mt-12 mb-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-card bg-muted overflow-hidden shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.display_name || ""} className="w-full h-full object-cover" />
              ) : (
                <img src={defaultAvatar} alt="Default avatar" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold text-foreground truncate">
                  {profile.display_name || profile.username || truncateWallet(profile.solana_wallet_address)}
                </h1>
                {profile.verified_type && (
                  <VerifiedBadge type={profile.verified_type === "gold" ? "gold" : "blue"} className="w-4 h-4 shrink-0" />
                )}
                {!isRegistered && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/40">
                    Global Wallet
                  </span>
                )}
              </div>
              {profile.username && (
                <p className="text-muted-foreground text-sm font-mono">@{profile.username}</p>
              )}
            </div>
            {isOwnProfile && (
              <button
                onClick={() => setEditOpen(true)}
                className="ml-auto px-4 py-1.5 rounded-full text-xs font-bold border border-border text-foreground hover:bg-muted/50 transition-colors self-center shrink-0"
              >
                Edit profile
              </button>
            )}
          </div>

          {/* Wallet + Bio */}
          {profile.solana_wallet_address && (
            <button
              onClick={copyWallet}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors bg-muted/50 px-2 py-1 rounded mb-3"
            >
              {truncateWallet(profile.solana_wallet_address)}
              {copied ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>
          )}

          {isOwnProfile && isRegistered && !profile.verified_type && (
            <button
              onClick={() => setVerifyOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 mb-3"
            >
              <BadgeCheck className="w-3.5 h-3.5" />
              Verify Account
            </button>
          )}

          <EditProfileModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            profile={profile}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["user-profile", identifier] })}
          />

          <VerifyAccountModal open={verifyOpen} onOpenChange={setVerifyOpen} />

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 border border-border/30 rounded-lg p-3 bg-muted/20">
            <StatBox label="COINS HELD" value="—" />
            <StatBox label="COINS CREATED" value={tokens.length.toString()} />
            <StatBox label="FOLLOWERS" value={(profile.followers_count || 0).toString()} />
            <StatBox label="FOLLOWING" value={(profile.following_count || 0).toString()} />
          </div>

          <p className="text-[10px] text-muted-foreground/60 mt-3 font-mono uppercase tracking-wider">
            Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Trading Analytics */}
        {hasAlphaData && <ProfileTradingStats stats={tradingStats} />}

        {/* Tabs */}
        <Tabs defaultValue={hasAlphaData ? "positions" : "tokens"} className="mt-4">
          <TabsList className="bg-muted/30 border border-border/30 w-full justify-start">
            {hasAlphaData && (
              <>
                <TabsTrigger value="positions" className="font-mono text-xs uppercase tracking-wider">Positions</TabsTrigger>
                <TabsTrigger value="activity" className="font-mono text-xs uppercase tracking-wider">Activity</TabsTrigger>
              </>
            )}
            <TabsTrigger value="tokens" className="font-mono text-xs uppercase tracking-wider">Tokens</TabsTrigger>
            <TabsTrigger value="trades" className="font-mono text-xs uppercase tracking-wider">Trades</TabsTrigger>
          </TabsList>

          {hasAlphaData && (
            <>
              <TabsContent value="positions">
                <div className="border border-border/30 rounded-lg bg-card overflow-hidden">
                  <ProfilePositionsTab alphaTrades={alphaTrades} positions={alphaPositions} loading={alphaTradesLoading} />
                </div>
              </TabsContent>
              <TabsContent value="activity">
                <div className="border border-border/30 rounded-lg bg-card overflow-hidden">
                  <ProfileActivityTab alphaTrades={alphaTrades} loading={alphaTradesLoading} />
                </div>
              </TabsContent>
            </>
          )}

          <TabsContent value="tokens">
            <div className="border border-border/30 rounded-lg bg-card overflow-hidden">
              {tokensLoading ? (
                <div className="p-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : tokens.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground text-sm font-mono">No tokens created</p>
              ) : (
                <div className="divide-y divide-border/20">
                  {tokens.map((t) => (
                    <Link
                      key={t.id}
                      to={t.mint_address ? `/trade/${t.mint_address}` : "#"}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
                        {t.image_url ? (
                          <img src={t.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {t.ticker?.[0]}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate block">{t.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">${t.ticker}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-foreground">{formatSol(t.market_cap_sol)} SOL</span>
                        <span className={`block text-[10px] font-mono ${t.status === 'active' ? 'text-green-400' : 'text-muted-foreground'}`}>
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
            <div className="border border-border/30 rounded-lg bg-card overflow-hidden">
              {tradesLoading ? (
                <div className="p-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
              ) : trades.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground text-sm font-mono">No trades found</p>
              ) : (
                <div className="divide-y divide-border/20">
                  {trades.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        t.transaction_type === 'buy' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {t.transaction_type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono text-foreground">{formatSol(t.sol_amount)} SOL</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                        </span>
                        {t.signature && (
                          <a
                            href={`https://solscan.io/tx/${t.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary inline" />
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
    </LaunchpadLayout>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-sm md:text-base font-bold font-mono text-foreground">{value}</div>
      <div className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{label}</div>
    </div>
  );
}
