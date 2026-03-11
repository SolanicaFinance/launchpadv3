import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWalletTracker, TRACKER_TABS, type TrackerTab, shortAddr } from "@/hooks/useWalletTracker";
import { RefreshCw, Plus, Download, Upload, Trash2, Search, Wallet, Loader2, ArrowLeft, Bell, BellOff, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";

const g = "#00FFAA";
const r = "#FF4D4D";
const dim = "#888";
const muted = "#AAAAAA";
const cardBg = "#1A1A1A";
const f = "'Inter','SF Pro Display',-apple-system,sans-serif";

export default function WalletTrackerPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TrackerTab>("All");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(true);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const {
    isAuthenticated,
    login,
    wallets,
    loading,
    adding,
    fetchWallets,
    addWallet,
    removeWallet,
    removeAll,
  } = useWalletTracker();

  const handleAdd = async () => {
    const ok = await addWallet(newAddr, newLabel);
    if (ok) {
      setNewAddr("");
      setNewLabel("");
    }
  };

  const filtered = wallets.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.wallet_address.toLowerCase().includes(q) ||
      (w.wallet_label || "").toLowerCase().includes(q)
    );
  });

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full pb-14">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: g }} />
              <Wallet className="w-5 h-5 text-foreground" />
              <h1 className="text-xl font-bold text-foreground">Wallet Tracker</h1>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <span className="ml-auto text-sm text-muted-foreground">{wallets.length} wallets tracked</span>
            <button
              onClick={() => fetchWallets()}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Connect to track wallets</p>
              <button
                onClick={login}
                className="px-6 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: g, color: "#000" }}
              >
                Connect Wallet
              </button>
            </div>
          ) : (
            <>
              {/* Tabs + Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="flex gap-1">
                  {TRACKER_TABS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      style={{
                        background: activeTab === t ? "#222" : "transparent",
                        color: activeTab === t ? "#fff" : "#7080BB",
                        fontWeight: activeTab === t ? 700 : 400,
                        fontFamily: f,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex-1" />

                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or address..."
                      className="bg-secondary border border-border rounded-lg py-2 pl-9 pr-4 text-sm text-foreground outline-none w-64"
                      style={{ fontFamily: f }}
                    />
                  </div>
                  <ToolBtn icon={<Download className="w-4 h-4" />} label="Import" onClick={() => {}} />
                  <ToolBtn icon={<Upload className="w-4 h-4" />} label="Export" onClick={() => {}} />
                  <ToolBtn icon={<Plus className="w-4 h-4" />} label="Add Wallet" highlight onClick={() => setShowAddForm(!showAddForm)} />
                </div>
              </div>

              {/* Add Form */}
              {showAddForm && (
                <div className="border border-border rounded-xl p-4 mb-4" style={{ background: cardBg }}>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Wallet Address</label>
                      <input
                        value={newAddr}
                        onChange={(e) => setNewAddr(e.target.value)}
                        placeholder="Enter Solana wallet address"
                        className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground outline-none"
                        style={{ fontFamily: f }}
                      />
                    </div>
                    <div className="w-48">
                      <label className="text-xs text-muted-foreground mb-1 block">Label (optional)</label>
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. Smart Money 1"
                        className="w-full bg-background border border-border rounded-lg py-2 px-3 text-sm text-foreground outline-none"
                        style={{ fontFamily: f }}
                      />
                    </div>
                    <button
                      onClick={handleAdd}
                      disabled={adding || !newAddr.trim()}
                      className="px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
                      style={{ background: g, color: "#000", fontFamily: f }}
                    >
                      {adding ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="border border-border rounded-xl overflow-hidden" style={{ background: cardBg }}>
                {/* Table Header */}
                <div
                  className="grid gap-2 px-4 py-3 border-b border-border"
                  style={{
                    gridTemplateColumns: "80px 1fr 180px 100px 100px 90px 80px 80px 40px",
                    fontFamily: f,
                  }}
                >
                  <span className="text-xs font-medium text-muted-foreground">Added</span>
                  <span className="text-xs font-medium text-muted-foreground">Label</span>
                  <span className="text-xs font-medium text-muted-foreground">Address</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">Balance (SOL)</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">Last Active</span>
                  <span className="text-xs font-medium text-muted-foreground text-right">PnL (SOL)</span>
                  <span className="text-xs font-medium text-muted-foreground text-center">Copy Trade</span>
                  <span className="text-xs font-medium text-muted-foreground text-center">Alerts</span>
                  <button
                    onClick={removeAll}
                    title="Remove All"
                    className="flex items-center justify-center"
                    style={{ color: r }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Rows */}
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm" style={{ fontFamily: f }}>
                    {loading ? "Loading wallets..." : wallets.length === 0 ? "No wallets tracked yet. Add one above to get started." : "No matches found"}
                  </div>
                ) : (
                  filtered.map((w) => (
                    <div
                      key={w.id}
                      className="grid gap-2 px-4 py-3 items-center border-b border-border/50 hover:bg-secondary/50 transition-colors"
                      style={{
                        gridTemplateColumns: "80px 1fr 180px 100px 100px 90px 80px 80px 40px",
                        fontFamily: f,
                      }}
                    >
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(w.created_at), { addSuffix: false }).replace("about ", "")}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">
                        {w.wallet_label || "—"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">{shortAddr(w.wallet_address)}</span>
                        <button
                          onClick={() => copyAddr(w.wallet_address)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-right" style={{ color: w.balance !== null ? "#fff" : dim }}>
                        {w.balance !== null ? w.balance.toFixed(2) : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground text-right">
                        {w.lastActive
                          ? formatDistanceToNow(new Date(w.lastActive), { addSuffix: false }).replace("about ", "")
                          : "—"}
                      </span>
                      <span
                        className="text-sm font-semibold text-right"
                        style={{ color: (w.total_pnl_sol ?? 0) >= 0 ? g : r }}
                      >
                        {w.total_pnl_sol !== null ? `${w.total_pnl_sol >= 0 ? "+" : ""}${w.total_pnl_sol.toFixed(2)}` : "—"}
                      </span>
                      <div className="flex justify-center">
                        <Switch checked={w.is_copy_trading_enabled} />
                      </div>
                      <div className="flex justify-center">
                        {w.notifications_enabled ? (
                          <Bell className="w-4 h-4" style={{ color: g }} />
                        ) : (
                          <BellOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <button
                        onClick={() => removeWallet(w.id)}
                        className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
      style={{
        border: highlight ? "none" : "1px solid #2a2a2a",
        background: highlight ? g : cardBg,
        color: highlight ? "#000" : "#ccc",
        fontFamily: "'Inter',sans-serif",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
