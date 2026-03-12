import { useState } from "react";
import { useLaunchpad, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { useChain } from "@/contexts/ChainContext";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, CheckCircle, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

export default function PanelEarningsTab() {
  const { solanaAddress, profileId } = useAuth();
  const { chain, chainConfig } = useChain();
  const { address: evmAddress } = usePrivyEvmWallet();
  const { useUserEarnings, claimFees } = useLaunchpad();
  const { toast } = useToast();
  const [claimingTokenId, setClaimingTokenId] = useState<string | null>(null);
  const MIN_CLAIM_SOL = 0.05;

  const activeAddress = chain === 'solana' ? solanaAddress : evmAddress;
  const currencySymbol = chainConfig.nativeCurrency.symbol;
  const explorerUrl = chainConfig.explorerUrl;

  const { data: earningsData, isLoading, refetch } = useUserEarnings(activeAddress, profileId);

  const handleClaim = async (tokenId: string) => {
    if (!activeAddress) return;
    setClaimingTokenId(tokenId);
    try {
      const result = await claimFees.mutateAsync({
        tokenId,
        walletAddress: activeAddress,
        profileId: profileId || undefined,
      });
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
                </div>
                <Button
                  size="sm" className="h-8 text-xs"
                  disabled={!earning.unclaimed_sol || earning.unclaimed_sol < MIN_CLAIM_SOL || claimingTokenId === earning.token_id}
                  onClick={() => handleClaim(earning.token_id)}
                >
                  {claimingTokenId === earning.token_id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : earning.unclaimed_sol < MIN_CLAIM_SOL
                      ? "Min 0.05"
                      : "Claim"}
                </Button>
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
