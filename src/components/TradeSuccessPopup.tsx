import { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  X,
  ExternalLink,
  Copy,
  CheckCheck,
  TrendingUp,
  TrendingDown,
  Coins,
  ImagePlus,
  BarChart3,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTradeSuccessStore } from "@/stores/tradeSuccessStore";
import { ProfitCardModal, type ProfitCardData } from "@/components/launchpad/ProfitCardModal";

const AUTO_DISMISS_BUY_MS = 6000;
const AUTO_DISMISS_SELL_MS = 15000;

function truncateSig(sig: string, chars = 6) {
  if (sig.length <= chars * 2) return sig;
  return `${sig.slice(0, chars)}...${sig.slice(-chars)}`;
}

export function TradeSuccessPopup() {
  const { isVisible, data, hide } = useTradeSuccessStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showProfitCard, setShowProfitCard] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (isVisible && data) {
      setCopied(false);
      setShowProfitCard(false);
      const ms = data.type === "sell" ? AUTO_DISMISS_SELL_MS : AUTO_DISMISS_BUY_MS;
      timerRef.current = setTimeout(hide, ms);
      return clearTimer;
    }
  }, [isVisible, hide, data, clearTimer]);

  const handleCopy = useCallback(() => {
    if (!data?.signature) return;
    navigator.clipboard.writeText(data.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data?.signature]);

  const handleViewTx = useCallback(() => {
    if (!data?.signature) return;
    window.open(`https://solscan.io/tx/${data.signature}`, "_blank");
  }, [data?.signature]);

  const handleGeneratePnl = useCallback(() => {
    clearTimer(); // Pause auto-dismiss
    setShowProfitCard(true);
  }, [clearTimer]);

  const handleCloseProfitCard = useCallback(() => {
    setShowProfitCard(false);
    hide();
  }, [hide]);

  if (!data) return null;

  const isSell = data.type === "sell";
  const headline = isSell
    ? `Sold ${data.amount || "100%"} of $${data.ticker}`
    : `Bought ${data.amount || ""} $${data.ticker}`;
  const subtitle = isSell ? "SELL COMPLETED" : "BUY COMPLETED";

  const profitCardData: ProfitCardData | null = data
    ? {
        action: data.type,
        amountSol: data.pnlSol ?? 0,
        tokenTicker: data.ticker,
        tokenName: data.tokenName || data.ticker,
        pnlPercent: data.pnlPercent,
        signature: data.signature,
        tokenImageUrl: data.tokenImageUrl,
      }
    : null;

  return (
    <>
      <AnimatePresence>
        {isVisible && !showProfitCard && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={hide}
            />

            {/* Card */}
            <motion.div
              className="fixed z-[9999] left-1/2 top-1/2 w-[min(420px,calc(100vw-32px))]"
              initial={{ opacity: 0, scale: 0.92, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
            >
              <div className="trade-success-card rounded-2xl border border-white/[0.08] p-5 relative overflow-hidden">
                {/* Glow accent top */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

                {/* Close button */}
                <button
                  onClick={hide}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Header label */}
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-400/70 mb-3 font-mono">
                  {subtitle}
                </p>

                {/* Main row: token icon + check + headline */}
                <div className="flex items-center gap-3 mb-4">
                  {/* Token icon */}
                  {data.tokenImageUrl ? (
                    <img
                      src={data.tokenImageUrl}
                      alt={data.ticker}
                      className="w-10 h-10 rounded-full border border-white/[0.08] flex-shrink-0 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <Coins className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {/* Animated check */}
                  <motion.div
                    className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: "spring", damping: 12 }}
                  >
                    <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">
                    {headline}
                  </h2>
                </div>

                {/* Progress bar — 100% filled */}
                <div className="relative w-full h-1.5 rounded-full bg-white/[0.06] mb-4 overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                  />
                  <span className="absolute right-0 -top-4 text-[9px] font-mono text-emerald-400/60">
                    100% FILLED
                  </span>
                </div>

                {/* Details grid */}
                <div className="space-y-2.5 mb-4">
                  {/* TX Hash */}
                  {data.signature && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Transaction</span>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-mono text-foreground/70 hover:text-foreground transition-colors cursor-pointer group"
                      >
                        <span>{truncateSig(data.signature, 8)}</span>
                        {copied ? (
                          <CheckCheck className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-white/20 group-hover:text-white/50 transition-colors" />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Agent */}
                  {data.agentName && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Agent</span>
                      <span className="text-xs font-medium text-foreground/70">
                        {data.agentName}
                      </span>
                    </div>
                  )}

                  {/* PnL (sell only) */}
                  {isSell && data.pnlSol != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">PnL</span>
                      <span className={`flex items-center gap-1.5 text-xs font-mono font-semibold ${
                        data.pnlSol >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {data.pnlSol >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {data.pnlSol >= 0 ? '+' : ''}{data.pnlSol.toFixed(4)} SOL
                        {data.pnlPercent != null && (
                          <span className="text-[10px] opacity-70">
                            ({data.pnlPercent >= 0 ? '+' : ''}{data.pnlPercent.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  {/* View TX button */}
                  {data.signature && (
                    <button
                      onClick={handleViewTx}
                      className="w-full h-10 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      View Transaction
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Trade & Portfolio row */}
                  <div className="flex gap-2">
                    {data.mintAddress && (
                      <button
                        onClick={() => {
                          hide();
                          navigate(`/trade/${data.mintAddress}`);
                        }}
                        className="flex-1 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] text-foreground/80 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Trade
                      </button>
                    )}
                    <button
                      onClick={() => {
                        hide();
                        navigate("/panel");
                      }}
                      className="flex-1 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.14] text-foreground/80 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Portfolio
                    </button>
                  </div>

                  {/* Generate PnL Card button (sell only) */}
                  {isSell && (
                    <button
                      onClick={handleGeneratePnl}
                      className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border"
                      style={{
                        background: "rgba(200,255,0,0.08)",
                        borderColor: "rgba(200,255,0,0.2)",
                        color: "#c8ff00",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(200,255,0,0.15)";
                        e.currentTarget.style.borderColor = "rgba(200,255,0,0.35)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(200,255,0,0.08)";
                        e.currentTarget.style.borderColor = "rgba(200,255,0,0.2)";
                      }}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      Generate PnL Card
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ProfitCardModal */}
      <ProfitCardModal
        open={showProfitCard}
        onClose={handleCloseProfitCard}
        data={profitCardData}
      />
    </>
  );
}
