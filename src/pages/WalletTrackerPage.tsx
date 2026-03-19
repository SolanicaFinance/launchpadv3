import { useState, useEffect, useCallback, useRef } from "react";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWalletTracker, TRACKER_TABS, type TrackerTab, shortAddr } from "@/hooks/useWalletTracker";
import { useTradeSounds } from "@/hooks/useTradeSounds";
import { RefreshCw, Plus, Download, Upload, Trash2, Search, Wallet, Loader2, ArrowLeft, Bell, BellOff, Copy, TrendingUp, TrendingDown, Settings, Eye, Activity, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const g = "#00FFAA";
const r = "#FF4D4D";
const dim = "#888";
const muted = "#AAAAAA";
const cardBg = "#1A1A1A";
const f = "'Inter','SF Pro Display',-apple-system,sans-serif";

interface WalletTrade {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  signature: string;
  created_at: string;
}

export default function WalletTrackerPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TrackerTab>("All");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(true);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [showCopyTradeInfo, setShowCopyTradeInfo] = useState(false);

  const { playBuy, playSell } = useTradeSounds();

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
    toggleNotifications,
    toggleCopyTrading,
  } = useWalletTracker();

  // Use ref for addresses to avoid tab reset when wallets refresh
  const addressesRef = useRef<string[]>([]);
  useEffect(() => {
    const newAddrs = wallets.map(w => w.wallet_address).sort().join(",");
    const oldAddrs = addressesRef.current.sort().join(",");
    if (newAddrs !== oldAddrs) {
      addressesRef.current = wallets.map(w => w.wallet_address);
    }
  }, [wallets]);

  const handleAdd = async () => {
    const ok = await addWallet(newAddr, newLabel);
    if (ok) {
      setNewAddr("");
      setNewLabel("");
    }
  };

  const handleCopyTradeToggle = (walletId: string, checked: boolean) => {
    if (checked) {
      setShowCopyTradeInfo(true);
    }
    // Don't actually enable - holders only
  };

  // Fetch trades for tracked wallets
  const fetchTrades = useCallback(async () => {
    const addresses = addressesRef.current;
    if (addresses.length === 0) return;
    setTradesLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallet_trades')
        .select('*')
        .in('wallet_address', addresses)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setTrades(data as WalletTrade[]);
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    } finally {
      setTradesLoading(false);
    }
  }, []);

  // Fetch trades only when tab switches to Trades (not on wallet refresh)
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (activeTab === "Trades" && addressesRef.current.length > 0) {
      fetchTrades();
    }
  }, [activeTab, fetchTrades]);

  // Realtime subscription for trade notifications
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  useEffect(() => {
    const channel = supabase
      .channel('wallet-tracker-trades-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_trades' },
        (payload) => {
          const trade = payload.new as WalletTrade;
          const trackedWallet = walletsRef.current.find(
            w => w.wallet_address === trade.wallet_address && w.notifications_enabled
          );
          if (trackedWallet) {
            // Play sound
            if (trade.trade_type === 'buy') {
              playBuy();
            } else {
              playSell();
            }
            // Show toast
            const label = trackedWallet.wallet_label || shortAddr(trade.wallet_address);
            const tokenLabel = trade.token_ticker || trade.token_name || shortAddr(trade.token_mint);
            toast({
              title: `${trade.trade_type === 'buy' ? '🟢 Buy' : '🔴 Sell'} — ${label}`,
              description: `${trade.sol_amount.toFixed(3)} SOL → ${tokenLabel}`,
            });
          }
          // Also append to trades list if on Trades tab
          if (activeTabRef.current === "Trades") {
            setTrades(prev => [trade, ...prev].slice(0, 100));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playBuy, playSell]);

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

  const getWalletLabel = (addr: string) => {
    const w = wallets.find(w => w.wallet_address === addr);
    return w?.wallet_label || shortAddr(addr);
  };

  // Tab content renderers
  const renderAllTab = () => (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: cardBg }}>
      <div
        className="grid gap-2 px-4 py-3 border-b border-border"
        style={{ gridTemplateColumns: "80px 1fr 180px 100px 100px 90px 80px 80px 40px", fontFamily: f }}
      >
        <span className="text-xs font-medium text-muted-foreground">Added</span>
        <span className="text-xs font-medium text-muted-foreground">Label</span>
        <span className="text-xs font-medium text-muted-foreground">Address</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Balance (SOL)</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Last Active</span>
        <span className="text-xs font-medium text-muted-foreground text-right">PnL (SOL)</span>
        <span className="text-xs font-medium text-muted-foreground text-center">Copy Trade</span>
        <span className="text-xs font-medium text-muted-foreground text-center">Alerts</span>
        <button onClick={removeAll} title="Remove All" className="flex items-center justify-center" style={{ color: r }}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm" style={{ fontFamily: f }}>
          {loading ? "Loading wallets..." : wallets.length === 0 ? "No wallets tracked yet. Add one above to get started." : "No matches found"}
        </div>
      ) : (
        filtered.map((w) => (
          <div
            key={w.id}
            className="grid gap-2 px-4 py-3 items-center border-b border-border/50 hover:bg-secondary/50 transition-colors"
            style={{ gridTemplateColumns: "80px 1fr 180px 100px 100px 90px 80px 80px 40px", fontFamily: f }}
          >
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(w.created_at), { addSuffix: false }).replace("about ", "")}
            </span>
            <span className="text-sm font-semibold text-foreground truncate">{w.wallet_label || "—"}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">{shortAddr(w.wallet_address)}</span>
              <button onClick={() => copyAddr(w.wallet_address)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <span className="text-sm font-semibold text-right" style={{ color: w.balance !== null ? "#fff" : dim }}>
              {w.balance !== null ? w.balance.toFixed(2) : "—"}
            </span>
            <span className="text-xs text-muted-foreground text-right">
              {w.lastActive ? formatDistanceToNow(new Date(w.lastActive), { addSuffix: false }).replace("about ", "") : "—"}
            </span>
            <span className="text-sm font-semibold text-right" style={{ color: (w.total_pnl_sol ?? 0) >= 0 ? g : r }}>
              {w.total_pnl_sol !== null ? `${w.total_pnl_sol >= 0 ? "+" : ""}${w.total_pnl_sol.toFixed(2)}` : "—"}
            </span>
            <div className="flex justify-center">
              <Switch
                checked={w.is_copy_trading_enabled}
                onCheckedChange={(checked) => handleCopyTradeToggle(w.id, checked)}
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggleNotifications(w.id, !w.notifications_enabled)}
                className="transition-colors"
              >
                {w.notifications_enabled ? <Bell className="w-4 h-4" style={{ color: g }} /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
            <button onClick={() => removeWallet(w.id)} className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))
      )}
    </div>
  );

  const renderManagerTab = () => (
    <div className="space-y-4">
      {/* Add Form always visible in Manager */}
      <div className="border border-border rounded-xl p-4" style={{ background: cardBg }}>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: g }} /> Add Wallet
        </h3>
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

      {/* Wallet management list */}
      <div className="border border-border rounded-xl overflow-hidden" style={{ background: cardBg }}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" /> Manage Wallets ({wallets.length})
          </h3>
          <div className="flex gap-2">
            <ToolBtn icon={<Download className="w-4 h-4" />} label="Import" onClick={() => {}} />
            <ToolBtn icon={<Upload className="w-4 h-4" />} label="Export" onClick={() => {}} />
            <button
              onClick={removeAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ border: "1px solid #2a2a2a", background: cardBg, color: r, fontFamily: f }}
            >
              <Trash2 className="w-4 h-4" /> Remove All
            </button>
          </div>
        </div>
        {wallets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No wallets tracked yet</div>
        ) : (
          wallets.map((w) => (
            <div key={w.id} className="px-4 py-3 border-b border-border/50 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{w.wallet_label || "Unlabeled"}</div>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  {w.wallet_address}
                  <button onClick={() => copyAddr(w.wallet_address)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Added {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Copy</label>
                <Switch
                  checked={w.is_copy_trading_enabled}
                  onCheckedChange={(checked) => handleCopyTradeToggle(w.id, checked)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Alerts</label>
                <Switch
                  checked={w.notifications_enabled}
                  onCheckedChange={(checked) => toggleNotifications(w.id, checked)}
                />
              </div>
              <button onClick={() => removeWallet(w.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTradesTab = () => (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: cardBg }}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: g }} /> Recent Trades
        </h3>
        <button onClick={fetchTrades} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div
        className="grid gap-2 px-4 py-2 border-b border-border"
        style={{ gridTemplateColumns: "1fr 100px 80px 90px 90px 140px", fontFamily: f }}
      >
        <span className="text-xs font-medium text-muted-foreground">Wallet</span>
        <span className="text-xs font-medium text-muted-foreground">Token</span>
        <span className="text-xs font-medium text-muted-foreground text-center">Type</span>
        <span className="text-xs font-medium text-muted-foreground text-right">SOL</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Tokens</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Time</span>
      </div>
      {tradesLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading trades...
        </div>
      ) : trades.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {wallets.length === 0 ? "Add wallets to see their trades" : "No trades recorded yet. Trades appear as tracked wallets make swaps."}
        </div>
      ) : (
        trades.map((t) => (
          <div
            key={t.id}
            className="grid gap-2 px-4 py-2.5 items-center border-b border-border/50 hover:bg-secondary/50 transition-colors"
            style={{ gridTemplateColumns: "1fr 100px 80px 90px 90px 140px", fontFamily: f }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{getWalletLabel(t.wallet_address)}</span>
            </div>
            <span className="text-xs font-semibold text-foreground truncate">{t.token_ticker || t.token_name || shortAddr(t.token_mint)}</span>
            <div className="flex justify-center">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{
                  background: t.trade_type === 'buy' ? 'rgba(0,255,170,0.15)' : 'rgba(255,77,77,0.15)',
                  color: t.trade_type === 'buy' ? g : r,
                }}
              >
                {t.trade_type === 'buy' ? (
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> BUY</span>
                ) : (
                  <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> SELL</span>
                )}
              </span>
            </div>
            <span className="text-sm font-semibold text-right text-foreground">{t.sol_amount.toFixed(3)}</span>
            <span className="text-xs text-muted-foreground text-right">{t.token_amount >= 1000000 ? `${(t.token_amount / 1000000).toFixed(1)}M` : t.token_amount >= 1000 ? `${(t.token_amount / 1000).toFixed(1)}K` : t.token_amount.toFixed(0)}</span>
            <span className="text-xs text-muted-foreground text-right">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
          </div>
        ))
      )}
    </div>
  );

  const renderMonitorTab = () => (
    <div className="space-y-4">
      {/* Monitor summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-xl p-4" style={{ background: cardBg }}>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4" style={{ color: g }} />
            <span className="text-xs text-muted-foreground font-medium">Wallets Monitored</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{wallets.length}</span>
        </div>
        <div className="border border-border rounded-xl p-4" style={{ background: cardBg }}>
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4" style={{ color: g }} />
            <span className="text-xs text-muted-foreground font-medium">Alerts Enabled</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{wallets.filter(w => w.notifications_enabled).length}</span>
        </div>
        <div className="border border-border rounded-xl p-4" style={{ background: cardBg }}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4" style={{ color: g }} />
            <span className="text-xs text-muted-foreground font-medium">Copy Trading</span>
          </div>
          <span className="text-2xl font-bold text-foreground">{wallets.filter(w => w.is_copy_trading_enabled).length}</span>
        </div>
      </div>

      {/* Active wallets with last activity */}
      <div className="border border-border rounded-xl overflow-hidden" style={{ background: cardBg }}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Eye className="w-4 h-4" style={{ color: g }} /> Live Activity Monitor
          </h3>
        </div>
        {wallets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Add wallets to start monitoring</div>
        ) : (
          wallets
            .sort((a, b) => {
              if (!a.lastActive && !b.lastActive) return 0;
              if (!a.lastActive) return 1;
              if (!b.lastActive) return -1;
              return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
            })
            .map((w) => (
              <div key={w.id} className="px-4 py-3 border-b border-border/50 flex items-center gap-4 hover:bg-secondary/50 transition-colors">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: w.lastActive && (Date.now() - new Date(w.lastActive).getTime()) < 1000 * 60 * 30 ? g : dim,
                    boxShadow: w.lastActive && (Date.now() - new Date(w.lastActive).getTime()) < 1000 * 60 * 30 ? `0 0 6px ${g}` : 'none',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">{w.wallet_label || shortAddr(w.wallet_address)}</span>
                  {w.wallet_label && <span className="text-xs text-muted-foreground ml-2 font-mono">{shortAddr(w.wallet_address)}</span>}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{w.balance !== null ? `${w.balance.toFixed(2)} SOL` : "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.lastActive ? `Active ${formatDistanceToNow(new Date(w.lastActive), { addSuffix: true })}` : "No activity"}
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <button onClick={() => toggleNotifications(w.id, !w.notifications_enabled)}>
                    {w.notifications_enabled ? (
                      <Bell className="w-4 h-4" style={{ color: g }} />
                    ) : (
                      <BellOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full pb-14">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: g }} />
              <Wallet className="w-5 h-5 text-foreground" />
              <h1 className="text-xl font-bold text-foreground">Wallet Tracker</h1>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <span className="ml-auto text-sm text-muted-foreground">{wallets.length} wallets tracked</span>
            <button onClick={() => fetchWallets()} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Connect to track wallets</p>
              <>
              <button onClick={() => setShowLoginModal(true)} className="px-6 py-2.5 rounded-lg font-semibold text-sm" style={{ background: g, color: "#000" }}>
                Connect Wallet
              </button>
              <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />
              </>
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

                {activeTab === "All" && (
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
                )}
              </div>

              {/* Add Form (only on All tab) */}
              {activeTab === "All" && showAddForm && (
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

              {/* Tab Content */}
              {activeTab === "All" && renderAllTab()}
              {activeTab === "Manager" && renderManagerTab()}
              {activeTab === "Trades" && renderTradesTab()}
              {activeTab === "Monitor" && renderMonitorTab()}
            </>
          )}
        </main>
      </div>

      {/* Copy Trading Holders Only Dialog */}
      <Dialog open={showCopyTradeInfo} onOpenChange={setShowCopyTradeInfo}>
        <DialogContent className="sm:max-w-md" style={{ background: "#111", border: "1px solid #333" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Info className="w-5 h-5" style={{ color: g }} />
              Copy Trading
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              Copy Trading and many other options are available to Holders only.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setShowCopyTradeInfo(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: g, color: "#000" }}
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
