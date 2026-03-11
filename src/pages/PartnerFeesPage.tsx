import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Unlock, TrendingUp, Calendar, Clock, ExternalLink, RefreshCw, Download, Coins, BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BRAND } from "@/config/branding";

interface PartnerDistribution {
  id: string;
  fun_token_id: string | null;
  token_name: string | null;
  token_ticker: string | null;
  launchpad_type: string | null;
  fee_mode: string | null;
  amount_sol: number;
  signature: string | null;
  status: string;
  created_at: string;
}

interface Stats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

const PARTNER_PASSWORD = "partner777";

export default function PartnerFeesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [distributions, setDistributions] = useState<PartnerDistribution[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0, thisMonth: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all distributions
      const { data, error } = await supabase
        .from("partner_fee_distributions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const distributions = (data || []) as PartnerDistribution[];
      setDistributions(distributions);

      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats: Stats = {
        total: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      };

      for (const dist of distributions) {
        const amount = Number(dist.amount_sol) || 0;
        const createdAt = new Date(dist.created_at);

        stats.total += amount;
        if (createdAt >= todayStart) stats.today += amount;
        if (createdAt >= weekStart) stats.thisWeek += amount;
        if (createdAt >= monthStart) stats.thisMonth += amount;
      }

      setStats(stats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch partner data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchData]);

  const handleLogin = () => {
    if (password === PARTNER_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "Token", "Ticker", "Type", "Mode", "Amount SOL", "Signature"];
    const rows = distributions.map((d) => [
      new Date(d.created_at).toISOString(),
      d.token_name || "Unknown",
      d.token_ticker || "-",
      d.launchpad_type || "claw",
      d.fee_mode || "creator",
      d.amount_sol.toFixed(6),
      d.signature || "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partner-fees-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLaunchModeLabel = (type: string | null, mode: string | null) => {
    if (type === "bags") return "Bags";
    if (type === "pumpfun") return "Pump.fun";
    if (mode === "agent") return "Agent";
    if (mode === "api") return "API";
    if (mode === "holders") return "Holders";
    return "Standard";
  };

  const getLaunchModeBadgeClass = (type: string | null, mode: string | null) => {
    if (type === "bags") return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    if (type === "pumpfun") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (mode === "agent") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (mode === "api") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (mode === "holders") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-primary/20 text-primary border-primary/30";
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Partner Portal</h1>
            <p className="text-sm text-muted-foreground">Enter your password to view earnings</p>
          </div>

          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className={passwordError ? "border-destructive" : ""}
            />
            {passwordError && <p className="text-sm text-destructive">Invalid password</p>}
            <Button onClick={handleLogin} className="w-full">
              <Unlock className="w-4 h-4 mr-2" />
              Access Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Coins className="w-7 h-7 text-primary" />
              Partner Earnings Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Fee share from ${BRAND.name} launchpad (expires Feb 27, 2026)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Today</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.today.toFixed(4)} SOL</p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">This Week</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.thisWeek.toFixed(4)} SOL</p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-medium">This Month</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.thisMonth.toFixed(4)} SOL</p>
          </Card>

          <Card className="p-4 space-y-2 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.total.toFixed(4)} SOL</p>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent Transactions</h2>
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Token</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-right p-3 text-xs font-medium text-muted-foreground">TX</th>
                </tr>
              </thead>
              <tbody>
                {distributions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      {isLoading ? "Loading..." : "No transactions yet"}
                    </td>
                  </tr>
                ) : (
                  distributions.map((dist) => (
                    <tr key={dist.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{dist.token_name || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">${dist.token_ticker || "-"}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={getLaunchModeBadgeClass(dist.launchpad_type, dist.fee_mode)}
                        >
                          {getLaunchModeLabel(dist.launchpad_type, dist.fee_mode)}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {Number(dist.amount_sol).toFixed(6)} SOL
                        </span>
                      </td>
                      <td className="p-3 text-right text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(dist.created_at), { addSuffix: true })}
                      </td>
                      <td className="p-3 text-right">
                        {dist.signature ? (
                          <a
                            href={`https://solscan.io/tx/${dist.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {distributions.length > 0 && (
            <div className="p-3 border-t border-border bg-muted/30 text-xs text-muted-foreground text-center">
              Showing {distributions.length} transactions • Auto-refreshes every 30 seconds
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Partner wallet: 7Tegs2EwsK8icYHHryFvv5FwNxhQJMp2HhM2zVTq9uBh</p>
          <p className="mt-1">Partnership agreement expires: February 27, 2026</p>
        </div>
      </div>
    </div>
  );
}
