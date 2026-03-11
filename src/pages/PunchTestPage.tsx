import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComboCounter } from "@/components/punch/ComboCounter";
import { PunchConfetti } from "@/components/punch/PunchConfetti";
import { PunchTokenFeed } from "@/components/punch/PunchTokenFeed";
import { PunchLivestream } from "@/components/punch/PunchLivestream";
import { PunchChatBox } from "@/components/punch/PunchChatBox";
import { PunchVideoPopup } from "@/components/punch/PunchVideoPopup";
import { PunchStatsFooter } from "@/components/punch/PunchStatsFooter";
import { PunchEarnedPanel } from "@/components/punch/PunchEarnedPanel";
import { supabase } from "@/integrations/supabase/client";
import { Copy, CheckCircle, ExternalLink, Loader2, Rocket, MessageCircle, X, Twitter, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePunchTokenCount } from "@/hooks/usePunchTokenCount";
import { usePunchPageStats } from "@/hooks/usePunchPageStats";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLaunchRateLimit } from "@/hooks/useLaunchRateLimit";

type GameState = "tapping" | "launching" | "result";

const STEPS = 18;
const TAPS_TO_WIN = 50;
const DECAY_RATE = 1.2;
const COMBO_WINDOW_MS = 300;
const REQUIRED_TAPS = 50;

