import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Play, Pause, Loader2, RefreshCw, Zap, Users, Coins, Activity } from "lucide-react";

const ADMIN_PW = () => localStorage.getItem("admin_panel_auth_v2") || "";

function callBrandDust(body: Record<string, unknown>) {
  return supabase.functions.invoke("brand-dust", {
    body: { ...body, adminPassword: ADMIN_PW() },
  });
}

interface Campaign {
  id: string;
  name: string;
  wallet_address: string;
  is_active: boolean;
  batch_size: number;
  lamports_per_recipient: number;
  total_sent: number;
  total_unique_wallets: number;
  total_sol_spent: number;
  total_txs: number;
  last_run_at: string | null;
  last_error: string | null;
}

interface RunLog {
  id: string;
  wallets_targeted: number;
  wallets_sent: number;
  txs_sent: number;
  sol_spent: number;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

export function DustCampaignTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("Brand Awareness");
  const [newWallet, setNewWallet] = useState("");
  const [newPrivKey, setNewPrivKey] = useState("");
  const [newBatch, setNewBatch] = useState("10");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const { data } = await callBrandDust({ action: "status" });
    if (data?.campaigns) setCampaigns(data.campaigns);
    if (data?.recentRuns) setRecentRuns(data.recentRuns);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleCreate = async () => {
    if (!newWallet || !newPrivKey) {
      toast.error("Wallet address and private key required");
      return;
    }
    const { data, error } = await callBrandDust({
      action: "create",
      name: newName,
      walletAddress: newWallet,
      walletPrivateKey: newPrivKey,
      batchSize: parseInt(newBatch) || 10,
    });
    if (error || data?.error) {
      toast.error(data?.error || "Failed to create campaign");
      return;
    }
    toast.success("Campaign created!");
    setShowCreate(false);
    setNewPrivKey("");
    fetchStatus();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await callBrandDust({ action: "toggle", campaignId: id, isActive });
    fetchStatus();
  };

  const handleExecute = async (id: string) => {
    setExecuting(id);
    const { data, error } = await callBrandDust({ action: "execute", campaignId: id });
    setExecuting(null);
    if (error || data?.error) {
      toast.error(data?.error || "Execution failed");
    } else {
      toast.success(`Sent to ${data?.sent || 0} wallets in ${data?.txs || 0} TXs`);
    }
    fetchStatus();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Brand Dust Campaigns</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "New Campaign"}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Create Campaign</h3>
          <Input placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Vanity wallet address" value={newWallet} onChange={(e) => setNewWallet(e.target.value)} className="font-mono text-xs" />
          <Input placeholder="Private key (hex)" type="password" value={newPrivKey} onChange={(e) => setNewPrivKey(e.target.value)} className="font-mono text-xs" />
          <div className="flex gap-2 items-center">
            <Input placeholder="Batch size" type="number" value={newBatch} onChange={(e) => setNewBatch(e.target.value)} className="w-32" />
            <span className="text-xs text-muted-foreground">recipients per TX (max ~20)</span>
          </div>
          <Button onClick={handleCreate} className="w-full">Create Campaign</Button>
        </div>
      )}

      {/* Campaigns */}
      {campaigns.map((c) => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">{c.name}</h3>
              <p className="text-xs text-muted-foreground font-mono">{c.wallet_address}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={c.is_active ? "destructive" : "default"}
                onClick={() => handleToggle(c.id, !c.is_active)}
              >
                {c.is_active ? <><Pause className="w-3.5 h-3.5 mr-1" /> Stop</> : <><Play className="w-3.5 h-3.5 mr-1" /> Start</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExecute(c.id)}
                disabled={executing === c.id}
              >
                {executing === c.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                Run Now
              </Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Wallets Reached" value={c.total_unique_wallets?.toLocaleString() || "0"} />
            <StatCard icon={<Activity className="w-4 h-4" />} label="Total TXs" value={c.total_txs?.toLocaleString() || "0"} />
            <StatCard icon={<Coins className="w-4 h-4" />} label="SOL Spent" value={`${(c.total_sol_spent || 0).toFixed(6)}`} />
            <StatCard icon={<Zap className="w-4 h-4" />} label="Batch Size" value={`${c.batch_size} / TX`} />
          </div>

          {c.last_run_at && (
            <p className="text-xs text-muted-foreground">
              Last run: {new Date(c.last_run_at).toLocaleString()}
              {c.last_error && <span className="text-destructive ml-2">Error: {c.last_error}</span>}
            </p>
          )}
        </div>
      ))}

      {!campaigns.length && !loading && (
        <p className="text-center text-muted-foreground py-8">No campaigns yet. Create one to get started.</p>
      )}

      {/* Recent run logs */}
      {recentRuns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Recent Runs</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentRuns.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
                <span className="text-foreground">
                  {r.wallets_sent}/{r.wallets_targeted} sent · {r.txs_sent} TXs · {(r.sol_spent || 0).toFixed(6)} SOL · {r.duration_ms}ms
                </span>
                {r.error_message && <span className="text-destructive truncate max-w-48">{r.error_message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-sm font-bold text-foreground font-mono">{value}</div>
    </div>
  );
}
