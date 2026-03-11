import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMarketLighthouse, type LighthouseTimeframe } from "@/hooks/useMarketLighthouse";
import pumpfunPill from "@/assets/pumpfun-pill.webp";
import bonkIcon from "@/assets/bonk-icon.jpg";
import meteoraIcon from "@/assets/meteora-icon.svg";
import bagsIcon from "@/assets/bags-icon.ico";
import moonshotIcon from "@/assets/moonshot-icon.ico";
import raydiumIcon from "@/assets/raydium-icon.ico";

const LAUNCHPAD_ICONS: Record<string, string> = {
  pumpfun: pumpfunPill,
  pump: pumpfunPill,
  bonk: bonkIcon,
  meteora: meteoraIcon,
  tuna: meteoraIcon,
  dbc: meteoraIcon,
  bags: bagsIcon,
  moonshot: moonshotIcon,
  raydium: raydiumIcon,
};

const PROTOCOL_ICONS: Record<string, string> = {
  "Raydium": raydiumIcon,
  "Orca": meteoraIcon,
  "Jupiter": pumpfunPill,
  "Meteora": meteoraIcon,
  "Pump.fun": pumpfunPill,
  "Phoenix": raydiumIcon,
  "Lifinity": meteoraIcon,
};

const TIME_TABS = ["5m", "1h", "6h", "24h"] as const;

const g = "#00FFAA";
const r = "#FF4D4D";
const dim = "#888";
const muted = "#AAAAAA";
const purple = "#BB86FC";
const bg = "#0F0F0F";
const cardBg = "#1A1A1A";

