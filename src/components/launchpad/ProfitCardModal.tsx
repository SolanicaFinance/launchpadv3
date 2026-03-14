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
  const pnl = data.pnlPercent ?? 0;
  const isPositive = pnl >= 0;
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
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `saturn-${data.tokenTicker}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Save image failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleShareX = async () => {
    const text = `${isPositive ? "🟢" : "🔴"} ${isBuy ? "Bought" : "Sold"} $${data.tokenTicker} | P&L: ${isPositive ? "+" : ""}${pnl.toFixed(2)}% | ${data.amountSol.toFixed(4)} SOL\n\nTrade on ${BRAND.twitterHandle} 🪐\n${qrLink}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank"
    );
    await handleSaveImage();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[440px] p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">Trade Profit Card</DialogTitle>
        <div className="flex flex-col items-center gap-4">
          {/* The Profit Card */}
          <div
            ref={cardRef}
            className="w-[400px] rounded-2xl overflow-hidden relative"
            style={{
              background: "linear-gradient(145deg, #050a08 0%, #0a1a10 30%, #0d1f14 50%, #081610 80%, #030906 100%)",
            }}
          >
            {/* Cosmic glow overlays */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at 30% 20%, rgba(200,255,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(132,204,22,0.06) 0%, transparent 50%)",
              }}
            />
            {/* Saturn ring decoration */}
            <div
              className="absolute -right-12 -top-12 w-40 h-40 pointer-events-none opacity-10"
              style={{
                background: "radial-gradient(circle, transparent 40%, rgba(200,255,0,0.3) 42%, transparent 44%, transparent 58%, rgba(200,255,0,0.15) 60%, transparent 62%)",
              }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <img src={saturnLogo} alt="Saturn" className="w-6 h-6" />
                <span className="text-[#c8ff00] font-bold text-sm tracking-[0.2em] uppercase">SATURN.TRADE</span>
              </div>
              <span className="text-white/25 text-[10px] font-mono">{timeStr}</span>
            </div>

            {/* User info */}
            <div className="px-5 pb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(200,255,0,0.3), rgba(132,204,22,0.2))",
                    boxShadow: "0 0 12px rgba(200,255,0,0.15)",
                  }}
                >
                  <span className="text-[10px]">🪐</span>
                </div>
                <span className="text-white/60 text-xs font-mono">{truncatedWallet}</span>
              </div>
            </div>

            {/* P&L Section — glassmorphic card */}
            <div
              className="mx-4 rounded-xl mb-3 relative z-10 overflow-hidden"
              style={{
                background: "rgba(200,255,0,0.03)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(200,255,0,0.08)",
                boxShadow: isPositive
                  ? "inset 0 1px 0 rgba(200,255,0,0.1), 0 0 30px rgba(200,255,0,0.05)"
                  : "inset 0 1px 0 rgba(255,82,82,0.1), 0 0 30px rgba(255,82,82,0.05)",
              }}
            >
              {/* Inner glow accent */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: isPositive
                    ? "radial-gradient(ellipse at 20% 50%, rgba(200,255,0,0.06) 0%, transparent 60%)"
                    : "radial-gradient(ellipse at 20% 50%, rgba(255,82,82,0.06) 0%, transparent 60%)",
                }}
              />

              <div className="px-5 py-5 relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-white/35 text-[9px] font-mono uppercase tracking-[0.25em] mb-2">Profit & Loss</div>
                    <div
                      className="text-4xl font-bold font-mono"
                      style={{
                        color: isPositive ? "#c8ff00" : "#ff5252",
                        textShadow: isPositive
                          ? "0 0 20px rgba(200,255,0,0.4), 0 0 40px rgba(200,255,0,0.15)"
                          : "0 0 20px rgba(255,82,82,0.4), 0 0 40px rgba(255,82,82,0.15)",
                      }}
                    >
                      {isPositive ? "+" : ""}{pnl.toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/35 text-[9px] font-mono uppercase tracking-[0.25em] mb-2">Amount</div>
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{ color: isPositive ? "#c8ff00" : "#ff5252" }}
                    >
                      {isPositive ? "+" : ""}{data.amountSol.toFixed(4)}
                    </div>
                    <div className="text-white/30 text-xs font-mono mt-0.5">SOL</div>
                  </div>
                </div>

                {/* Token info row */}
                <div className="mt-4 flex items-center gap-2">
                  {data.tokenImageUrl ? (
                    <img src={data.tokenImageUrl} alt={data.tokenTicker} className="w-6 h-6 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/60">
                      {data.tokenTicker.slice(0, 2)}
                    </div>
                  )}
                  <span
                    className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-md"
                    style={{
                      background: isBuy ? "rgba(200,255,0,0.12)" : "rgba(255,82,82,0.12)",
                      color: isBuy ? "#c8ff00" : "#ff5252",
                      border: `1px solid ${isBuy ? "rgba(200,255,0,0.2)" : "rgba(255,82,82,0.2)"}`,
                    }}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>
                  <span className="text-white font-mono text-sm font-bold">${data.tokenTicker}</span>
                  <span className="text-white/25 text-xs font-mono">{data.tokenName}</span>
                </div>
              </div>
            </div>

            {/* QR Code + Referral */}
            <div className="px-5 pb-4 flex items-end justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div
                  className="p-1.5 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    boxShadow: "0 0 12px rgba(200,255,0,0.15)",
                  }}
                >
                  <QRCode value={qrLink} size={60} level="M" />
                </div>
                <div>
                  <div className="text-white/25 text-[8px] font-mono uppercase tracking-[0.25em] mb-1">Referral</div>
                  <div className="text-white/45 text-[10px] font-mono break-all max-w-[150px] leading-relaxed">
                    {qrLink.replace("https://", "").replace("http://", "")}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <img src={saturnLogo} alt="" className="w-4 h-4 opacity-30" />
                <div className="text-white/15 text-[9px] font-mono">{dateStr}</div>
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
