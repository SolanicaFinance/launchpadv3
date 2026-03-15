import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLaunchpadStats } from "@/hooks/useLaunchpadStats";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Server, RefreshCw, Layers, Wallet, Rocket, FileText, TrendingUp, Coins, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketLighthouse } from "./MarketLighthouse";
import { WalletTrackerPanel } from "./WalletTrackerPanel";
import { NewPairsPanel } from "./NewPairsPanel";
import { useWalletTradeNotifications } from "@/hooks/useWalletTradeNotifications";
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
  const { data: launchpadStats, refetch: refetchLaunchpads } = useLaunchpadStats();
  const isMobile = useIsMobile();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { pathname } = useLocation();
  const [selectedRegion, setSelectedRegion] = useState("EU-E");
  const [regionOpen, setRegionOpen] = useState(false);
  const [launchpadOpen, setLaunchpadOpen] = useState(false);
  const [walletTrackerOpen, setWalletTrackerOpen] = useState(false);
  const [newPairsOpen, setNewPairsOpen] = useState(false);
  const [pings, setPings] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lpRefreshing, setLpRefreshing] = useState(false);
  const [wtRefreshing, setWtRefreshing] = useState(false);
  const [npRefreshing, setNpRefreshing] = useState(false);
  const [trackerShaking, setTrackerShaking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lpDropdownRef = useRef<HTMLDivElement>(null);
  const wtDropdownRef = useRef<HTMLDivElement>(null);
  const npDropdownRef = useRef<HTMLDivElement>(null);

  const handleTradeNotification = useCallback(() => {
    setTrackerShaking(true);
    setTimeout(() => setTrackerShaking(false), 1000);
  }, []);

  useWalletTradeNotifications({ onTrade: handleTradeNotification });

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
  if (!regionOpen && !launchpadOpen && !walletTrackerOpen && !newPairsOpen) return;
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
      if (newPairsOpen && npDropdownRef.current && !npDropdownRef.current.contains(e.target as Node)) {
        setNewPairsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [regionOpen, launchpadOpen, walletTrackerOpen, newPairsOpen]);

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

  const handleNpRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNpRefreshing(true);
    setTimeout(() => setNpRefreshing(false), 600);
  };



  const currentPing = pings[selectedRegion] ?? 0;

  const footer = (
    <div
      className="sticky-stats-footer"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "36px",
        zIndex: 99999,
        background: "#0d0d0f",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingLeft: "8px",
        paddingRight: "8px",
        gap: "6px",
        boxSizing: "border-box",
        overflow: "visible",
      }}>
        {/* LEFT: Wallet Tracker + Connection */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Wallet Tracker */}
          <div ref={wtDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setWalletTrackerOpen(!walletTrackerOpen); setRegionOpen(false); setLaunchpadOpen(false); setNewPairsOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 7px",
                borderRadius: "4px",
                border: "1px solid rgba(200,255,0,0.25)",
                background: walletTrackerOpen ? "rgba(200,255,0,0.15)" : "rgba(200,255,0,0.06)",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 500,
                color: "#c8ff00",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <Wallet style={{
                width: "11px",
                height: "11px",
                animation: trackerShaking ? "tracker-shake 0.5s ease-in-out 0s 2" : "none",
              }} />
              <span>Tracker</span>
            </button>

            {walletTrackerOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "44px" : "calc(100% + 6px)",
                left: isMobile ? "50%" : 0,
                right: isMobile ? undefined : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                zIndex: 100000,
              }}>
                <WalletTrackerPanel onRefresh={handleWtRefresh} refreshing={wtRefreshing} compact={isMobile} />
              </div>
            )}
          </div>

          {/* New Pairs */}
          <div ref={npDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setNewPairsOpen(!newPairsOpen); setWalletTrackerOpen(false); setRegionOpen(false); setLaunchpadOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 7px",
                borderRadius: "4px",
                border: "1px solid rgba(200,255,0,0.15)",
                background: newPairsOpen ? "rgba(200,255,0,0.12)" : "rgba(255,255,255,0.04)",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 500,
                color: newPairsOpen ? "#c8ff00" : "rgba(255,255,255,0.6)",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              <Rocket style={{ width: "11px", height: "11px" }} />
              <span>New Pairs</span>
            </button>

            {newPairsOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "44px" : "calc(100% + 6px)",
                left: isMobile ? "50%" : 0,
                transform: isMobile ? "translateX(-50%)" : undefined,
                zIndex: 100000,
              }}>
                <NewPairsPanel onRefresh={handleNpRefresh} refreshing={npRefreshing} compact={isMobile} />
              </div>
            )}
          </div>

          {/* Connection dot */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: isOnline ? "rgba(0,255,170,0.06)" : "rgba(255,77,77,0.08)",
          }}>
            <span
              className={isOnline ? "pulse-dot" : ""}
              style={{
                display: "inline-block",
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#00FFAA" : "#FF4D4D",
                flexShrink: 0,
              }}
            />
            <span style={{
              fontSize: "9px",
              fontWeight: 500,
              color: isOnline ? "rgba(0,255,170,0.7)" : "rgba(255,77,77,0.7)",
              whiteSpace: "nowrap",
            }}>
              {isOnline ? "Stable" : "Offline"}
            </span>
          </div>
          {/* Desktop-only quick nav icons */}
          {!isMobile && (
            <>
              <Link to="/docs" style={{
                display: "flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                <FileText style={{ width: "11px", height: "11px" }} />
                <span>Docs</span>
              </Link>
              <Link to="/leverage" style={{
                display: "flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                <TrendingUp style={{ width: "11px", height: "11px" }} />
                <span>Leverage</span>
              </Link>
              <Link to="/launch" style={{
                display: "flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                <Coins style={{ width: "11px", height: "11px" }} />
                <span>Launch</span>
              </Link>
              <Link to="/tokens" style={{
                display: "flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
                fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                <Activity style={{ width: "11px", height: "11px" }} />
                <span>Pulse</span>
              </Link>
            </>
          )}
          </div>
        {/* CENTER: Crypto Prices — hidden on mobile */}
        {!isMobile && (
          <div style={{
            display: "flex",
            alignItems: "center",
            flex: "1 1 0%",
            justifyContent: "center",
            minWidth: 0,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
            <FooterCryptoPrices />
          </div>
        )}

        {/* RIGHT: Launchpads + Region */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Launchpad selector */}
          <div ref={lpDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setLaunchpadOpen(!launchpadOpen); setRegionOpen(false); setWalletTrackerOpen(false); setNewPairsOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0px",
                padding: "3px 6px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
            >
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
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1.5px solid #0d0d0f",
                    marginLeft: i > 0 ? "-5px" : "0",
                    position: "relative",
                    zIndex: 3 - i,
                  }}
                />
              ))}
            </button>

            {launchpadOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "44px" : "calc(100% + 6px)",
                right: isMobile ? undefined : 0,
                left: isMobile ? "50%" : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                zIndex: 100000,
              }}>
                <MarketLighthouse onRefresh={handleLpRefresh} refreshing={lpRefreshing} compact={isMobile} />
              </div>
            )}
          </div>

          {/* Region selector */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setRegionOpen(!regionOpen); setLaunchpadOpen(false); setWalletTrackerOpen(false); setNewPairsOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
              }}
            >
              {selectedRegion}
              <span style={{ fontSize: "9px", fontWeight: 500, color: getPingColor(currentPing) }}>
                {currentPing}ms
              </span>
              <ChevronDown style={{ width: "10px", height: "10px", color: "rgba(255,255,255,0.3)", transform: regionOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>

            {regionOpen && (
              <div style={{
                position: isMobile ? "fixed" : "absolute",
                bottom: isMobile ? "44px" : "calc(100% + 6px)",
                right: isMobile ? undefined : 0,
                left: isMobile ? "50%" : undefined,
                transform: isMobile ? "translateX(-50%)" : undefined,
                width: isMobile ? "180px" : "200px",
                maxWidth: isMobile ? "calc(100vw - 16px)" : undefined,
                background: "#141416",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                padding: "4px",
                zIndex: 100000,
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 8px 6px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: "2px",
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Regions</span>
                  <button onClick={handleRefresh} style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    color: "rgba(255,255,255,0.3)",
                  }}>
                    <RefreshCw style={{
                      width: "12px",
                      height: "12px",
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
                        gap: "6px",
                        width: "100%",
                        padding: "5px 8px",
                        borderRadius: "4px",
                        border: "none",
                        borderLeft: isSelected ? "2px solid #c8ff00" : "2px solid transparent",
                        background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
                        cursor: "pointer",
                        fontSize: "11px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.8)",
                        transition: "background 0.1s",
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.background = "rgba(255,255,255,0.03)"); }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.background = "transparent"); }}
                    >
                      <Server style={{ width: "12px", height: "12px", color: isSelected ? "#c8ff00" : "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: isSelected ? 700 : 400 }}>{r.label}</span>
                      <span style={{ fontWeight: 600, color: getPingColor(ping), fontSize: "10px" }}>{ping}ms</span>
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

const FOOTER_PRICES_CACHE_KEY = 'saturn_footer_crypto_prices';
const FOOTER_PRICES_CACHE_TTL = 60000;

function FooterCryptoPrices() {
  const [prices, setPrices] = useState<Record<string, { price: number; change24h: number }> | null>(() => {
    try {
      const cached = localStorage.getItem(FOOTER_PRICES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < FOOTER_PRICES_CACHE_TTL * 2) {
          return parsed.data;
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("crypto-prices");
        if (!error && data?.btc) {
          setPrices(data);
          localStorage.setItem(FOOTER_PRICES_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        }
      } catch {}
    };

    // Skip initial fetch if cache is fresh
    const cached = localStorage.getItem(FOOTER_PRICES_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < FOOTER_PRICES_CACHE_TTL) {
          // Cache is fresh, skip immediate fetch
        } else {
          fetchPrices();
        }
      } catch { fetchPrices(); }
    } else {
      fetchPrices();
    }

    const interval = setInterval(fetchPrices, FOOTER_PRICES_CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (p: number) => p >= 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${p.toFixed(2)}`;
  const formatChange = (c: number) => `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;

  const coins = [
    { symbol: "BTC", data: prices?.btc, icon: (
      <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path d="M22.5 14.2c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.7c-.4-.1-.9-.2-1.3-.3l.7-2.7-1.6-.4-.7 2.7c-.3-.1-.7-.2-1-.2v0l-2.2-.6-.4 1.7s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 0 .1 0 .2.1h-.2l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.8 2.1.5c.4.1.8.2 1.2.3l-.7 2.8 1.6.4.7-2.8c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.9.6 5.1.3 6-2.3.7-2.1 0-3.3-1.5-4 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2.1-4.1 1-5.3.7l.9-3.8c1.2.3 4.9.9 4.4 3.1zm.5-5.4c-.5 1.9-3.5.9-4.4.7l.8-3.4c1 .2 4.1.7 3.6 2.7z" fill="white"/></svg>
    )},
    { symbol: "ETH", data: prices?.eth, icon: (
      <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#627EEA"/><path d="M16.5 4v8.9l7.5 3.3L16.5 4z" fill="white" fillOpacity="0.6"/><path d="M16.5 4L9 16.2l7.5-3.3V4z" fill="white"/><path d="M16.5 21.9v6.1l7.5-10.4-7.5 4.3z" fill="white" fillOpacity="0.6"/><path d="M16.5 28v-6.1L9 17.6l7.5 10.4z" fill="white"/><path d="M16.5 20.6l7.5-4.4-7.5-3.3v7.7z" fill="white" fillOpacity="0.2"/><path d="M9 16.2l7.5 4.4v-7.7L9 16.2z" fill="white" fillOpacity="0.6"/></svg>
    )},
    { symbol: "BNB", data: prices?.bnb, icon: (
      <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#F3BA2F"/><path d="M16 6l3.2 3.2L12.8 15.6 16 18.8l6.4-6.4L16 6zm-6.4 6.4L6.4 15.6l3.2 3.2 3.2-3.2-3.2-3.2zm12.8 0l-3.2 3.2 3.2 3.2 3.2-3.2-3.2-3.2zM16 18.8l-6.4-6.4L6.4 15.6 16 25.2l9.6-9.6-3.2-3.2L16 18.8z" fill="white"/></svg>
    )},
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {coins.map((coin) => {
        const change = coin.data?.change24h ?? 0;
        const isPositive = change >= 0;
        const changeColor = isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
        return (
          <div key={coin.symbol} style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {coin.icon}
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
              {coin.symbol}
            </span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
              {coin.data?.price ? formatPrice(coin.data.price) : "—"}
            </span>
            {coin.data?.price ? (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 600, color: changeColor }}>
                {formatChange(change)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", padding: "2px 4px", flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
        {value}
      </span>
    </div>
  );
}

function Dot() {
  return (
    <span style={{ color: "rgba(255,255,255,0.12)", fontSize: "8px", flexShrink: 0, padding: "0 1px" }}>·</span>
  );
}