function fUsd(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fNum(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function fPct(v: number) {
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(v >= 100 || v <= -100 ? 1 : 3)}%`;
}

const S = {
  col: { display: "flex", flexDirection: "column" as const },
  row: { display: "flex", alignItems: "center" as const },
  gap4: { gap: "4px" },
  gap6: { gap: "6px" },
};

export function MarketLighthouse({
  onRefresh,
  refreshing,
  compact = false,
}: {
  onRefresh: (e: React.MouseEvent) => void;
  refreshing: boolean;
  compact?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<LighthouseTimeframe>("24h");
  const { data, isLoading, refetch } = useMarketLighthouse(activeTab);

  const handleRefreshAll = (e: React.MouseEvent) => {
    onRefresh(e);
    refetch();
  };

  const totalVol = data?.totalVol24hUsd || 0;
  const volChange = data?.volChange24h || 0;
  const buyVolUsd = data?.buyVolUsd || 0;
  const sellVolUsd = data?.sellVolUsd || 0;
  const buyCount = data?.buyCount || 0;
  const sellCount = data?.sellCount || 0;
  const total = buyVolUsd + sellVolUsd;
  const buyPct = total > 0 ? (buyVolUsd / total) * 100 : 50;

  const f = "'Inter','SF Pro Display',-apple-system,sans-serif";

  const sz = compact ? {
    w: "280px", pad: "8px", fs: { h: "12px", val: "14px", label: "9px", stat: "10px", icon: "18px", bar: "9px", section: "11px", tab: "9px", change: "9px", card: "10px", cardLabel: "8px" },
    gap: "6px", imgSz: "18px", barH: "14px", cardPad: "5px 4px", cardRadius: "6px",
  } : {
    w: "340px", pad: "12px", fs: { h: "15px", val: "20px", label: "13px", stat: "12px", icon: "24px", bar: "10px", section: "13px", tab: "11px", change: "12px", card: "13px", cardLabel: "9px" },
    gap: "8px", imgSz: "24px", barH: "18px", cardPad: "8px 6px", cardRadius: "8px",
  };

  return (
    <div style={{
      width: sz.w,
      background: bg,
      borderRadius: compact ? "10px" : "14px",
      padding: sz.pad,
      fontFamily: f,
      color: "#fff",
      border: "1px solid #222",
      maxHeight: compact ? "70vh" : undefined,
      overflowY: compact ? "auto" : undefined,
    }}>
      {/* Header */}
      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: compact ? "6px" : "10px" }}>
        <div style={{ ...S.row, ...S.gap6 }}>
          <span style={{ width: compact ? "6px" : "8px", height: compact ? "6px" : "8px", borderRadius: "50%", background: g, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: sz.fs.h, fontWeight: 600 }}>Market Lighthouse</span>
          {isLoading && <Loader2 style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite", color: dim }} />}
        </div>
        <div style={{ ...S.row, gap: "2px" }}>
          {TIME_TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: sz.fs.tab, padding: compact ? "1px 4px" : "2px 5px", borderRadius: "4px",
              color: activeTab === t ? "#fff" : "#7080BB",
              fontWeight: activeTab === t ? 700 : 400,
              borderBottom: activeTab === t ? "1px solid #7080BB" : "1px solid transparent",
              fontFamily: f,
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sz.gap, marginBottom: compact ? "6px" : "10px" }}>
        <StatBlock icon="ℓ" label="Total Trades" value={fNum(data?.totalTrades || 0)} change={data?.tradesChange || 0} compact={compact} />
        <StatBlock icon="♁" label="Traders" value={fNum(data?.uniqueTraders || 0)} change={data?.tradersChange || 0} compact={compact} />
      </div>

      {/* 24h Vol */}
      <div style={{ marginBottom: compact ? "6px" : "10px" }}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ ...S.row, gap: "6px" }}>
            <span style={{ fontSize: sz.fs.label, color: muted }}>{activeTab} Vol</span>
            <span style={{ fontSize: sz.fs.val, fontWeight: 700 }}>{fUsd(totalVol)}</span>
          </div>
          <span style={{ fontSize: sz.fs.change, color: volChange >= 0 ? g : r }}>{fPct(volChange)}</span>
        </div>
        {total > 0 ? (
          <div style={{ display: "flex", height: sz.barH, borderRadius: "3px", overflow: "hidden", fontSize: sz.fs.bar }}>
            <div style={{
              flex: `${buyPct}%`,
              background: "linear-gradient(90deg,#00FFAA,#004D2E)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 500,
            }}>{fNum(buyCount)} / {fUsd(buyVolUsd)}</div>
            <div style={{
              flex: `${100 - buyPct}%`,
              background: "linear-gradient(90deg,#4D0026,#FF4DB8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 500,
            }}>{fNum(sellCount)} / {fUsd(sellVolUsd)}</div>
          </div>
        ) : (
          <div style={{ height: sz.barH, borderRadius: "3px", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: sz.fs.bar, color: dim }}>No platform trades yet</span>
          </div>
        )}
      </div>

      {/* Token Stats */}
      <div style={{ marginBottom: compact ? "6px" : "10px" }}>
        <div style={{ ...S.row, ...S.gap4, marginBottom: compact ? "4px" : "6px" }}>
          <span style={{ width: compact ? "4px" : "5px", height: compact ? "4px" : "5px", borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          <span style={{ fontSize: sz.fs.section, fontWeight: 500 }}>Token Stats</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: sz.gap }}>
          <MiniStat icon="◆" iconColor={purple} label="Created" value={fNum(data?.tokensCreated || 0)} change={data?.createdChange || 0} compact={compact} />
          <MiniStat icon="🔗" iconColor={purple} label="Migrations" value={fNum(data?.migrations || 0)} change={data?.graduatedChange || 0} compact={compact} />
        </div>
      </div>

      {/* Top Launchpads */}
      <div style={{ marginBottom: compact ? "6px" : "10px" }}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: compact ? "4px" : "6px" }}>
          <span style={{ fontSize: sz.fs.section, fontWeight: 500 }}>Top Launchpads</span>
          <button onClick={handleRefreshAll} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px", display: "flex", color: dim }}>
            <RefreshCw style={{ width: "12px", height: "12px", transition: "transform 0.6s", transform: refreshing ? "rotate(360deg)" : "none" }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: compact ? "4px" : "6px" }}>
          {(data?.topLaunchpads || []).length > 0 ? (
            data!.topLaunchpads.map((lp, i) => (
              <IconCard key={i} icon={LAUNCHPAD_ICONS[lp.type] || pumpfunPill} label={lp.type} value={fUsd(lp.vol24hUsd)} compact={compact} />
            ))
          ) : (
            <div style={{ gridColumn: "1/-1", textAlign: "center", fontSize: sz.fs.bar, color: dim, padding: "4px" }}>
              {isLoading ? "Loading..." : "No data"}
            </div>
          )}
        </div>
      </div>

      {/* Top Protocols */}
      <div>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: compact ? "4px" : "6px" }}>
          <span style={{ fontSize: sz.fs.section, fontWeight: 500 }}>Top Protocols</span>
          <span style={{ fontSize: sz.fs.cardLabel, color: dim }}>
            {data?.updatedAt ? `${Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000)}m ago` : ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: compact ? "4px" : "6px" }}>
          {(data?.topProtocols || []).length > 0 ? (
            data!.topProtocols.map((p, i) => (
              <IconCard key={i} icon={PROTOCOL_ICONS[p.name] || raydiumIcon} label={p.name} value={fUsd(p.vol24hUsd)} change={p.change} compact={compact} />
            ))
          ) : (
            <div style={{ gridColumn: "1/-1", textAlign: "center", fontSize: sz.fs.bar, color: dim, padding: "4px" }}>
              {isLoading ? "Loading..." : "No data"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value, change, compact }: { icon: string; label: string; value: string; change: number; compact?: boolean }) {
  return (
    <div style={{ ...S.col, gap: "2px" }}>
      <div style={{ ...S.row, gap: compact ? "3px" : "5px" }}>
        <span style={{ fontSize: compact ? "12px" : "16px" }}>{icon}</span>
        <span style={{ fontSize: compact ? "9px" : "12px", color: muted }}>{label}</span>
      </div>
      <span style={{ fontSize: compact ? "13px" : "18px", fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: compact ? "9px" : "12px", color: change >= 0 ? g : r }}>{fPct(change)}</span>
    </div>
  );
}

function MiniStat({ icon, iconColor, label, value, change, compact }: { icon: string; iconColor: string; label: string; value: string; change: number; compact?: boolean }) {
  return (
    <div style={{ ...S.col, gap: "2px" }}>
      <div style={{ ...S.row, gap: compact ? "3px" : "4px" }}>
        <span style={{ fontSize: compact ? "10px" : "14px", color: iconColor }}>{icon}</span>
        <span style={{ fontSize: compact ? "9px" : "11px", color: muted }}>{label}</span>
      </div>
      <span style={{ fontSize: compact ? "12px" : "15px", fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: compact ? "9px" : "11px", color: change >= 0 ? g : r }}>{fPct(change)}</span>
    </div>
  );
}

function IconCard({ icon, label, value, change, compact }: { icon: string; label: string; value: string; change?: number; compact?: boolean }) {
  return (
    <div style={{
      background: cardBg,
      borderRadius: compact ? "6px" : "8px",
      border: "1px solid #2a2a2a",
      padding: compact ? "5px 4px" : "8px 6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: compact ? "2px" : "3px",
    }}>
      <img src={icon} alt={label} style={{ width: compact ? "18px" : "24px", height: compact ? "18px" : "24px", borderRadius: compact ? "4px" : "5px", objectFit: "cover" }} />
      <span style={{ fontSize: compact ? "10px" : "13px", fontWeight: 700 }}>{value}</span>
      {change !== undefined && (
        <span style={{ fontSize: compact ? "8px" : "10px", color: change >= 0 ? g : r, fontWeight: 500 }}>{fPct(change)}</span>
      )}
      <span style={{ fontSize: compact ? "7px" : "9px", color: dim }}>{label}</span>
    </div>
  );
}
