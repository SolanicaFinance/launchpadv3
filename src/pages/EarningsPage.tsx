import { useState } from "react";
import { Link } from "react-router-dom";
import { useLaunchpad, formatSolAmount } from "@/hooks/useLaunchpad";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  Loader2,
  DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { BRAND } from "@/config/branding";

export default function EarningsPage() {
  const { user, isAuthenticated, login, solanaAddress, profileId } = useAuth();
  const { useUserEarnings, claimFees } = useLaunchpad();
  const { toast } = useToast();
  const [claimingTokenId, setClaimingTokenId] = useState<string | null>(null);

  const { data: earningsData, isLoading, refetch } = useUserEarnings(
    solanaAddress,
    profileId
  );

  const handleClaim = async (tokenId: string) => {
    if (!solanaAddress) return;

    setClaimingTokenId(tokenId);
    try {
      const result = await claimFees.mutateAsync({
        tokenId,
        walletAddress: solanaAddress,
        profileId: profileId || undefined,
      });

      toast({
        title: "Fees claimed!",
        description: `You claimed ${formatSolAmount(result.claimedAmount)} SOL`,
      });

      refetch();
    } catch (error) {
      toast({
        title: "Claim failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setClaimingTokenId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-muted-foreground text-center mb-6">
            Connect your wallet to view your token earnings
          </p>
          <Button onClick={() => login()}>Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <img src={BRAND.logoPath} alt={BRAND.name} className="h-8 w-8 rounded-lg object-cover" />
            <span className="text-lg font-bold">SATURN</span>
          </Link>
          <h1 className="font-bold text-lg">Creator Earnings</h1>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Skeleton className="h-20 sm:h-24" />
            <Skeleton className="h-20 sm:h-24" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Card className="p-3 sm:p-4 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Total Earned
              </div>
              <p className="text-lg sm:text-2xl font-bold text-primary truncate">
                {formatSolAmount(earningsData?.summary?.totalEarned || 0)} SOL
              </p>
            </Card>
            <Card className="p-3 sm:p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Unclaimed
              </div>
              <p className="text-lg sm:text-2xl font-bold text-green-500 truncate">
                {formatSolAmount(earningsData?.summary?.totalUnclaimed || 0)} SOL
              </p>
            </Card>
          </div>
        )}

        {/* Token Earnings List */}
        <div className="space-y-3">
          <h2 className="font-semibold">Your Tokens</h2>

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))
          ) : earningsData?.earnings?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                You haven't created any tokens yet
              </p>
              <Link to="/launch">
                <Button>Launch Your First Token</Button>
              </Link>
            </Card>
          ) : (
            earningsData?.earnings?.map((earning: any) => (
              <Card key={earning.id} className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg shrink-0">
                      <AvatarImage src={earning.tokens?.image_url || undefined} />
                      <AvatarFallback className="rounded-lg text-xs sm:text-sm font-bold">
                        {earning.tokens?.ticker?.slice(0, 2) || "??"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate text-sm sm:text-base">
                          {earning.tokens?.name || "Unknown Token"}
                        </p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          ${earning.tokens?.ticker}
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-1">
                        <span>Earned: {formatSolAmount(earning.total_earned_sol || 0)} SOL</span>
                        <span className="text-green-500">
                          Claimable: {formatSolAmount(earning.unclaimed_sol || 0)} SOL
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <Link to={`/trade/${earning.tokens?.mint_address}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        View
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={
                        !earning.unclaimed_sol || 
                        earning.unclaimed_sol <= 0 || 
                        claimingTokenId === earning.token_id
                      }
                      onClick={() => handleClaim(earning.token_id)}
                    >
                      {claimingTokenId === earning.token_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Claim"
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Recent Claims */}
        {earningsData?.claims?.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Recent Claims</h2>
            {earningsData.claims.slice(0, 10).map((claim: any) => (
              <Card key={claim.id} className="p-3 flex items-center gap-3">
                <div className="bg-green-500/10 p-2 rounded-full">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    Claimed {formatSolAmount(claim.amount_sol)} SOL
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(claim.created_at).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`https://solscan.io/tx/${claim.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View Tx
                </a>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
