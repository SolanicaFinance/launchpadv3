import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useClawStats } from "@/hooks/useClawStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLaunchpadStats } from "@/hooks/useLaunchpadStats";
import { useLocation } from "react-router-dom";
import { ChevronDown, Server, RefreshCw, Layers, Wallet } from "lucide-react";
import { MarketLighthouse } from "./MarketLighthouse";
import { WalletTrackerPanel } from "./WalletTrackerPanel";
import pumpfunPill from "@/assets/pumpfun-pill.webp";
import meteoraIcon from "@/assets/meteora-icon.svg";
import bonkIcon from "@/assets/bonk-icon.jpg";
import bagsIcon from "@/assets/bags-icon.ico";
import moonshotIcon from "@/assets/moonshot-icon.ico";
import raydiumIcon from "@/assets/raydium-icon.ico";

const REGIONS = [
  { id: "US-W", label: "US-W", basePing: 95, variance: 45 },
  { id: "US-C", label: "US-C", basePing: 90, variance: 50 },
  { id: "US-E", label: "US-E", basePing: 75, variance: 40 },
  { id: "EU-W", label: "EU-W", basePing: 55, variance: 25 },
  { id: "EU-C", label: "EU-C", basePing: 50, variance: 25 },
  { id: "EU-E", label: "EU-E", basePing: 45, variance: 25 },
  { id: "ASIA", label: "ASIA", basePing: 120, variance: 40 },
  { id: "ASIA-V2", label: "ASIA-V2", basePing: 110, variance: 40 },
  { id: "AUS", label: "AUS", basePing: 160, variance: 50 },
  { id: "GLOBAL", label: "GLOBAL", basePing: 240, variance: 70 },
];

const LAUNCHPAD_CONFIG: Record<string, { label: string; icon: string; isLocal?: boolean }> = {
  pumpfun: { label: "pumpfun", icon: pumpfunPill, isLocal: true },
  bonk: { label: "bonk", icon: bonkIcon, isLocal: true },
  meteora: { label: "meteora", icon: meteoraIcon, isLocal: true },
  bags: { label: "bags.fm", icon: bagsIcon, isLocal: true },
  moonshot: { label: "moonshot", icon: moonshotIcon, isLocal: true },
  raydium: { label: "raydium", icon: raydiumIcon, isLocal: true },
};

function getPingColor(ping: number): string {
  if (ping < 80) return "hsl(142, 71%, 45%)";
  if (ping < 150) return "hsl(48, 96%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function getCountColor(count: number): string {
  if (count > 500) return "hsl(142, 71%, 45%)";
  if (count >= 100) return "hsl(48, 96%, 53%)";
  return "hsl(0, 84%, 60%)";
}

function randomPing(base: number, variance: number) {
  return Math.round(base + (Math.random() - 0.3) * variance);
}

function getLaunchpadLabel(type: string): string {
  return LAUNCHPAD_CONFIG[type]?.label || type;
}

function getLaunchpadIcon(type: string): string | null {
  return LAUNCHPAD_CONFIG[type]?.icon || null;
}

