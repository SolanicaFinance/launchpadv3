import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Plus, Download, Upload, Trash2, Search, Wallet, Loader2, Maximize2, TrendingUp, TrendingDown, Eye, Activity, Bell, BellOff, Info } from "lucide-react";
import { useWalletTracker, TRACKER_TABS, type TrackerTab, shortAddr } from "@/hooks/useWalletTracker";
import { useTradeSounds } from "@/hooks/useTradeSounds";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const g = "#00FFAA";
const r = "#FF4D4D";
const dim = "#888";
const muted = "#AAAAAA";
const bg = "#0F0F0F";
const cardBg = "#1A1A1A";

export function WalletTrackerPanel({
  onRefresh,
  refreshing,
  compact = false,
}: {
  onRefresh: (e: React.MouseEvent) => void;
  refreshing: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();
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

  const { playBuy, playSell } = useTradeSounds();

  const [activeTab, setActiveTab] = useState<TrackerTab>("All");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showCopyTradeInfo, setShowCopyTradeInfo] = useState(false);

  const f = "'Inter','SF Pro Display',-apple-system,sans-serif";

  const handleAdd = async () => {
    const ok = await addWallet(newAddr, newLabel);
    if (ok) {
      setNewAddr("");
      setNewLabel("");
      setShowAddForm(false);
    }
  };

  const handleCopyTradeToggle = () => {
    setShowCopyTradeInfo(true);
  };

  const filtered = wallets.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.wallet_address.toLowerCase().includes(q) ||
      (w.wallet_label || "").toLowerCase().includes(q)
    );
  });

  // Realtime subscription for trade notifications
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  useEffect(() => {
    const channel = supabase
      .channel('wallet-tracker-trades-panel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_trades' },
        (payload) => {
          const trade = payload.new as any;
          const trackedWallet = walletsRef.current.find(
            (w) => w.wallet_address === trade.wallet_address && w.notifications_enabled
          );
          if (trackedWallet) {
            if (trade.trade_type === 'buy') {
              playBuy();
            } else {
              playSell();
            }
            const label = trackedWallet.wallet_label || shortAddr(trade.wallet_address);
            const tokenLabel = trade.token_ticker || trade.token_name || shortAddr(trade.token_mint);
            toast({
              title: `${trade.trade_type === 'buy' ? '🟢 Buy' : '🔴 Sell'} — ${label}`,
              description: `${Number(trade.sol_amount).toFixed(3)} SOL → ${tokenLabel}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playBuy, playSell]);

  const sz = compact
    ? { w: "300px", pad: "8px", fs: { h: "12px", tab: "9px", label: "9px", val: "10px", btn: "9px" }, gap: "4px" }
    : { w: "380px", pad: "12px", fs: { h: "15px", tab: "11px", label: "11px", val: "12px", btn: "10px" }, gap: "6px" };

  return (
    <div
      style={{
        width: sz.w,
        background: bg,
        borderRadius: compact ? "10px" : "14px",
        padding: sz.pad,
        fontFamily: f,
        color: "#fff",
        border: "1px solid #222",
        maxHeight: compact ? "70vh" : "80vh",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: compact ? "6px" : "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: compact ? "6px" : "8px", height: compact ? "6px" : "8px", borderRadius: "50%", background: g, display: "inline-block", flexShrink: 0 }} />
          <Wallet style={{ width: compact ? "12px" : "14px", height: compact ? "12px" : "14px", color: "#fff" }} />
          <span style={{ fontSize: sz.fs.h, fontWeight: 600 }}>Wallet Tracker</span>
          {loading && <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite", color: dim }} />}
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/wallet-tracker"); }}
            title="Open full page"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", color: dim }}
          >
            <Maximize2 style={{ width: compact ? "10px" : "12px", height: compact ? "10px" : "12px" }} />
          </button>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          {TRACKER_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: sz.fs.tab,
                padding: compact ? "1px 4px" : "2px 5px",
                borderRadius: "4px",
                color: activeTab === t ? "#fff" : "#7080BB",
                fontWeight: activeTab === t ? 700 : 400,
                borderBottom: activeTab === t ? "1px solid #7080BB" : "1px solid transparent",
                fontFamily: f,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Copy Trade Info Box */}
      {showCopyTradeInfo && (
        <div
          style={{
            background: "rgba(0,255,170,0.08)",
            border: "1px solid rgba(0,255,170,0.25)",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          <Info style={{ width: "14px", height: "14px", color: g, flexShrink: 0, marginTop: "1px" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: g, marginBottom: "2px" }}>Copy Trading</div>
            <div style={{ fontSize: "10px", color: muted }}>Copy Trading and many other options are available to Holders only.</div>
          </div>
          <button
            onClick={() => setShowCopyTradeInfo(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: dim, fontSize: "14px", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {!isAuthenticated ? (
        <div style={{ textAlign: "center", padding: "24px 12px" }}>
          <Wallet style={{ width: "32px", height: "32px", color: dim, margin: "0 auto 8px" }} />
          <div style={{ fontSize: sz.fs.val, color: muted, marginBottom: "12px" }}>Connect to track wallets</div>
          <button
            onClick={login}
            style={{
              background: g,
              color: "#000",
              border: "none",
              borderRadius: "6px",
              padding: "6px 16px",
              fontSize: sz.fs.btn,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: f,
            }}
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          {/* Toolbar (All tab) */}
          {activeTab === "All" && (
            <>
              <div style={{ display: "flex", gap: sz.gap, marginBottom: compact ? "6px" : "8px", alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <Search style={{ position: "absolute", left: "6px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: dim }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or addr..."
                    style={{
                      width: "100%",
                      background: cardBg,
                      border: "1px solid #2a2a2a",
                      borderRadius: "6px",
                      padding: "5px 6px 5px 22px",
                      fontSize: sz.fs.label,
                      color: "#fff",
                      outline: "none",
                      fontFamily: f,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <ToolBtn icon={<Download style={{ width: "11px", height: "11px" }} />} label="Import" compact={compact} onClick={() => {}} />
                <ToolBtn icon={<Upload style={{ width: "11px", height: "11px" }} />} label="Export" compact={compact} onClick={() => {}} />
                <ToolBtn
                  icon={<Plus style={{ width: "11px", height: "11px" }} />}
                  label="Add"
                  compact={compact}
                  highlight
                  onClick={() => setShowAddForm(!showAddForm)}
                />
              </div>

              {showAddForm && (
                <div style={{ background: cardBg, border: "1px solid #2a2a2a", borderRadius: "8px", padding: "8px", marginBottom: "8px" }}>
                  <input
                    value={newAddr}
                    onChange={(e) => setNewAddr(e.target.value)}
                    placeholder="Wallet address"
                    style={{
                      width: "100%",
                      background: "#111",
                      border: "1px solid #333",
                      borderRadius: "5px",
                      padding: "5px 8px",
                      fontSize: sz.fs.label,
                      color: "#fff",
                      outline: "none",
                      marginBottom: "4px",
                      fontFamily: f,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Label (optional)"
                      style={{
                        flex: 1,
                        background: "#111",
                        border: "1px solid #333",
                        borderRadius: "5px",
                        padding: "5px 8px",
                        fontSize: sz.fs.label,
                        color: "#fff",
                        outline: "none",
                        fontFamily: f,
                      }}
                    />
                    <button
                      onClick={handleAdd}
                      disabled={adding || !newAddr.trim()}
                      style={{
                        background: g,
                        color: "#000",
                        border: "none",
                        borderRadius: "5px",
                        padding: "4px 12px",
                        fontSize: sz.fs.btn,
                        fontWeight: 600,
                        cursor: adding ? "wait" : "pointer",
                        opacity: adding || !newAddr.trim() ? 0.5 : 1,
                        fontFamily: f,
                      }}
                    >
                      {adding ? "..." : "Add"}
                    </button>
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 70px 70px 28px",
                  gap: "4px",
                  padding: "4px 6px",
                  borderBottom: "1px solid #222",
                  marginBottom: "2px",
                }}
              >
                <span style={{ fontSize: sz.fs.label, color: dim, fontWeight: 500 }}>Added</span>
                <span style={{ fontSize: sz.fs.label, color: dim, fontWeight: 500 }}>Name</span>
                <span style={{ fontSize: sz.fs.label, color: dim, fontWeight: 500, textAlign: "right" }}>Balance</span>
                <span style={{ fontSize: sz.fs.label, color: dim, fontWeight: 500, textAlign: "right" }}>Last Active</span>
                <button
                  onClick={removeAll}
                  title="Remove All"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: r }}
                >
                  <Trash2 style={{ width: "11px", height: "11px" }} />
                </button>
              </div>

              {/* Rows */}
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: dim, fontSize: sz.fs.val }}>
                  {loading ? "Loading..." : wallets.length === 0 ? "No wallets tracked yet" : "No matches"}
                </div>
              ) : (
                filtered.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 70px 70px 28px",
                      gap: "4px",
                      padding: "5px 6px",
                      borderRadius: "5px",
                      alignItems: "center",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: sz.fs.label, color: muted }}>
                      {formatDistanceToNow(new Date(w.created_at), { addSuffix: false }).replace("about ", "").replace(" ago", "")}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: sz.fs.val, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w.wallet_label || shortAddr(w.wallet_address)}
                      </span>
                      {w.wallet_label && (
                        <span style={{ fontSize: "8px", color: dim }}>{shortAddr(w.wallet_address)}</span>
                      )}
                    </div>
                    <span style={{ fontSize: sz.fs.val, fontWeight: 600, textAlign: "right", color: w.balance !== null ? "#fff" : dim }}>
                      {w.balance !== null ? `${w.balance.toFixed(2)}` : "—"}
                    </span>
                    <span style={{ fontSize: sz.fs.label, color: muted, textAlign: "right" }}>
                      {w.lastActive
                        ? formatDistanceToNow(new Date(w.lastActive), { addSuffix: false }).replace("about ", "")
                        : "—"}
                    </span>
                    <button
                      onClick={() => removeWallet(w.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: dim }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = r)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
                    >
                      <Trash2 style={{ width: "10px", height: "10px" }} />
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {/* Manager Tab */}
          {activeTab === "Manager" && (
            <div>
              {wallets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: dim, fontSize: sz.fs.val }}>
                  No wallets to manage
                </div>
              ) : (
                wallets.map((w) => (
                  <div
                    key={w.id}
                    style={{ padding: "6px", borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: sz.fs.val, fontWeight: 600 }}>{w.wallet_label || "Unlabeled"}</div>
                      <div style={{ fontSize: "8px", color: dim, fontFamily: "monospace" }}>{shortAddr(w.wallet_address)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        onClick={() => toggleNotifications(w.id, !w.notifications_enabled)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <span style={{ fontSize: "8px", color: w.notifications_enabled ? g : dim }}>
                          {w.notifications_enabled ? "🔔" : "🔕"}
                        </span>
                      </button>
                      <button
                        onClick={handleCopyTradeToggle}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <span style={{ fontSize: "8px", color: w.is_copy_trading_enabled ? g : dim }}>
                          {w.is_copy_trading_enabled ? "📋" : "—"}
                        </span>
                      </button>
                    </div>
                    <button
                      onClick={() => removeWallet(w.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: dim }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = r)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
                    >
                      <Trash2 style={{ width: "10px", height: "10px" }} />
                    </button>
                  </div>
                ))
              )}
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate("/wallet-tracker"); }}
                  style={{
                    background: "none",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    padding: "4px 12px",
                    fontSize: sz.fs.btn,
                    color: g,
                    cursor: "pointer",
                    fontFamily: f,
                  }}
                >
                  Open Full Manager →
                </button>
              </div>
            </div>
          )}

          {/* Trades Tab */}
          {activeTab === "Trades" && (
            <PanelTradesTab wallets={wallets} sz={sz} f={f} navigate={navigate} />
          )}

          {/* Monitor Tab */}
          {activeTab === "Monitor" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 0", borderBottom: "1px solid #222", marginBottom: "4px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700 }}>{wallets.length}</div>
                  <div style={{ fontSize: "8px", color: dim }}>Tracked</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: g }}>{wallets.filter(w => w.notifications_enabled).length}</div>
                  <div style={{ fontSize: "8px", color: dim }}>Alerts On</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: g }}>{wallets.filter(w => w.is_copy_trading_enabled).length}</div>
                  <div style={{ fontSize: "8px", color: dim }}>Copy Trading</div>
                </div>
              </div>
              {wallets
                .sort((a, b) => {
                  if (!a.lastActive && !b.lastActive) return 0;
                  if (!a.lastActive) return 1;
                  if (!b.lastActive) return -1;
                  return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
                })
                .map((w) => (
                  <div
                    key={w.id}
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 6px", borderBottom: "1px solid #1a1a1a" }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: w.lastActive && (Date.now() - new Date(w.lastActive).getTime()) < 1000 * 60 * 30 ? g : dim,
                        boxShadow: w.lastActive && (Date.now() - new Date(w.lastActive).getTime()) < 1000 * 60 * 30 ? `0 0 4px ${g}` : "none",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: sz.fs.val, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {w.wallet_label || shortAddr(w.wallet_address)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: sz.fs.val, fontWeight: 600 }}>{w.balance !== null ? `${w.balance.toFixed(2)}` : "—"}</div>
                      <div style={{ fontSize: "7px", color: muted }}>
                        {w.lastActive ? formatDistanceToNow(new Date(w.lastActive), { addSuffix: true }) : "—"}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #222" }}>
            <span style={{ fontSize: sz.fs.label, color: dim }}>{wallets.length} wallets tracked</span>
            <button
              onClick={(e) => { onRefresh(e); fetchWallets(); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "1px", display: "flex", color: dim }}
            >
              <RefreshCw style={{ width: "12px", height: "12px", transition: "transform 0.6s", transform: refreshing ? "rotate(360deg)" : "none" }} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  compact,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  compact?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "3px",
        padding: compact ? "3px 6px" : "4px 8px",
        borderRadius: "5px",
        border: highlight ? "none" : "1px solid #2a2a2a",
        background: highlight ? "#00FFAA" : cardBg,
        color: highlight ? "#000" : "#ccc",
        cursor: "pointer",
        fontSize: compact ? "8px" : "10px",
        fontWeight: 600,
        fontFamily: "'Inter',sans-serif",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {icon}
      {!compact && label}
    </button>
  );
}

interface WalletTrade {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: string;
  sol_amount: number;
  token_amount: number;
  created_at: string;
}

function PanelTradesTab({ wallets, sz, f, navigate }: { wallets: any[]; sz: any; f: string; navigate: any }) {
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [loading, setLoading] = useState(false);

  // Use ref for addresses to avoid re-fetching on wallet object changes
  const addressesRef = useRef<string>("");

  useEffect(() => {
    if (wallets.length === 0) return;
    const newAddrs = wallets.map((w: any) => w.wallet_address).sort().join(",");
    if (newAddrs === addressesRef.current && trades.length > 0) return;
    addressesRef.current = newAddrs;

    setLoading(true);
    const addresses = wallets.map((w: any) => w.wallet_address);
    supabase
      .from('wallet_trades')
      .select('*')
      .in('wallet_address', addresses)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setTrades(data as WalletTrade[]);
        setLoading(false);
      });
  }, [wallets]);

  const getLabel = (addr: string) => {
    const w = wallets.find((w: any) => w.wallet_address === addr);
    return w?.wallet_label || shortAddr(addr);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0", color: "#888", fontSize: sz.fs.val }}>
        <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite", display: "inline-block", marginRight: "4px" }} />
        Loading trades...
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0", color: "#888", fontSize: sz.fs.val }}>
        {wallets.length === 0 ? "Add wallets to see trades" : "No trades recorded yet"}
      </div>
    );
  }

  return (
    <div>
      {trades.map((t) => (
        <div
          key={t.id}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/launchpad/${t.token_mint}`); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 6px",
            borderBottom: "1px solid #1a1a1a",
            cursor: "pointer",
          }}
        >
          {/* Token icon */}
          <img
            src={`https://dd.dexscreener.com/ds-data/tokens/solana/${t.token_mint}.png`}
            alt=""
            style={{ width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0, objectFit: "cover", background: "#222" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <span
            style={{
              fontSize: "8px",
              fontWeight: 700,
              padding: "1px 4px",
              borderRadius: "3px",
              background: t.trade_type === 'buy' ? 'rgba(0,255,170,0.15)' : 'rgba(255,77,77,0.15)',
              color: t.trade_type === 'buy' ? '#00FFAA' : '#FF4D4D',
              flexShrink: 0,
            }}
          >
            {t.trade_type === 'buy' ? 'BUY' : 'SELL'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: sz.fs.val, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.token_ticker || t.token_name || shortAddr(t.token_mint)}
            </div>
            <div style={{ fontSize: "7px", color: "#888" }}>{getLabel(t.wallet_address)}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: sz.fs.val, fontWeight: 600 }}>{t.sol_amount.toFixed(3)} SOL</div>
            <div style={{ fontSize: "7px", color: "#aaa" }}>
              {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate("/wallet-tracker"); }}
          style={{
            background: "none",
            border: "1px solid #333",
            borderRadius: "6px",
            padding: "4px 12px",
            fontSize: sz.fs.btn,
            color: '#00FFAA',
            cursor: "pointer",
            fontFamily: f,
          }}
        >
          View All Trades →
        </button>
      </div>
    </div>
  );
}
