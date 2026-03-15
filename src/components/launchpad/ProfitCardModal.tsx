import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download } from "lucide-react";
import QRCode from "react-qr-code";
import { useReferralCode } from "@/hooks/useReferral";
import { useAuth } from "@/hooks/useAuth";
import saturnLogo from "@/assets/saturn-logo.png";
import { BRAND } from "@/config/branding";

export interface ProfitCardData {
  action: "buy" | "sell";
  amountSol: number;
  tokenTicker: string;
  tokenName: string;
  outputAmount?: number;
  pnlPercent?: number;
  signature?: string;
  tokenImageUrl?: string;
}

interface ProfitCardModalProps {
  open: boolean;
  onClose: () => void;
  data: ProfitCardData | null;
}

export function ProfitCardModal({ open, onClose, data }: ProfitCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { referralLink } = useReferralCode();
  const { solanaAddress } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!data) return null;

  const isBuy = data.action === "buy";
  const hasPnl = data.pnlPercent !== undefined && data.pnlPercent !== null;
  const pnl = data.pnlPercent ?? 0;
  const isPositive = isBuy || pnl >= 0;
  const qrLink = referralLink || "https://saturn.trade/";
  const truncatedWallet = solanaAddress
    ? `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}`
    : "—";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const handleSaveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      // Generate at 3x for high quality
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        quality: 1.0,
        // Ensure fonts are embedded
        fontEmbedCSS: '',
        // Skip external images that might fail CORS
        filter: (node: HTMLElement) => {
          // Skip hidden/zero-size elements
          if (node.tagName === 'NOSCRIPT') return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `saturn-${data.tokenTicker}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Save image failed, trying fallback:", e);
      // Fallback to html2canvas
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(cardRef.current!, {
          backgroundColor: null,
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        const link = document.createElement("a");
        link.download = `saturn-${data.tokenTicker}-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (e2) {
        console.error("Fallback save also failed:", e2);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleShareX = async () => {
    const pnlText = hasPnl ? ` | P&L: ${isPositive ? "+" : ""}${pnl.toFixed(2)}%` : "";
    const text = `${isBuy ? "🟢 Bought" : "🔴 Sold"} $${data.tokenTicker}${pnlText} | ${data.amountSol.toFixed(4)} SOL\n\nTrade on ${BRAND.twitterHandle} 🪐\n${qrLink}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank"
    );
    await handleSaveImage();
  };

  // Use inline styles only (no Tailwind classes that might not render in export)
  // and avoid backdrop-filter which doesn't export
  const accentColor = isPositive ? "#c8ff00" : "#ff5252";
  const accentGlow = isPositive
    ? "0 0 20px rgba(200,255,0,0.4), 0 0 40px rgba(200,255,0,0.15)"
    : "0 0 20px rgba(255,82,82,0.4), 0 0 40px rgba(255,82,82,0.15)";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[440px] p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">Trade Profit Card</DialogTitle>
        <div className="flex flex-col items-center gap-4">
          {/* The Profit Card — all inline styles for perfect export fidelity */}
          <div
            ref={cardRef}
            style={{
              width: 400,
              borderRadius: 16,
              overflow: "hidden",
              position: "relative",
              background: "linear-gradient(145deg, #050a08 0%, #0a1a10 30%, #0d1f14 50%, #081610 80%, #030906 100%)",
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace",
            }}
          >
            {/* Cosmic glow overlays — using solid-ish backgrounds instead of backdrop-filter */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "radial-gradient(ellipse at 30% 20%, rgba(200,255,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(132,204,22,0.06) 0%, transparent 50%)",
              }}
            />
            {/* Saturn ring decoration */}
            <div
              style={{
                position: "absolute",
                right: -48,
                top: -48,
                width: 160,
                height: 160,
                pointerEvents: "none",
                opacity: 0.1,
                background: "radial-gradient(circle, transparent 40%, rgba(200,255,0,0.3) 42%, transparent 44%, transparent 58%, rgba(200,255,0,0.15) 60%, transparent 62%)",
              }}
            />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px 20px", position: "relative", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src={saturnLogo} alt="Saturn" style={{ width: 24, height: 24 }} crossOrigin="anonymous" />
                <span style={{ color: "#c8ff00", fontWeight: 700, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase" as const }}>SATURN.TRADE</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "monospace" }}>{timeStr}</span>
            </div>

            {/* User info */}
            <div style={{ padding: "0 20px 12px 20px", position: "relative", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, rgba(200,255,0,0.3), rgba(132,204,22,0.2))",
                    boxShadow: "0 0 12px rgba(200,255,0,0.15)",
                  }}
                >
                  <span style={{ fontSize: 10 }}>🪐</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "monospace" }}>{truncatedWallet}</span>
              </div>
            </div>

            {/* P&L Section — solid background instead of backdrop-filter for export */}
            <div
              style={{
                margin: "0 16px 12px 16px",
                borderRadius: 12,
                position: "relative",
                zIndex: 10,
                overflow: "hidden",
                background: isPositive
                  ? "linear-gradient(135deg, rgba(200,255,0,0.06) 0%, rgba(10,26,16,0.95) 100%)"
                  : "linear-gradient(135deg, rgba(255,82,82,0.06) 0%, rgba(26,10,10,0.95) 100%)",
                border: `1px solid ${isPositive ? "rgba(200,255,0,0.12)" : "rgba(255,82,82,0.12)"}`,
                boxShadow: isPositive
                  ? "inset 0 1px 0 rgba(200,255,0,0.1), 0 0 30px rgba(200,255,0,0.05)"
                  : "inset 0 1px 0 rgba(255,82,82,0.1), 0 0 30px rgba(255,82,82,0.05)",
              }}
            >
              {/* Inner glow accent */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: isPositive
                    ? "radial-gradient(ellipse at 20% 50%, rgba(200,255,0,0.06) 0%, transparent 60%)"
                    : "radial-gradient(ellipse at 20% 50%, rgba(255,82,82,0.06) 0%, transparent 60%)",
                }}
              />

              <div style={{ padding: "20px", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: "monospace", textTransform: "uppercase" as const, letterSpacing: "0.25em", marginBottom: 8 }}>
                      {hasPnl ? 'Profit & Loss' : (isBuy ? 'Invested' : 'Received')}
                    </div>
                    {hasPnl ? (
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          color: accentColor,
                          textShadow: accentGlow,
                          lineHeight: 1.1,
                        }}
                      >
                        {isPositive ? "+" : ""}{pnl.toFixed(2)}%
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 30,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          color: isBuy ? "#c8ff00" : "#22c55e",
                          textShadow: "0 0 20px rgba(200,255,0,0.3)",
                          lineHeight: 1.1,
                        }}
                      >
                        {data.amountSol.toFixed(4)}
                        <span style={{ fontSize: 18, marginLeft: 4, color: "rgba(255,255,255,0.4)" }}>SOL</span>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" as const }}>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: "monospace", textTransform: "uppercase" as const, letterSpacing: "0.25em", marginBottom: 8 }}>
                      {hasPnl ? 'Amount' : (isBuy ? 'Spent' : 'Received')}
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        color: accentColor,
                      }}
                    >
                      {isBuy ? "-" : "+"}{data.amountSol.toFixed(4)}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>SOL</div>
                  </div>
                </div>

                {/* Token info row */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  {data.tokenImageUrl ? (
                    <img
                      src={data.tokenImageUrl}
                      alt={data.tokenTicker}
                      style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" as const, border: "1px solid rgba(255,255,255,0.1)" }}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
                      {data.tokenTicker.slice(0, 2)}
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: isBuy ? "rgba(200,255,0,0.12)" : "rgba(255,82,82,0.12)",
                      color: isBuy ? "#c8ff00" : "#ff5252",
                      border: `1px solid ${isBuy ? "rgba(200,255,0,0.2)" : "rgba(255,82,82,0.2)"}`,
                    }}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>
                  <span style={{ color: "white", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>${data.tokenTicker}</span>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "monospace" }}>{data.tokenName}</span>
                </div>
              </div>
            </div>

            {/* QR Code + Referral */}
            <div style={{ padding: "0 20px 16px 20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.95)",
                    boxShadow: "0 0 12px rgba(200,255,0,0.15)",
                  }}
                >
                  <QRCode value={qrLink} size={60} level="M" />
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontFamily: "monospace", textTransform: "uppercase" as const, letterSpacing: "0.25em", marginBottom: 4 }}>Referral</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" as const, maxWidth: 150, lineHeight: 1.5 }}>
                    {qrLink.replace("https://", "").replace("http://", "")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                <img src={saturnLogo} alt="" style={{ width: 16, height: 16, opacity: 0.3 }} crossOrigin="anonymous" />
                <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 9, fontFamily: "monospace" }}>{dateStr}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full max-w-[400px]">
            <Button
              onClick={handleShareX}
              className="flex-1 h-11 font-mono text-xs uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #c8ff00, #84cc16)",
                color: "#050a08",
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Share to X
            </Button>
            <Button
              onClick={handleSaveImage}
              disabled={saving}
              className="flex-1 h-11 font-mono text-xs uppercase tracking-widest"
              style={{
                background: "linear-gradient(135deg, #c8ff00, #84cc16)",
                color: "#050a08",
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save Image"}
            </Button>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs font-mono transition-colors"
          >
            Skip
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