export function StickyStatsFooter() {
  const { data: stats } = useClawStats();
  const { data: launchpadStats, refetch: refetchLaunchpads } = useLaunchpadStats();
  const isMobile = useIsMobile();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { pathname } = useLocation();
  const [selectedRegion, setSelectedRegion] = useState("EU-E");
  const [regionOpen, setRegionOpen] = useState(false);
  const [launchpadOpen, setLaunchpadOpen] = useState(false);
  const [walletTrackerOpen, setWalletTrackerOpen] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lpRefreshing, setLpRefreshing] = useState(false);
  const [wtRefreshing, setWtRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lpDropdownRef = useRef<HTMLDivElement>(null);
  const wtDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshPings = useCallback(() => {
    const newPings: Record<string, number> = {};
    for (const r of REGIONS) {
      newPings[r.id] = randomPing(r.basePing, r.variance);
    }
    setPings(newPings);
  }, []);

  useEffect(() => {
    refreshPings();
    const interval = setInterval(refreshPings, 5000);
    return () => clearInterval(interval);
  }, [refreshPings]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!regionOpen && !launchpadOpen && !walletTrackerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (regionOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
      if (launchpadOpen && lpDropdownRef.current && !lpDropdownRef.current.contains(e.target as Node)) {
        setLaunchpadOpen(false);
      }
      if (walletTrackerOpen && wtDropdownRef.current && !wtDropdownRef.current.contains(e.target as Node)) {
        setWalletTrackerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [regionOpen, launchpadOpen, walletTrackerOpen]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshing(true);
    refreshPings();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleLpRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLpRefreshing(true);
    refetchLaunchpads();
    setTimeout(() => setLpRefreshing(false), 600);
  };

  const handleWtRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWtRefreshing(true);
    setTimeout(() => setWtRefreshing(false), 600);
  };

  const isPunchDomain = typeof window !== "undefined" && (window.location.hostname === "punchlaunch.fun" || window.location.hostname === "www.punchlaunch.fun");
  if (pathname.startsWith("/punch") || pathname.startsWith("/punch-test") || isPunchDomain) return null;

  const tokens = stats?.totalTokensLaunched ?? 0;
  const agents = stats?.totalAgents ?? 0;
  const feesClaimed = (stats?.totalAgentFeesEarned ?? 0).toFixed(2);
  const agentPosts = stats?.totalAgentPosts ?? 0;
  const currentPing = pings[selectedRegion] ?? 0;

  const totalLpTokens = launchpadStats?.reduce((s, lp) => s + lp.total, 0) ?? 0;

  const footer = (
    <div
      className="sticky-stats-footer"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "40px",
        zIndex: 99999,
        background: "hsl(var(--background))",
        borderTop: "1px solid hsl(var(--border))",
        display: "flex",
        alignItems: "center",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingLeft: "12px",
        paddingRight: "12px",
        gap: "8px",
        boxSizing: "border-box",
        overflow: "visible",
      }}>
        {/* Stats */}
        <div style={{
          display: "flex",
          alignItems: "center",
          flex: "1 1 0%",
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}>
          <StatItem label="TOKENS" value={tokens.toLocaleString()} />
          <Divider />
          <StatItem label="AGENTS" value={agents.toLocaleString()} />
          <Divider />
          <StatItem label="FEES" value={`${feesClaimed} SOL`} />
          <Divider />
          <StatItem label="POSTS" value={agentPosts.toLocaleString()} />
        </div>

        {/* Connection + Launchpads + Region */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          {/* Connection */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "2px 8px",
            borderRadius: "4px",
            background: isOnline ? "hsla(152, 60%, 18%, 0.6)" : "hsla(0, 60%, 18%, 0.6)",
            border: `1px solid ${isOnline ? "hsla(152, 50%, 30%, 0.5)" : "hsla(0, 50%, 30%, 0.5)"}`,
          }}>
            <span
              className={isOnline ? "pulse-dot" : ""}
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "hsl(152, 60%, 45%)" : "hsl(0, 84%, 60%)",
                flexShrink: 0,
              }}
            />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              fontWeight: 500,
              color: isOnline ? "hsl(152, 50%, 55%)" : "hsl(0, 70%, 60%)",
              whiteSpace: "nowrap",
            }}>
              {isOnline ? "Connection is stable" : "Connection lost"}
            </span>
          </div>

          {/* Launchpad selector */}
          <div ref={lpDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setLaunchpadOpen(!launchpadOpen); setRegionOpen(false); setWalletTrackerOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0px",
                padding: "4px 8px",
                borderRadius: "999px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--muted))",
                cursor: "pointer",
              }}
            >
              {/* Hardcoded 3 icons: pumpfun, bonk, meteora */}
              {[
                { icon: pumpfunPill, alt: "pumpfun" },
                { icon: bonkIcon, alt: "bonk" },
                { icon: meteoraIcon, alt: "meteora" },
              ].map((item, i) => (
                <img
                  key={item.alt}
                  src={item.icon}
                  alt={item.alt}
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid hsl(var(--muted))",
                    marginLeft: i > 0 ? "-6px" : "0",
                    position: "relative",
                    zIndex: 3 - i,
                  }}
                />
              ))}
            </button>

            {launchpadOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "48px" : "calc(100% + 8px)",
                right: isMobile ? undefined : 0,
                left: isMobile ? "50%" : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                zIndex: 100000,
              }}>
                <MarketLighthouse onRefresh={handleLpRefresh} refreshing={lpRefreshing} compact={isMobile} />
              </div>
            )}
          </div>

          {/* Wallet Tracker */}
          <div ref={wtDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setWalletTrackerOpen(!walletTrackerOpen); setRegionOpen(false); setLaunchpadOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid hsl(var(--border))",
                background: walletTrackerOpen ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))",
                cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                whiteSpace: "nowrap",
              }}
            >
              <Wallet style={{ width: "12px", height: "12px" }} />
            </button>

            {walletTrackerOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "48px" : "calc(100% + 8px)",
                right: isMobile ? undefined : 0,
                left: isMobile ? "50%" : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                zIndex: 100000,
              }}>
                <WalletTrackerPanel onRefresh={handleWtRefresh} refreshing={wtRefreshing} compact={isMobile} />
              </div>
            )}
          </div>

          {/* Region selector */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setRegionOpen(!regionOpen); setLaunchpadOpen(false); setWalletTrackerOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "3px 8px",
                borderRadius: "6px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--muted))",
                cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                whiteSpace: "nowrap",
              }}
            >
              {selectedRegion}
              <span style={{ fontSize: "10px", fontWeight: 500, color: getPingColor(currentPing) }}>
                {currentPing}ms
              </span>
              <ChevronDown style={{ width: "12px", height: "12px", color: "hsl(var(--muted-foreground))", transform: regionOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {regionOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "48px" : "calc(100% + 6px)",
                right: isMobile ? undefined : 0,
                left: isMobile ? "50%" : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                width: isMobile ? "180px" : "220px",
                maxWidth: isMobile ? "calc(100vw - 16px)" : undefined,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "10px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                padding: "6px",
                zIndex: 100000,
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px 8px",
                  borderBottom: "1px solid hsl(var(--border))",
                  marginBottom: "4px",
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "hsl(var(--foreground))",
                  }}>Regions</span>
                  <button onClick={handleRefresh} style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    color: "hsl(var(--muted-foreground))",
                  }}>
                    <RefreshCw style={{
                      width: "13px",
                      height: "13px",
                      transition: "transform 0.6s",
                      transform: refreshing ? "rotate(360deg)" : "none",
                    }} />
                  </button>
                </div>

                {REGIONS.map((r) => {
                  const ping = pings[r.id] ?? 0;
                  const isSelected = r.id === selectedRegion;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedRegion(r.id); setRegionOpen(false); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "7px 8px",
                        borderRadius: "6px",
                        border: "none",
                        borderLeft: isSelected ? "3px solid hsl(var(--primary))" : "3px solid transparent",
                        background: isSelected ? "hsl(var(--muted))" : "transparent",
                        cursor: "pointer",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "12px",
                        textAlign: "left",
                        color: "hsl(var(--foreground))",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = "hsl(var(--muted) / 0.5)"); }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = "transparent"); }}
                    >
                      <Server style={{ width: "14px", height: "14px", color: isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: isSelected ? 700 : 500 }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: getPingColor(ping), fontSize: "11px" }}>{ping}ms</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(footer, document.body);
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 600, color: "hsl(var(--foreground))" }}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span style={{ color: "hsl(var(--border))", fontSize: "11px", flexShrink: 0, padding: "0 2px" }}>|</span>
  );
}
