import { useState } from "react";
import { useLaunchpad, formatSolAmount } from "@/hooks/useLaunchpad";
import { useChain } from "@/contexts/ChainContext";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CheckCircle, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function PanelEarningsTab() {
  const { walletAddress: embeddedWallet } = useSolanaWalletWithPrivy();
  const { solanaAddress } = useAuth();
  const { chainConfig } = useChain();
  const { useUserEarnings } = useLaunchpad();
  const { toast } = useToast();
  const [claimingTokenId, setClaimingTokenId] = useState<string | null>(null);
  const MIN_CLAIM_SOL = 0.01;

  const activeAddress = embeddedWallet || solanaAddress;
  const currencySymbol = chainConfig.nativeCurrency.symbol;
  const explorerUrl = chainConfig.explorerUrl;

  // Pass only wallet — no profileId needed
  const { data: earningsData, isLoading, refetch } = useUserEarnings(activeAddress || undefined, undefined);

  const handleClaim = async () => {
    if (!activeAddress) return;
    setClaimingTokenId("all");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/claw-creator-claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
          },
          body: JSON.stringify({
            creatorWallet: activeAddress,
            payoutWallet: activeAddress,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Claim failed");
      }
      toast({ title: "Fees claimed!", description: `You claimed ${formatSolAmount(result.claimedAmount)} ${currencySymbol}` });
      refetch();
    } catch (error) {
      toast({ title: "Claim failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setClaimingTokenId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">
      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 bg-white/5 border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />Total Earned
            </div>
            <p className="text-lg font-bold" style={{ color: "#4ade80" }}>{formatSolAmount(earningsData?.summary?.totalEarned || 0)} {currencySymbol}</p>
          </Card>
          <Card className="p-3 bg-white/5 border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />Unclaimed
            </div>
            <p className="text-lg font-bold text-green-500">{formatSolAmount(earningsData?.summary?.totalUnclaimed || 0)} {currencySymbol}</p>
          </Card>
        </div>
      )}

      {/* Claim All Button */}
      {(earningsData?.summary?.totalUnclaimed || 0) >= MIN_CLAIM_SOL && (
        <Button
          className="w-full gap-2 font-mono bg-green-500 hover:bg-green-600 text-black border-0 font-bold"
          disabled={claimingTokenId === "all"}
          onClick={handleClaim}
        >
          {claimingTokenId === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DollarSign className="h-4 w-4" />
          )}
          Claim {formatSolAmount(earningsData?.summary?.totalUnclaimed || 0)} {currencySymbol}
        </Button>
      )}

      {(earningsData?.summary?.totalUnclaimed || 0) > 0 && (earningsData?.summary?.totalUnclaimed || 0) < MIN_CLAIM_SOL && (
        <p className="text-xs text-muted-foreground text-center font-mono">
          Minimum claim: {MIN_CLAIM_SOL} {currencySymbol}. Current: {formatSolAmount(earningsData?.summary?.totalUnclaimed || 0)} {currencySymbol}
        </p>
      )}

      {/* Payout wallet info */}
      {activeAddress && (
        <p className="text-[10px] text-muted-foreground text-center truncate px-4">
          Payouts go to your embedded wallet: {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
        </p>
      )}

      {/* Earnings list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Your Tokens</h2>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : earningsData?.earnings?.length === 0 ? (
          <Card className="p-8 text-center bg-white/5 border-white/10">
            <p className="text-muted-foreground mb-4">You haven't created any tokens yet</p>
            <Link to="/"><Button>Launch Your First Token</Button></Link>
          </Card>
        ) : (
          earningsData?.earnings?.map((earning: any) => (
            <Card key={earning.id} className="p-3 bg-white/[0.02] border-white/10">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 rounded-lg shrink-0">
                  <AvatarImage src={earning.tokens?.image_url || undefined} />
                  <AvatarFallback className="rounded-lg text-xs font-bold">{earning.tokens?.ticker?.slice(0, 2) || "??"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{earning.tokens?.name || "Unknown"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Earned: {formatSolAmount(earning.total_earned_sol || 0)}</span>
                    <span className="text-green-500">Claimable: {formatSolAmount(earning.unclaimed_sol || 0)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Creator: {earning.creator_fee_bps / 100}% · Total: {earning.trading_fee_bps / 100}%
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Recent claims */}
      {earningsData?.claims?.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Recent Claims</h2>
          {earningsData.claims.slice(0, 5).map((claim: any) => (
            <Card key={claim.id} className="p-3 flex items-center gap-3 bg-white/[0.02] border-white/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">{formatSolAmount(claim.amount_sol)} {currencySymbol}</p>
                <p className="text-xs text-muted-foreground">{new Date(claim.created_at).toLocaleDateString()}</p>
              </div>
              <a href={`${explorerUrl}/tx/${claim.signature}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View Tx</a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
