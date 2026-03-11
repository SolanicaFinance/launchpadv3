import { useState } from "react";
import { RefreshCw, Plus, Download, Upload, Trash2, Search, Wallet, Loader2, Maximize2 } from "lucide-react";
import { useWalletTracker, TRACKER_TABS, type TrackerTab, shortAddr } from "@/hooks/useWalletTracker";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  } = useWalletTracker();

  const [activeTab, setActiveTab] = useState<TrackerTab>("All");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const f = "'Inter','SF Pro Display',-apple-system,sans-serif";

  const handleAdd = async () => {
    const ok = await addWallet(newAddr, newLabel);
    if (ok) {
      setNewAddr("");
      setNewLabel("");
      setShowAddForm(false);
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
          {/* Toolbar */}
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

          {/* Add Form */}
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
