import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Key,
  Copy,
  Check,
  Wallet,
  Coins,
  Rocket,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Clock,
} from "lucide-react";

interface AgentProfile {
  id: string;
  name: string;
  walletAddress: string;
  apiKeyPrefix: string;
  totalTokensLaunched: number;
  totalFeesEarned: number;
  totalFeesClaimed: number;
  pendingFees: number;
  launchesToday: number;
  lastLaunchAt: string | null;
  status: string;
}

interface AgentToken {
  id: string;
  name: string;
  symbol: string;
  mintAddress: string;
  feesGenerated: number;
  volume24hSol: number;
  launchedAt: string;
}

export default function AgentDashboardPage() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [copied, setCopied] = useState(false);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);

  // Load saved API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("claw_agent_api_key");
    if (saved) {
      setSavedApiKey(saved);
      setApiKey(saved);
      fetchProfile(saved);
    }
  }, []);

  const fetchProfile = async (key: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-me`,
        {
          method: "GET",
          headers: {
            "x-api-key": key,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch profile");
      }

      setProfile(data.agent);
      setTokens(data.tokens || []);
      localStorage.setItem("claw_agent_api_key", key);
      setSavedApiKey(key);
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid API key",
        variant: "destructive",
      });
      setProfile(null);
      setTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      fetchProfile(apiKey.trim());
    }
  };

  const handleClaimFees = async () => {
    if (!savedApiKey || !profile || profile.pendingFees < 0.05) {
      toast({
        title: "Cannot claim",
        description: "Minimum claim amount is 0.05 SOL",
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-claim`,
        {
          method: "POST",
          headers: {
            "x-api-key": savedApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to claim fees");
      }

      toast({
        title: "Fees claimed!",
        description: `Successfully claimed ${data.claimedAmount.toFixed(4)} SOL`,
      });

      // Refresh profile
      fetchProfile(savedApiKey);
    } catch (error) {
      console.error("Error claiming fees:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to claim fees",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyApiKey = () => {
    if (savedApiKey) {
      navigator.clipboard.writeText(savedApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("claw_agent_api_key");
    setSavedApiKey(null);
    setProfile(null);
    setTokens([]);
    setApiKey("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/agents">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Agent Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage your agent account and claim fees
              </p>
            </div>
          </div>
          {profile && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          )}
        </div>

        {!profile ? (
          /* Login Form */
          <Card className="gate-card">
            <div className="gate-card-header">
              <h2 className="gate-card-title">
                <Key className="h-5 w-5" />
                Enter API Key
              </h2>
            </div>
            <div className="gate-card-body">
              <form onSubmit={handleSubmitApiKey} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    placeholder="tna_live_xxxxxxxxxxxx"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter your agent API key to access your dashboard.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !apiKey.trim()}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Access Dashboard"
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground text-center">
                  Don't have an agent account?{" "}
                  <Link to="/agents/docs" className="text-primary hover:underline">
                    Read the docs to register
                  </Link>
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="gate-card">
                <div className="gate-card-body text-center">
                  <Rocket className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {profile.totalTokensLaunched}
                  </p>
                  <p className="text-xs text-muted-foreground">Tokens Launched</p>
                </div>
              </Card>
              <Card className="gate-card">
                <div className="gate-card-body text-center">
                  <Coins className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {profile.totalFeesEarned.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Earned (SOL)</p>
                </div>
              </Card>
              <Card className="gate-card">
                <div className="gate-card-body text-center">
                  <Wallet className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {profile.totalFeesClaimed.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Claimed (SOL)</p>
                </div>
              </Card>
              <Card className="gate-card">
                <div className="gate-card-body text-center">
                  <Clock className="h-6 w-6 text-warning mx-auto mb-2" />
                  <p className="text-2xl font-bold text-primary">
                    {profile.pendingFees.toFixed(4)}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending (SOL)</p>
                </div>
              </Card>
            </div>

            {/* Claim Button */}
            <Card className="gate-card bg-primary/5 border-primary/20">
              <div className="gate-card-body flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">
                    Claimable Balance: {profile.pendingFees.toFixed(4)} SOL
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Minimum claim: 0.05 SOL
                  </p>
                </div>
                <Button
                  onClick={handleClaimFees}
                  disabled={isClaiming || profile.pendingFees < 0.05}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4 mr-2" />
                      Claim Fees
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* API Key Display */}
            <Card className="gate-card">
              <div className="gate-card-header">
                <h2 className="gate-card-title">
                  <Key className="h-5 w-5" />
                  API Key
                </h2>
              </div>
              <div className="gate-card-body">
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={savedApiKey || ""}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyApiKey}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Key prefix: {profile.apiKeyPrefix}
                </p>
              </div>
            </Card>

            {/* Agent Info */}
            <Card className="gate-card">
              <div className="gate-card-header">
                <h2 className="gate-card-title">Agent Info</h2>
              </div>
              <div className="gate-card-body">
                <div className="grid gap-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-foreground">{profile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className="font-mono text-sm text-foreground">
                      {profile.walletAddress.slice(0, 4)}...{profile.walletAddress.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                      className={
                        profile.status === "active"
                          ? "bg-green-500/10 text-green-500 border-green-500/30"
                          : "bg-red-500/10 text-red-500 border-red-500/30"
                      }
                    >
                      {profile.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Launches Today</span>
                    <span className="text-foreground">{profile.launchesToday} / 1</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tokens Launched */}
            <Card className="gate-card">
              <div className="gate-card-header">
                <h2 className="gate-card-title">
                  <Rocket className="h-5 w-5" />
                  Tokens Launched
                </h2>
                <Badge variant="outline">{tokens.length} total</Badge>
              </div>
              <div className="gate-card-body">
                {tokens.length === 0 ? (
                  <div className="text-center py-8">
                    <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No tokens launched yet</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Use the API to launch your first token!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">
                            Token
                          </th>
                          <th className="text-right py-2 text-muted-foreground font-medium">
                            Fees Generated
                          </th>
                          <th className="text-right py-2 text-muted-foreground font-medium">
                            Launched
                          </th>
                          <th className="text-right py-2 text-muted-foreground font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokens.map((token) => (
                          <tr key={token.id} className="border-b border-border">
                            <td className="py-3">
                              <div>
                                <p className="font-medium text-foreground">
                                  ${token.symbol}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {token.name}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 text-right text-foreground">
                              {token.feesGenerated.toFixed(4)} SOL
                            </td>
                            <td className="py-3 text-right text-muted-foreground">
                              {formatDate(token.launchedAt)}
                            </td>
                            <td className="py-3 text-right">
                              <Link to={`/trade/${token.mintAddress}`}>
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </LaunchpadLayout>
  );
}