export default function PunchTestPage() {
  const { toast } = useToast();
  const totalLaunched = usePunchTokenCount();
  const { totalPunches, uniqueVisitors, reportPunches } = usePunchPageStats();
  const isMobile = useIsMobile();
  const rateLimit = useLaunchRateLimit();

  // Dynamic SEO for punchlaunch.fun
  useEffect(() => {
    const isPunch = window.location.hostname === "punchlaunch.fun" || window.location.hostname === "www.punchlaunch.fun";
    if (!isPunch) return;

    document.title = "Punch and Launch";

    const setMeta = (attr: string, val: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${val}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr.split("=")[0], val); document.head.appendChild(el); }
      // fix: setAttribute properly
      if (attr === "name") el.setAttribute("name", val);
      else el.setAttribute("property", val);
      el.setAttribute("content", content);
    };

    const desc = "Punch the Viral Monkey Launchpad";
    const img = "https://punchlaunch.fun/punch-logo.jpg";

    setMeta("name", "description", desc);
    setMeta("property", "og:title", "Punch and Launch");
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", "https://punchlaunch.fun");
    setMeta("name", "twitter:title", "Punch and Launch");
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
    setMeta("name", "twitter:site", "@punchitsol");
    setMeta("name", "twitter:card", "summary_large_image");

    // Favicon
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = "/punch-favicon.jpg";
    link.type = "image/jpeg";

    return () => { document.title = "Saturn"; };
  }, []);

  const [state, setState] = useState<GameState>("tapping");
  const [progress, setProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [tapping, setTapping] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showEarned, setShowEarned] = useState(false);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [wallet, setWallet] = useState(() => localStorage.getItem("punch_wallet") || "");
  const [walletShake, setWalletShake] = useState(false);
  const [walletSaved, setWalletSaved] = useState(() => {
    const saved = localStorage.getItem("punch_wallet") || "";
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(saved);
  });
  const [launchError, setLaunchError] = useState("");
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [tokensLaunched, setTokensLaunched] = useState(0);
  const [result, setResult] = useState<{
    mintAddress: string;
    name: string;
    ticker: string;
    imageUrl?: string;
    tokenId?: string;
  } | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const step = Math.round((progress / 100) * STEPS);

  const getMovePx = () => Math.max(4, Math.min(10, window.innerWidth / 100));
  const getMoveY = () => Math.max(1.5, Math.min(3, window.innerWidth / 200));

  const lastTapTime = useRef(0);
  const tapCount = useRef(0);
  const progressRef = useRef(0);
  const decayTimer = useRef<ReturnType<typeof setInterval>>();
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();
  const launchTriggered = useRef(false);

  const isValidWallet = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

  // Save wallet to DB when user clicks Save
  const handleSaveWallet = () => {
    if (!isValidWallet) return;
    localStorage.setItem("punch_wallet", wallet);
    setWalletSaved(true);
    const fp = localStorage.getItem("punch_voter_id") || crypto.randomUUID();
    supabase.rpc("upsert_punch_user", {
      p_wallet_address: wallet,
      p_fingerprint: fp,
    }).then(() => {});
  };

  // Sync rate limit hook state → show cooldown popup on page load if blocked
  useEffect(() => {
    if (!rateLimit.isLoading && !rateLimit.allowed && rateLimit.waitSeconds > 0) {
      setRateLimitUntil(Date.now() + rateLimit.waitSeconds * 1000);
    }
  }, [rateLimit.isLoading, rateLimit.allowed, rateLimit.waitSeconds]);

  // Countdown timer for rate limit
  useEffect(() => {
    if (!rateLimitUntil) { setCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) { setRateLimitUntil(null); rateLimit.refresh(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitUntil]);

  useEffect(() => {
    decayTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime.current > 400 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current - DECAY_RATE);
        setProgress(progressRef.current);
      }
    }, 100);
    return () => {
      if (decayTimer.current) clearInterval(decayTimer.current);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    };
  }, []);

  const handleTap = useCallback(() => {
    if (state !== "tapping" || launchTriggered.current) return;
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    lastTapTime.current = now;
    tapCount.current++;
    reportPunches(1);

    if (tapCount.current >= 30 && !isValidWallet) {
      setShowWalletPrompt(true);
    }

    // At ~70% progress, shake wallet field if no valid wallet entered
    const nextProgress = Math.min(100, progressRef.current + (100 / TAPS_TO_WIN) * Math.min(multiplier, 3));
    if (nextProgress >= 70 && !isValidWallet) {
      setShowWalletPrompt(true);
      setWalletShake(true);
      setTimeout(() => setWalletShake(false), 600);
    }

    if (timeSinceLastTap < COMBO_WINDOW_MS && timeSinceLastTap > 0) {
      setCombo((c) => c + 1);
      setMultiplier((m) => Math.min(m + 0.1, 3));
    } else {
      setCombo(0);
      setMultiplier(1);
    }

    const increment = (100 / TAPS_TO_WIN) * Math.min(multiplier, 3);
    progressRef.current = Math.min(100, progressRef.current + increment);
    setProgress(progressRef.current);

    setShaking(true);
    setTapping(true);
    if (tapTimeout.current) clearTimeout(tapTimeout.current);
    tapTimeout.current = setTimeout(() => {
      setShaking(false);
      setTapping(false);
    }, 80);

    if (progressRef.current >= 100 && tapCount.current >= REQUIRED_TAPS) {
      if (!isValidWallet) {
        setShowWalletPrompt(true);
        progressRef.current = 99;
        setProgress(99);
        // Shake the wallet field to draw attention
        setWalletShake(true);
        setTimeout(() => setWalletShake(false), 600);
        return;
      }
      launchTriggered.current = true;
      if (decayTimer.current) clearInterval(decayTimer.current);
      setShowConfetti(true);
      setTimeout(() => launchToken(), 1500);
    }
  }, [state, multiplier, reportPunches, isValidWallet]);

  const launchToken = async () => {
    setState("launching");
    setLaunchError("");
    try {
      // Pre-check rate limit before calling punch-launch
      await rateLimit.refresh();
      if (!rateLimit.allowed) {
        const waitSec = rateLimit.waitSeconds || 180;
        setRateLimitUntil(Date.now() + waitSec * 1000);
        setState("tapping");
        setProgress(0);
        progressRef.current = 0;
        setShowConfetti(false);
        return;
      }

      const res = await supabase.functions.invoke("punch-launch", {
        body: { creatorWallet: wallet },
      });
      const data = res.data;
      const error = res.error;

      // Handle 429 rate limit — supabase.functions.invoke puts non-2xx body into res.error
      if (error) {
        // Try to parse rate limit info from the error
        let rateLimitData: any = null;
        try {
          // FunctionsHttpError contains the response context
          if (error.message) {
            const parsed = JSON.parse(error.message);
            if (parsed?.rateLimited) rateLimitData = parsed;
          }
        } catch {
          // Try getting it from error.context if available
          try {
            const ctx = (error as any).context;
            if (ctx && typeof ctx === 'object') {
              const body = await new Response(ctx.body).json();
              if (body?.rateLimited) rateLimitData = body;
            }
          } catch {}
        }

        if (rateLimitData) {
          const waitSec = rateLimitData.waitSeconds || 180;
          setRateLimitUntil(Date.now() + waitSec * 1000);
          setState("tapping");
          setProgress(0);
          progressRef.current = 0;
          setShowConfetti(false);
          return;
        }

        throw new Error(error.message || "Launch failed");
      }

      if (data?.error) throw new Error(data.error);

      setTokensLaunched((n) => n + 1);
      // Increment launch count in DB
      supabase.rpc("increment_punch_user_launches", { p_wallet_address: wallet }).then(() => {});
      // Refresh rate limit state after successful launch
      rateLimit.refresh();
      setResult({
        mintAddress: data.mintAddress,
        name: data.name,
        ticker: data.ticker,
        imageUrl: data.imageUrl,
        tokenId: data.tokenId,
      });
      setState("result");
    } catch (err: any) {
      console.error("[PunchTestPage] Launch error:", err);
      setLaunchError("Something went wrong, Punch will fix it within a few — let him know in the chat 🐵💬");
      launchTriggered.current = false;
      setState("tapping");
      setProgress(0);
      progressRef.current = 0;
      setShowConfetti(false);
      toast({ title: "Launch failed", description: "Something went wrong, Punch will fix it within a few!", variant: "destructive" });
    }
  };

  const resetGame = () => {
    setState("tapping");
    setProgress(0);
    setShowConfetti(false);
    setResult(null);
    tapCount.current = 0;
    progressRef.current = 0;
    launchTriggered.current = false;
    setShowWalletPrompt(false);
    decayTimer.current = setInterval(() => {
      const now = Date.now();
      if (now - lastTapTime.current > 400 && progressRef.current > 0) {
        progressRef.current = Math.max(0, progressRef.current - DECAY_RATE);
        setProgress(progressRef.current);
      }
    }, 100);
  };

  const copyAddress = () => {
    if (!result?.mintAddress) return;
    navigator.clipboard.writeText(result.mintAddress);
    setCopiedAddress(true);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const getBarColor = () => {
    if (progress < 33) return "from-green-500 to-green-400";
    if (progress < 66) return "from-yellow-500 to-yellow-400";
    return "from-orange-500 to-red-500";
  };

  const movePx = getMovePx();
  const moveY = getMoveY();
  const isLaunching = state === "launching";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000", position: "fixed", top: 0, left: 0 }}>
      <PunchConfetti active={showConfetti} />

      {/* ===== PURE ANIMATION LAYER — untouched from original ===== */}
      <div
        onClick={() => {
          if (showExtras || showFeed || showEarned) return;
          handleTap();
        }}
        className={shaking ? "punch-screen-shake" : ""}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: state === "tapping" ? "pointer" : "default",
          userSelect: "none",
          zIndex: 1,
        }}
      >
        {/* Branch + toy scene */}
        <div
          style={{
            position: "relative",
            marginRight: "2vw",
            marginTop: "-18vh",
            width: "72vw",
            maxWidth: 720,
            transform: "rotate(-7deg)",
            zIndex: 4,
            opacity: isLaunching ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: isLaunching ? "none" : undefined,
          }}
        >
          <img
            src="/branch.png"
            alt="branch"
            draggable={false}
            style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.08))", pointerEvents: "none" }}
          />
          <img
            src="/toy.png"
            alt="toy"
            draggable={false}
            style={{
              position: "absolute",
              left: "18%",
              top: "23%",
              width: "50%",
              height: "auto",
              zIndex: 6,
              pointerEvents: "none",
              transition: "transform 100ms ease-out",
              transform: `translate(${step * movePx}px, ${step * moveY}px) rotate(5deg)`,
              filter: "drop-shadow(0 6px 12px rgba(255,255,255,0.1))",
            }}
          />
        </div>

        {/* Baby monkey */}
        <img
          src="/monkey.png"
          alt="Monkey"
          draggable={false}
          style={{
            position: "absolute",
            width: "30vw",
            maxWidth: 420,
            height: "auto",
            zIndex: 2,
            filter: "drop-shadow(0 8px 16px rgba(255,255,255,0.1))",
            right: "calc(50% - 33vw)",
            bottom: "calc(50% - 32vw)",
            opacity: isLaunching ? 0 : 1,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: "none",
          }}
        />

        {/* Final hug image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            zIndex: 10,
            opacity: isLaunching ? 1 : 0,
            transition: "opacity 600ms ease-in-out",
            pointerEvents: isLaunching ? undefined : "none",
          }}
        >
          <img
            src="/final.png"
            alt="Victory"
            draggable={false}
            style={{ maxWidth: "80vw", maxHeight: "80vh", width: "auto", height: "auto", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* ===== TOP NAV BAR — integrated, professional ===== */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 70,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "10px 12px" : "12px 20px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
      }}>
        {/* Left — launched stat */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: isMobile ? 70 : 100 }}>
          <Rocket style={{ width: 14, height: 14, color: "#facc15", flexShrink: 0 }} />
          <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: isMobile ? 13 : 14, color: "#facc15" }}>
            {totalLaunched !== null ? totalLaunched.toLocaleString() : "0"}
          </span>
          <span style={{ fontSize: isMobile ? 9 : 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>launched</span>
        </div>

        {/* Right — nav pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="https://x.com/punchitsol"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 150ms ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="rgba(255,255,255,0.7)"/>
            </svg>
          </a>
          <button
            onClick={() => { setShowExtras(!showExtras); setShowFeed(false); setShowEarned(false); }}
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: showExtras ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showExtras ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11, fontWeight: 600, color: showExtras ? "#facc15" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease",
            }}
          >
            {showExtras ? <X style={{ width: 11, height: 11 }} /> : <MessageCircle style={{ width: 11, height: 11 }} />}
            {showExtras ? "Close" : "Chat"}
          </button>
          <button
            onClick={() => { setShowFeed(!showFeed); setShowExtras(false); setShowEarned(false); }}
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: showFeed ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showFeed ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11, fontWeight: 600, color: showFeed ? "#facc15" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease",
            }}
          >
            🔥 {showFeed ? "Close" : "Feed"}
          </button>
          <button
            onClick={() => { setShowEarned(!showEarned); setShowFeed(false); setShowExtras(false); }}
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: showEarned ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${showEarned ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 11, fontWeight: 600, color: showEarned ? "#facc15" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease",
            }}
          >
            💰 {showEarned ? "Close" : "Earned"}
          </button>
          <Link
            to="/punch-games"
            style={{
              padding: isMobile ? "5px 10px" : "5px 14px", borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              transition: "all 150ms ease", textDecoration: "none",
            }}
          >
            <Gamepad2 style={{ width: 11, height: 11 }} />
            Games
          </Link>
        </div>
      </div>

      {/* ===== HUD LAYER — tapping state overlays ===== */}
      {state === "tapping" && (
        <>
          {/* Title — centered below nav bar */}
          <div style={{
            position: "absolute", top: isMobile ? 48 : 54, left: 0, right: 0, zIndex: 50,
            textAlign: "center", pointerEvents: "none",
          }}>
            <h2 style={{
              fontSize: isMobile ? 15 : 20, fontWeight: 900, color: "#fff", margin: 0,
              letterSpacing: "-0.03em", lineHeight: 1.2,
              textShadow: "0 2px 12px rgba(0,0,0,0.6)",
            }}>
              PUNCH AND LAUNCH
            </h2>
            <p style={{ fontSize: isMobile ? 9 : 11, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
              Punch a stick to launch a coin.
            </p>
          </div>

          {/* Combo counter — right side, below nav */}
          <div style={{ position: "absolute", top: isMobile ? 80 : 95, right: isMobile ? 10 : 20, zIndex: 50 }}>
            <ComboCounter combo={combo} multiplier={multiplier} />
          </div>

          {/* Wallet prompt — always visible during tapping */}
          <div
            style={{ position: "absolute", bottom: isMobile ? 160 : 100, left: 16, right: 16, zIndex: 55 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                maxWidth: 380, margin: "0 auto", padding: 10, borderRadius: 12,
                border: `1px solid ${walletShake ? "rgba(239,68,68,0.7)" : walletSaved ? "rgba(34,197,94,0.7)" : "rgba(34,197,94,0.5)"}`,
                background: walletShake ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.08)",
                backdropFilter: "blur(8px)",
                animation: walletShake ? "wallet-shake 0.5s ease-in-out" : "none",
                transition: "border-color 0.3s, background 0.3s",
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, color: walletShake ? "#f87171" : walletSaved ? "rgba(34,197,94,0.9)" : "#fff", textAlign: "center", marginBottom: 6 }}>
                {walletShake ? "⚠️ Enter your wallet to launch!" : walletSaved ? "✅ Wallet saved! You can change it anytime." : "🐵 Enter your Solana address where to receive fees!"}
              </p>
              <Input
                placeholder="Your Solana wallet address"
                value={wallet}
                onChange={(e) => { setWallet(e.target.value.trim()); if (walletSaved) setWalletSaved(false); }}
                className="text-center font-mono text-xs bg-black/80 border-green-500/30 text-white focus:border-green-400/60 focus-visible:ring-green-500/50 focus-visible:border-green-400"
                onClick={(e) => e.stopPropagation()}
              />
              {isValidWallet && !walletSaved && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSaveWallet(); }}
                  style={{
                    marginTop: 8, width: "100%", padding: "6px 0", borderRadius: 8,
                    background: "rgba(34,197,94,0.8)", color: "#fff", fontWeight: 700,
                    fontSize: 12, border: "none", cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,197,94,1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,197,94,0.8)")}
                >
                  ✅ Save Wallet
                </button>
              )}
            </div>
          </div>

          {/* Progress bar — above wallet prompt */}
          <div style={{ position: "absolute", bottom: isMobile ? 250 : 190, left: "50%", transform: "translateX(-50%)", width: "60%", maxWidth: 300, zIndex: 50, pointerEvents: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div style={{ width: "100%", height: 10, borderRadius: 5, background: "rgba(255,255,255,0.15)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getBarColor()}`}
                style={{ width: `${Math.max(progress, 3)}%`, minWidth: 8, transition: "width 100ms", boxShadow: "0 0 10px rgba(255,255,255,0.2), 0 0 4px currentColor" }}
              />
            </div>
          </div>
        </>
      )}

      {/* Launching overlay text */}
      {isLaunching && (
        <div style={{
          position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 50,
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 22px", borderRadius: 999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 20px rgba(0,0,0,0.4), 0 0 40px rgba(255,165,0,0.08)",
          color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em",
          animation: "pulse 2s ease-in-out infinite",
        }}>
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#f59e0b" }} />
          Generating & launching on-chain…
        </div>
      )}

      {launchError && (
        <div className="absolute z-50 animate-fade-in" style={{ bottom: 60, left: "50%", transform: "translateX(-50%)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/15 border border-destructive/30 backdrop-blur-sm shadow-lg max-w-[300px]">
            <span className="text-lg shrink-0">🙈</span>
            <p className="text-[11px] leading-snug text-destructive font-medium">{launchError}</p>
          </div>
        </div>
      )}

      {/* ===== RESULT POPUP ===== */}
      {state === "result" && result && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); resetGame(); }}
        >
          <div
            style={{
              width: isMobile ? "90vw" : 380, maxWidth: 400,
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.2)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              padding: "24px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in"
          >
            <div className="text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <h2 className="text-xl font-black text-white">TOKEN LAUNCHED!</h2>

              {result.imageUrl && (
                <img src={result.imageUrl} alt={result.name} className="w-24 h-24 rounded-2xl mx-auto border-2 border-white/20 object-cover" />
              )}

              <div>
                <p className="text-base font-bold text-white">{result.name}</p>
                <p className="text-sm text-yellow-400 font-mono">${result.ticker}</p>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <code className="text-[11px] font-mono text-white/80 flex-1 truncate">{result.mintAddress}</code>
                <button onClick={copyAddress} className="text-white/50 hover:text-white">
                  {copiedAddress ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {tokensLaunched > 0 && (
                <p className="text-[11px] text-white/40">Tokens launched this session: {tokensLaunched}</p>
              )}

              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link to={`/punch/token/${result.mintAddress}`}>View Token</Link>
                </Button>
                <Button asChild variant="outline" size="icon">
                  <a href={`https://solscan.io/token/${result.mintAddress}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              <Button variant="ghost" onClick={resetGame} className="text-sm text-white/60 w-full">
                Launch Another
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== RATE LIMIT POPUP ===== */}
      {rateLimitUntil && countdown > 0 && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setRateLimitUntil(null); }}
        >
          <div
            style={{
              width: isMobile ? "85vw" : 340,
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.2)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              padding: "24px 20px",
            }}
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in"
          >
            <div className="text-center space-y-4">
              <div className="text-4xl">⏳</div>
              <h2 className="text-lg font-black text-white">Cooldown Active</h2>
              <p className="text-sm text-white/60">You're launching too fast! Wait a bit before punching again.</p>

              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "monospace", color: "#facc15" }}>
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
              </div>

              {tokensLaunched > 0 && (
                <p className="text-sm text-white/50">
                  🐵 Tokens launched this session: <span className="text-yellow-400 font-bold">{tokensLaunched}</span>
                </p>
              )}

              <Button variant="ghost" onClick={() => setRateLimitUntil(null)} className="text-sm text-white/60 w-full">
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FEED OVERLAY ===== */}
      {showFeed && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setShowFeed(false); }}
        >
          <div
            style={{
              width: isMobile ? "92vw" : 400, height: "75vh",
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.15)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PunchTokenFeed />
          </div>
        </div>
      )}

      {/* ===== CHAT OVERLAY ===== */}
      {showExtras && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setShowExtras(false); }}
        >
          <div
            style={{
              width: isMobile ? "92vw" : 400, maxHeight: "80vh",
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.15)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "auto", padding: "16px 12px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PunchLivestream />
            <PunchChatBox />

            {/* Roadmap */}
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 10,
              background: "rgba(250,204,21,0.06)",
              border: "1px solid rgba(250,204,21,0.12)",
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#facc15", marginBottom: 4 }}>
                🗺️ Roadmap
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: 8 }}>
                Currently working on Game sections and a full trading page.
              </p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, fontStyle: "italic" }}>
                Punch is vibe coding 24/7. I will show my progress and completed tasks here.
              </p>
            </div>

            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 8 }}>
              Limited to 3 launches per hour per IP
            </p>
          </div>
        </div>
      )}

      {/* ===== EARNED OVERLAY ===== */}
      {showEarned && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 65, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { e.stopPropagation(); setShowEarned(false); }}
        >
          <div
            style={{
              width: isMobile ? "92vw" : 400, maxHeight: "80vh",
              background: "rgba(15,15,15,0.98)", borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.15)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <PunchEarnedPanel />
          </div>
        </div>
      )}

      {/* Floating video popup — opens chat */}
      <PunchVideoPopup onVideoClick={() => { setShowExtras(true); setShowFeed(false); setShowEarned(false); }} />

      {/* ===== MONKEY-THEMED STATS BAR — bottom ===== */}
      <PunchStatsFooter />
    </div>
  );
}
