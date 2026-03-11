import { useState } from "react";
import { useReferralCode, useReferralDashboard } from "@/hooks/useReferral";
import { Copy, CheckCircle, Users, DollarSign, TrendingUp, ExternalLink, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import QRCode from "react-qr-code";

function formatSol(n: number) {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n > 0 ? n.toFixed(6) : "0.00";
}

function shortenWallet(w: string) {
  return w ? `${w.slice(0, 4)}...${w.slice(-4)}` : "—";
}

export default function PanelReferralsTab() {
  const { toast } = useToast();
  const { referralCode, referralLink, referralCount, loading: codeLoading } = useReferralCode();
  const { stats, recentReferrals, recentRewards, loading } = useReferralDashboard();
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const REWARD_PCT = 5;

  return (
    <div className="space-y-6 pb-8">
      {/* Referral Link Card */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(234,88,12,0.04))",
          border: "1px solid rgba(249,115,22,0.2)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift className="h-4 w-4 text-[#F97316]" />
          <h3 className="text-sm font-bold text-foreground">Your Referral Link</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Earn <span className="text-[#F97316] font-bold">{REWARD_PCT}%</span> of trading fees from users who sign up through your link.
        </p>

        {/* Link + Copy */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 px-3 py-2 rounded-xl text-xs font-mono text-foreground/80 truncate"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(51,65,85,0.3)" }}
          >
            {referralLink || "Loading..."}
          </div>
          <Button
            onClick={copyLink}
            size="sm"
            className="gap-1.5 rounded-xl shrink-0"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", color: "#fff" }}
            disabled={!referralLink}
          >
            {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {/* QR Code */}
        {referralLink && (
          <div className="mt-4 flex justify-center">
            <div className="bg-white rounded-xl p-3">
              <QRCode value={referralLink} size={120} />
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4 text-[#22D3EE]" />}
          label="Referrals"
          value={String(stats.totalReferrals)}
          accent="#22D3EE"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-[#10B981]" />}
          label="Total Earned"
          value={`${formatSol(stats.totalRewardsSol)} SOL`}
          accent="#10B981"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-[#F97316]" />}
          label="This Month"
          value={`${formatSol(stats.rewardsThisMonth)} SOL`}
          accent="#F97316"
        />
      </div>

      {/* Recent Referrals */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Recent Sign-ups
        </h3>
        {recentReferrals.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.2)" }}
          >
            <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No referrals yet. Share your link to start earning!</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentReferrals.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#22D3EE]/10 flex items-center justify-center">
                    <Users className="h-3 w-3 text-[#22D3EE]" />
                  </div>
                  <span className="text-xs font-mono text-foreground/70">
                    {ref.referred_wallet ? shortenWallet(ref.referred_wallet) : "Anonymous"}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(ref.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Rewards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Recent Rewards
        </h3>
        {recentRewards.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.2)" }}
          >
            <DollarSign className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No rewards yet. You earn {REWARD_PCT}% when your referrals trade.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentRewards.map((rw) => (
              <div
                key={rw.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.15)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                    <DollarSign className="h-3 w-3 text-[#10B981]" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-[#10B981]">
                      +{formatSol(Number(rw.reward_sol))} SOL
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2">
                      from {formatSol(Number(rw.trade_sol_amount))} SOL trade
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(rw.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.2)" }}
      >
        <h3 className="text-xs font-bold text-foreground mb-2">How Referral Rewards Work</h3>
        <ol className="text-[11px] text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Share your unique referral link with friends</li>
          <li>They sign up and start trading on MoonDexo</li>
          <li>You earn <span className="text-[#F97316] font-semibold">{REWARD_PCT}%</span> of their trading fees automatically</li>
          <li>Rewards are tracked in real-time and shown here</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: `linear-gradient(135deg, ${accent}08, ${accent}04)`,
        border: `1px solid ${accent}20`,
      }}
    >
      <div className="flex justify-center mb-1.5">{icon}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
