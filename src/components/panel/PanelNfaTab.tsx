import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Fingerprint, Loader2, Zap, Users, TrendingUp, Bot,
  CheckCircle2, ExternalLink, Globe, Coins,
  Sparkles, Upload, X, ArrowLeft, AlertTriangle, Tag, ShoppingCart,
  Shield, Copy, Check, RefreshCw, ArrowDownToLine,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import QRCode from "react-qr-code";

const TREASURY_WALLET = "HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const MINT_PRICE_SOL = 1.0;

interface NfaBatch {
  id: string;
  batch_number: number;
  total_slots: number;
  minted_count: number;
  status: string;
}

interface NfaMint {
  id: string;
  slot_number: number;
  minter_wallet: string;
  owner_wallet: string | null;
  status: string;
  agent_name: string | null;
  agent_image_url: string | null;
  token_name: string | null;
  token_ticker: string | null;
  token_image_url: string | null;
  nfa_mint_address: string | null;
  listed_for_sale: boolean;
  listing_price_sol: number | null;
  created_at: string;
}

type MintStep = "customize" | "confirm" | "minting" | "done";

/* ───────── Large Preview Card ───────── */
function NfaPreviewCardLarge({ name, ticker, imageUrl, slot }: { name: string; ticker: string; imageUrl: string | null; slot?: number }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div
        className="w-full max-w-[360px] aspect-square rounded-2xl overflow-hidden relative border border-white/10 transition-all duration-500"
        style={{
          background: "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(34,197,94,0.03))",
          boxShadow: imageUrl ? "0 0 60px rgba(74,222,128,0.12)" : "none",
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover animate-[fadeIn_0.4s_ease]" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Fingerprint className="h-16 w-16 opacity-20" style={{ color: "#4ade80" }} />
            <p className="text-xs text-white/30 font-mono">Generate or upload an image</p>
          </div>
        )}
        {slot && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-black/70 backdrop-blur-sm text-white">
            #{slot}
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <p className="font-bold text-base truncate max-w-[280px]">{name || "Unnamed Agent"}</p>
        <p className="text-sm text-white/50 font-mono mt-0.5">${ticker || "TICKER"}</p>
      </div>
    </div>
  );
}

/* ───────── Small Preview Card (for grids) ───────── */
function NfaPreviewCard({ name, ticker, imageUrl, slot }: { name: string; ticker: string; imageUrl: string | null; slot?: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] max-w-[200px] mx-auto">
      <div className="aspect-square relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.1), rgba(34,197,94,0.05))" }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Fingerprint className="h-10 w-10 opacity-30" style={{ color: "#4ade80" }} />
          </div>
        )}
        {slot && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
            #{slot}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-sm truncate">{name || "Unnamed Agent"}</p>
        <p className="text-xs text-muted-foreground font-mono">${ticker || "TICKER"}</p>
      </div>
    </div>
  );
}

/* ───────── Customize-Then-Mint Flow ───────── */
function NfaMintFlow({ batch, solanaAddress }: { batch: NfaBatch; solanaAddress: string }) {
  const [step, setStep] = useState<MintStep>("customize");
  const [tokenName, setTokenName] = useState("");
  const [tokenTicker, setTokenTicker] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<"ai" | "upload" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<any>(null);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [embeddedBalance, setEmbeddedBalance] = useState<number | null>(null);
  const [depositCopied, setDepositCopied] = useState(false);
  const [balanceAtOpen, setBalanceAtOpen] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { signAndSendTransaction, isWalletReady, walletAddress: embeddedWalletAddress, getBalance } = useSolanaWalletWithPrivy();

  // The embedded wallet is the one that signs & pays
  const mintWalletAddress = embeddedWalletAddress || solanaAddress;

  // Fetch embedded wallet balance periodically
  useEffect(() => {
    if (!embeddedWalletAddress) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const bal = await getBalance();
        if (!cancelled) setEmbeddedBalance(bal);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [embeddedWalletAddress, getBalance]);

  // Deposit detection polling when dialog is open
  useEffect(() => {
    if (!showDepositDialog || !embeddedWalletAddress) return;
    const interval = setInterval(async () => {
      try {
        const currentBal = await getBalance();
        setEmbeddedBalance(currentBal);
        const openingBal = balanceAtOpen ?? 0;
        if (currentBal > openingBal + 0.0001) {
          toast.success(`🎉 Deposit received! +${(currentBal - openingBal).toFixed(4)} SOL`);
          setTimeout(() => setShowDepositDialog(false), 1500);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [showDepositDialog, embeddedWalletAddress, getBalance, balanceAtOpen]);

  const nameValid = tokenName.trim().length > 0 && tokenName.trim().length <= 32;
  const tickerValid = /^[A-Z0-9.]+$/.test(tokenTicker.toUpperCase()) && tokenTicker.trim().length > 0 && tokenTicker.trim().length <= 10;
  const canContinue = nameValid && tickerValid && !!imageUrl;

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-generate-image", {
        body: { tokenName: tokenName.trim(), tokenTicker: tokenTicker.trim().toUpperCase() },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      if (resp?.imageUrl) {
        setImageUrl(resp.imageUrl);
        setImageSource("ai");
        toast.success("Image generated!");
      }
    } catch (err: any) {
      toast.error(err.message || "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Only PNG, JPG, or WebP allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max file size is 2MB");
      return;
    }
    setUploading(true);
    try {
      const fileName = `nfa/upload-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("post-images").upload(fileName, file, { contentType: file.type });
      if (error) throw error;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/post-images/${fileName}`;
      setImageUrl(url);
      setImageSource("upload");
      toast.success("Image uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMint = async () => {
    console.log("[NFA-MINT] handleMint called", {
      mintWalletAddress,
      embeddedWalletAddress,
      solanaAddress,
      isWalletReady,
    });

    // Use mintWalletAddress even if isWalletReady is false — the embedded wallet
    // address is enough; the Privy ready/authenticated flags may lag behind.
    const payingWallet = mintWalletAddress;
    if (!payingWallet) {
      toast.error("No wallet available. Please log in first.");
      console.error("[NFA-MINT] No wallet address available");
      return;
    }

    // Check embedded wallet balance first
    try {
      const bal = await getBalance();
      console.log("[NFA-MINT] Embedded balance:", bal);
      setEmbeddedBalance(bal);
      if (bal < MINT_PRICE_SOL + 0.005) {
        setBalanceAtOpen(bal);
        setShowDepositDialog(true);
        toast.error(`Insufficient balance (${bal.toFixed(4)} SOL). You need at least ${MINT_PRICE_SOL} SOL + fees.`);
        return;
      }
    } catch (balErr) {
      console.error("[NFA-MINT] Balance check failed:", balErr);
    }

    setMinting(true);
    setStep("minting");
    try {
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const rpcUrl = localStorage.getItem("heliusRpcUrl")
        || (window as any)?.__PUBLIC_CONFIG__?.heliusRpcUrl
        || import.meta.env.VITE_HELIUS_RPC_URL
        || (import.meta.env.VITE_HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}` : null)
        || "https://mainnet.helius-rpc.com";
      console.log("[NFA-MINT] RPC URL:", rpcUrl);

      const connection = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(payingWallet);
      const toPubkey = new PublicKey(TREASURY_WALLET);
      const lamports = Math.floor(MINT_PRICE_SOL * LAMPORTS_PER_SOL);
      console.log("[NFA-MINT] Building tx:", { from: payingWallet, to: TREASURY_WALLET, lamports });

      const transaction = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      );
      toast.info("Approve the transaction in your wallet...");

      console.log("[NFA-MINT] Requesting signAndSendTransaction...");
      const { signature, confirmed } = await signAndSendTransaction(transaction);
      console.log("[NFA-MINT] Tx result:", { signature, confirmed });

      if (!confirmed) { toast.error("Transaction not confirmed"); setStep("confirm"); setMinting(false); return; }
      toast.info("Payment confirmed! Minting your NFA on-chain...");

      console.log("[NFA-MINT] Calling nfa-mint edge function...");
      const { data, error } = await supabase.functions.invoke("nfa-mint", {
        body: {
          minterWallet: payingWallet,
          paymentSignature: signature,
          tokenName: tokenName.trim(),
          tokenTicker: tokenTicker.trim().toUpperCase(),
          tokenImageUrl: imageUrl,
        },
      });

      console.log("[NFA-MINT] Edge function response:", { data, error });
      if (error) { toast.error("Mint failed: " + error.message); setStep("confirm"); setMinting(false); return; }
      const resp = data as any;
      if (resp?.error) { toast.error(resp.error); setStep("confirm"); setMinting(false); return; }
      setMintResult(resp.mint);
      toast.success(`🦞 NFA #${resp.mint?.slotNumber} minted!`);
      queryClient.invalidateQueries({ queryKey: ["nfa-batch-current"] });
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
      setStep("done");
    } catch (err: any) {
      console.error("[NFA-MINT] Mint error:", err);
      if (err.message?.includes("User rejected") || err.message?.includes("cancelled")) {
        toast.info("Transaction cancelled");
      } else {
        toast.error(err.message || "Mint failed");
      }
      setStep("confirm");
    } finally {
      setMinting(false);
    }
  };

  if (step === "customize") {
    return (
      <div className="space-y-6">
        {/* Desktop: side-by-side form + preview */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Form — left side on desktop */}
          <div className="flex-1 min-w-0 space-y-5">
            <div>
              <h3 className="font-bold text-lg lg:text-xl mb-1 text-[#F1F5F9]">Customize Your NFA</h3>
              <p className="text-sm text-white/50">Define your agent's identity before minting</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Token Name</label>
                <Input
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder="e.g. Neptune Agent"
                  maxLength={32}
                  className="bg-white/[0.04] border-white/10 text-sm h-11 rounded-xl"
                />
                <p className="text-[11px] text-white/30 mt-1.5 font-mono">{tokenName.length}/32</p>
              </div>
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Ticker</label>
                <Input
                  value={tokenTicker}
                  onChange={e => setTokenTicker(e.target.value.replace(/[^A-Za-z0-9.]/g, "").toUpperCase())}
                  placeholder="e.g. NEPTUNE"
                  maxLength={10}
                  className="bg-white/[0.04] border-white/10 text-sm font-mono h-11 rounded-xl"
                />
                <p className="text-[11px] text-white/30 mt-1.5 font-mono">{tokenTicker.length}/10</p>
              </div>

              {/* Image buttons */}
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Agent Image</label>
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerateAI}
                    disabled={generating || uploading}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-[#4ade80]/30 transition-all disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" style={{ color: "#4ade80" }} />}
                    Generate AI
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating || uploading}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-all disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
                </div>
                {imageUrl && (
                  <div className="flex items-center gap-2 mt-2.5 text-sm text-white/60">
                    <CheckCircle2 className="h-4 w-4" style={{ color: "#4ade80" }} />
                    {imageSource === "ai" ? "AI-generated" : "Uploaded"} image
                    <button onClick={() => { setImageUrl(null); setImageSource(null); }} className="ml-auto hover:text-white transition-colors"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            </div>

            {/* CTA button — visible on desktop within form column */}
            <button
              onClick={() => setStep("confirm")}
              disabled={!canContinue}
              className={`w-full h-12 rounded-xl font-bold font-mono text-sm flex items-center justify-center gap-2 transition-all duration-200 border hover:scale-[1.01] ${canContinue ? "border-green-400/50 bg-gradient-to-r from-green-500 to-green-600 text-black shadow-[0_0_20px_rgba(74,222,128,0.3)] hover:shadow-[0_0_30px_rgba(74,222,128,0.4)]" : "border-green-500/20 bg-green-500/10 text-green-400/50"}`}
            >
              {!nameValid && tokenName.length > 0 ? "Invalid name" : !nameValid ? "Enter agent name" : !tickerValid && tokenTicker.length > 0 ? "Invalid ticker" : !tickerValid ? "Enter ticker" : !imageUrl ? "Upload or generate image" : "Continue to Payment"}
            </button>
          </div>

          {/* Preview — right side on desktop, large */}
          <div className="lg:w-[45%] flex-shrink-0">
            <div
              className="rounded-2xl border border-white/[0.08] h-full min-h-[320px] lg:min-h-[460px]"
              style={{ background: "rgba(10,14,26,0.6)", backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
                <span className="text-[11px] text-white/30 uppercase tracking-widest font-mono">Preview</span>
              </div>
              <NfaPreviewCardLarge name={tokenName} ticker={tokenTicker} imageUrl={imageUrl} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={() => setStep("customize")} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to customize
        </button>

        <div className="text-center">
          <h3 className="font-bold text-xl mb-2 text-[#F1F5F9]">Confirm & Mint</h3>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium mt-1" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Cannot be changed after minting
          </div>
        </div>

        <div className="flex justify-center">
          <NfaPreviewCard name={tokenName} ticker={tokenTicker} imageUrl={imageUrl} />
        </div>

        {/* Embedded wallet info */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          {[
            { k: "Token Name", v: tokenName.trim() },
            { k: "Ticker", v: `$${tokenTicker.toUpperCase()}` },
            { k: "Image", v: imageSource === "ai" ? "AI Generated" : "Uploaded" },
            { k: "Mint Price", v: "1 SOL" },
          ].map(({ k, v }) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-white/50">{k}</span>
              <span className="font-mono font-medium">{v}</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Paying from</span>
              <span className="font-mono font-medium text-xs">
                {mintWalletAddress ? `${mintWalletAddress.slice(0, 6)}...${mintWalletAddress.slice(-4)}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1.5">
              <span className="text-white/50">Embedded balance</span>
              <span className={`font-mono font-medium ${(embeddedBalance ?? 0) < MINT_PRICE_SOL + 0.005 ? "text-red-400" : "text-green-400"}`}>
                {embeddedBalance !== null ? `${embeddedBalance.toFixed(4)} SOL` : "Loading..."}
              </span>
            </div>
            {(embeddedBalance ?? 0) < MINT_PRICE_SOL + 0.005 && (
              <button
                onClick={() => { setBalanceAtOpen(embeddedBalance); setShowDepositDialog(true); }}
                className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Deposit SOL to mint
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleMint}
          disabled={minting || !mintWalletAddress}
          className="w-full h-14 rounded-xl font-bold font-mono text-base gap-2 flex items-center justify-center transition-all duration-200 border border-green-400/50 bg-gradient-to-r from-green-500 to-green-600 text-black shadow-[0_0_20px_rgba(74,222,128,0.3)] hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(74,222,128,0.4)] disabled:opacity-50"
        >
          <Fingerprint className="h-5 w-5" />
          MINT FOR 1 SOL
        </button>

        {/* Deposit Dialog */}
        <Dialog open={showDepositDialog} onOpenChange={(open) => { setShowDepositDialog(open); if (open) setBalanceAtOpen(embeddedBalance); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5" /> Deposit SOL
              </DialogTitle>
              <DialogDescription>Send SOL to your embedded wallet to mint your NFA</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {mintWalletAddress && (
                <div className="bg-white rounded-xl p-3">
                  <QRCode value={mintWalletAddress} size={180} />
                </div>
              )}
              <div className="w-full">
                <p className="text-xs text-muted-foreground mb-1.5 text-center">Your embedded wallet address</p>
                <div className="flex items-center gap-2 bg-white/[0.05] rounded-lg px-3 py-2 border border-white/10">
                  <code className="text-xs font-mono flex-1 truncate">{mintWalletAddress}</code>
                  <button
                    onClick={async () => {
                      if (mintWalletAddress) {
                        const ok = await copyToClipboard(mintWalletAddress);
                        if (ok) { setDepositCopied(true); toast.success("Address copied!"); setTimeout(() => setDepositCopied(false), 2000); }
                      }
                    }}
                    className="shrink-0 hover:text-white transition-colors"
                  >
                    {depositCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Current balance: <span className="font-mono text-green-400">{embeddedBalance?.toFixed(4) ?? "—"} SOL</span></p>
                <p className="text-xs text-muted-foreground">Need at least {MINT_PRICE_SOL} SOL + ~0.005 SOL for fees</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Waiting for deposit...</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (step === "minting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: "#4ade80" }} />
        <p className="font-bold text-lg">Minting your NFA on Solana...</p>
        <p className="text-sm text-white/50">This may take a moment</p>
        <button
          onClick={() => { setMinting(false); setStep("confirm"); }}
          className="mt-4 px-6 py-2 rounded-lg text-sm font-mono font-bold border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="flex flex-col items-center py-12 space-y-6">
      <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
        <CheckCircle2 className="h-9 w-9" style={{ color: "#4ade80" }} />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-xl mb-1">NFA Minted!</h3>
        <p className="text-sm text-white/50">Slot #{mintResult?.slotNumber} • Batch #{mintResult?.batchNumber}</p>
      </div>
      <NfaPreviewCard name={tokenName} ticker={tokenTicker} imageUrl={imageUrl} slot={mintResult?.slotNumber} />
      {mintResult?.nfaMintAddress && (
        <a
          href={`https://solscan.io/token/${mintResult.nfaMintAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: "#4ade80" }}
        >
          View on Solscan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        onClick={() => { setStep("customize"); setTokenName(""); setTokenTicker(""); setImageUrl(null); setImageSource(null); setMintResult(null); }}
        className="text-sm text-white/50 hover:text-white transition-colors"
      >
        Mint another NFA
      </button>
    </div>
  );
}

/* ───────── Mint Fallback (no wallet) ───────── */
function NfaMintFallback() {
  return (
    <button disabled className="w-full h-14 rounded-xl font-bold font-mono text-base gap-2 flex items-center justify-center opacity-50" style={{ background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)", color: "#000" }}>
      <Fingerprint className="h-5 w-5" />
      Connect Wallet to Mint
    </button>
  );
}

/* ───────── Sub-tab: How It Works (Timeline) ───────── */
function HowItWorksTimeline() {
  const steps = [
    { icon: Fingerprint, label: "Customize", desc: "Choose your agent's name, ticker & image (AI or upload)" },
    { icon: Coins, label: "Mint", desc: "Pay 1 SOL to lock your metadata and mint the NFT on-chain" },
    { icon: Users, label: "Fill Batch", desc: "1,000 mints trigger the batch generation process" },
    { icon: Bot, label: "Token Launch", desc: "Agent's token launches on Meteora DBC with built-in fees" },
    { icon: TrendingUp, label: "Earn", desc: "Agent trades autonomously, shares fees with holders & minter" },
  ];
  return (
    <div className="relative pl-8 space-y-6 py-2">
      <div className="absolute left-[13px] top-4 bottom-4 w-px" style={{ background: "linear-gradient(to bottom, #4ade80, rgba(74,222,128,0.1))" }} />
      {steps.map(({ icon: Icon, label, desc }, i) => (
        <div key={i} className="relative flex items-start gap-4">
          <div className="absolute -left-8 top-1 h-[26px] w-[26px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: "#4ade80", background: "rgba(74,222,128,0.1)" }}>
            <Icon className="h-3 w-3" style={{ color: "#4ade80" }} />
          </div>
          <div>
            <p className="font-semibold text-sm">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── Sub-tab: Fee Structure (Bars) ───────── */
function FeeStructureBars() {
  const fees = [
    { label: "NFA Minter", pct: 30, color: "#4ade80" },
    { label: "Top 500 Holders", pct: 30, color: "#22c55e" },
    { label: "Agent Capital", pct: 30, color: "#16a34a" },
    { label: "Platform", pct: 10, color: "#0d9488" },
  ];
  return (
    <div className="space-y-4 py-2">
      <p className="text-xs text-muted-foreground">2% swap fee distribution</p>
      {fees.map(({ label, pct, color }) => (
        <div key={label} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <span className="font-mono font-bold text-sm" style={{ color }}>{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-4">
        Daily profit &gt; 10 SOL → 50% to holders, 50% to minter
      </p>
    </div>
  );
}

/* ───────── My NFAs Grid (with List/Delist) ───────── */
function MyNfasGrid({ mints, solanaAddress }: { mints: NfaMint[]; solanaAddress: string | null }) {
  const queryClient = useQueryClient();
  const [listingId, setListingId] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const handleList = async (mintId: string) => {
    const price = parseFloat(listPrice);
    if (!price || price <= 0 || !solanaAddress) return;
    setProcessing(mintId);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-list", {
        body: { nfaMintId: mintId, sellerWallet: solanaAddress, askingPriceSol: price },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("Listed for sale!");
      setListingId(null);
      setListPrice("");
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to list");
    } finally {
      setProcessing(null);
    }
  };

  const handleDelist = async (mint: NfaMint) => {
    if (!solanaAddress) return;
    setProcessing(mint.id);
    try {
      const { data: listings } = await supabase
        .from("nfa_listings")
        .select("id")
        .eq("nfa_mint_id", mint.id)
        .eq("status", "active")
        .limit(1);
      
      const activeListingId = (listings as any)?.[0]?.id;
      if (!activeListingId) { toast.error("No active listing found"); return; }

      const { data, error } = await supabase.functions.invoke("nfa-delist", {
        body: { listingId: activeListingId, sellerWallet: solanaAddress },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      toast.success("Listing cancelled");
      queryClient.invalidateQueries({ queryKey: ["nfa-my-mints"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delist");
    } finally {
      setProcessing(null);
    }
  };

  if (mints.length === 0) {
    return (
      <div className="text-center py-12">
        <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-30" style={{ color: "#4ade80" }} />
        <p className="text-sm text-muted-foreground">No NFAs minted yet</p>
        <p className="text-xs text-muted-foreground mt-1">Mint your first NFA above to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {mints.map((mint) => {
        const isOwner = mint.owner_wallet === solanaAddress;
        const displayImage = mint.token_image_url || mint.agent_image_url;
        const displayName = mint.token_name || mint.agent_name || `NFA Slot #${mint.slot_number}`;
        
        return (
          <div
            key={mint.id}
            className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:scale-[1.02] hover:shadow-lg transition-all duration-200 group"
          >
            <div className="aspect-square relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.1), rgba(34,197,94,0.05))" }}>
              {displayImage ? (
                <img src={displayImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Fingerprint className="h-10 w-10 opacity-30" style={{ color: "#4ade80" }} />
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-black/60 backdrop-blur-sm text-white">
                #{mint.slot_number}
              </div>
              {mint.listed_for_sale && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold backdrop-blur-sm" style={{ background: "rgba(74,222,128,0.8)", color: "#000" }}>
                  {mint.listing_price_sol} SOL
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm truncate">{displayName}</p>
              {mint.token_ticker && (
                <p className="text-[10px] text-muted-foreground font-mono">${mint.token_ticker}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-muted-foreground">{new Date(mint.created_at).toLocaleDateString()}</span>
                <Badge variant="outline" className="text-[10px] capitalize h-5 px-1.5">{mint.status}</Badge>
              </div>

              {isOwner && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  {mint.listed_for_sale ? (
                    <button
                      onClick={() => handleDelist(mint)}
                      disabled={processing === mint.id}
                      className="w-full text-[10px] font-medium py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.06] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {processing === mint.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                      Cancel Listing
                    </button>
                  ) : listingId === mint.id ? (
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        value={listPrice}
                        onChange={e => setListPrice(e.target.value)}
                        placeholder="SOL"
                        className="h-7 text-[10px] bg-white/[0.04] border-white/10 flex-1"
                        step="0.1"
                        min="0.01"
                      />
                      <button
                        onClick={() => handleList(mint.id)}
                        disabled={processing === mint.id || !listPrice}
                        className="h-7 px-2 rounded-lg text-[10px] font-bold disabled:opacity-50"
                        style={{ background: "#4ade80", color: "#000" }}
                      >
                        {processing === mint.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "List"}
                      </button>
                      <button onClick={() => { setListingId(null); setListPrice(""); }} className="h-7 px-1.5 rounded-lg text-[10px] border border-white/10">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setListingId(mint.id)}
                      className="w-full text-[10px] font-medium py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1"
                    >
                      <Tag className="h-3 w-3" /> List for Sale
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Admin: Create Collection ───────── */
function AdminCreateCollection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleCreate = async () => {
    const secret = prompt("Enter admin secret:");
    if (!secret) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfa-create-collection", {
        body: { adminSecret: secret },
      });
      if (error) throw new Error(error.message);
      const resp = data as any;
      if (resp?.error) throw new Error(resp.error);
      setResult(resp.collectionAddress);
      toast.success(`Collection created: ${resp.collectionAddress}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create collection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-yellow-500" />
        <h4 className="text-sm font-bold text-yellow-500">Admin: Create NFA Collection</h4>
      </div>
      {result ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Collection address (save as <code className="text-yellow-400">NFA_COLLECTION_ADDRESS</code> secret):</p>
          <code className="text-xs break-all block bg-black/30 rounded p-2 text-green-400">{result}</code>
        </div>
      ) : (
        <Button
          onClick={handleCreate}
          disabled={loading}
          variant="outline"
          size="sm"
          className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Zap className="h-3.5 w-3.5 mr-2" />}
          Create On-Chain Collection
        </Button>
      )}
    </div>
  );
}

/* ───────── Stats Card ───────── */
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-center border border-white/[0.08]"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-[10px] text-white/40 uppercase tracking-wider font-mono mb-1">{label}</p>
      <p className={`font-mono font-bold text-lg ${accent ? "text-[#4ade80]" : "text-[#F1F5F9]"}`}>{value}</p>
    </div>
  );
}

/* ═══════════ Main Component ═══════════ */
export default function PanelNfaTab() {
  const { solanaAddress } = useAuth();
  const privyAvailable = usePrivyAvailable();
  const { isAdmin } = useIsAdmin(solanaAddress);
  const [subTab, setSubTab] = useState<"mynfas" | "howitworks" | "fees">("mynfas");

  const { data: batch } = useQuery({
    queryKey: ["nfa-batch-current"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nfa_batches").select("*").eq("status", "open").order("batch_number", { ascending: true }).limit(1).single();
      if (error) return null;
      return data as NfaBatch;
    },
  });

  const { data: myMints = [] } = useQuery({
    queryKey: ["nfa-my-mints", solanaAddress],
    enabled: !!solanaAddress,
    queryFn: async () => {
      const { data: minted } = await supabase.from("nfa_mints").select("*").eq("minter_wallet", solanaAddress!);
      const { data: owned } = await supabase.from("nfa_mints").select("*").eq("owner_wallet", solanaAddress!);
      const map = new Map<string, NfaMint>();
      for (const m of [...(minted || []), ...(owned || [])]) map.set(m.id, m as NfaMint);
      return Array.from(map.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const progress = batch ? (batch.minted_count / batch.total_slots) * 100 : 0;
  const slotsRemaining = batch ? batch.total_slots - batch.minted_count : 0;

  return (
    <div className="pb-8 space-y-6">

      {/* Early Minter Airdrop Info Box */}
      <div className="relative rounded-2xl border border-primary/30 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(250,204,21,0.06) 100%)" }}>
        <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold font-mono uppercase tracking-wider bg-primary/20 text-primary">
          Limited
        </div>
        <div className="px-5 py-4 flex items-start gap-4">
          <div className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center mt-0.5" style={{ background: "linear-gradient(135deg, #4ade80, #facc15)" }}>
            <Coins className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-foreground mb-1">🎁 Mint 1 NFA → Get 0.1% of $CLAW Supply</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Each NFA mint earns you <span className="text-primary font-semibold">0.1% of the total $CLAW token supply</span>, airdropped after our native token launch.{" "}
              <span className="text-yellow-400 font-semibold">First 50 NFA mints only</span> — don't miss out.
            </p>
          </div>
        </div>
      </div>


      {/* ── Desktop: 2-column layout. Mobile: stacked ── */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* ── LEFT: Main content area ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Hero Banner — compact on desktop */}
          <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2818 50%, #0a1628 100%)" }}>
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(74,222,128,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="relative px-6 lg:px-8 py-6 lg:py-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="h-14 w-14 lg:h-16 lg:w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_40px_rgba(74,222,128,0.25)]" style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}>
                  <Fingerprint className="h-7 w-7 lg:h-8 lg:w-8 text-black" />
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                    <h2 className="text-xl lg:text-2xl font-bold font-mono tracking-tight text-[#F1F5F9]">Non-Fungible Agents</h2>
                    <CheckCircle2 className="h-4 w-4" style={{ color: "#4ade80" }} />
                  </div>
                  <p className="text-sm text-white/50 max-w-md">
                    The first NFA standard on Solana — autonomous trading agents that earn, trade & evolve
                  </p>
                </div>
              </div>

              {/* Stats row — inline on desktop */}
              <div className="flex items-center gap-0 mt-5 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/10 divide-x divide-white/10 overflow-x-auto w-fit mx-auto sm:mx-0">
                {[
                  { label: "Items", value: batch?.total_slots?.toLocaleString() ?? "1,000" },
                  { label: "Minted", value: batch?.minted_count?.toLocaleString() ?? "0" },
                  { label: "Floor", value: "1 SOL" },
                ].map(({ label, value }) => (
                  <div key={label} className="px-5 py-2.5 text-center min-w-[80px]">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
                    <p className="font-mono font-bold text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Live Mint Section ── */}
          {batch && (
            <div className="relative rounded-2xl border border-white/10 p-5 lg:p-7" style={{ background: "linear-gradient(135deg, rgba(74,222,128,0.04), rgba(0,0,0,0))" }}>
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "inset 0 0 30px rgba(74,222,128,0.05)" }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#4ade80" }} />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#4ade80" }} />
                    </span>
                    <Badge className="text-[10px] font-mono uppercase tracking-wider" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
                      Live Mint
                    </Badge>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">Batch #{batch.batch_number}</Badge>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl lg:text-3xl font-bold font-mono">{batch.minted_count}<span className="text-sm text-white/40 font-normal"> / {batch.total_slots.toLocaleString()}</span></span>
                    <span className="text-sm text-white/40">{slotsRemaining} remaining</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden relative">
                    <div
                      className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                      style={{ width: `${Math.max(progress, 1)}%`, background: "linear-gradient(90deg, #4ade80, #22c55e, #16a34a)" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: "shimmer 2s infinite" }} />
                    </div>
                  </div>
                </div>

                {/* Mint Flow or Fallback */}
                {privyAvailable && solanaAddress && batch.status === "open" ? (
                  <NfaMintFlow batch={batch} solanaAddress={solanaAddress} />
                ) : (
                  <NfaMintFallback />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR: Details, stats, info ── */}
        <div className="xl:w-[320px] 2xl:w-[360px] flex-shrink-0 space-y-5">

          {/* Quick Stats */}
          <div className="grid grid-cols-3 xl:grid-cols-1 gap-3">
            <StatCard label="Mint Price" value="1 SOL" accent />
            <StatCard label="Swap Fee" value="2%" />
            <StatCard label="Supply" value="1,000" />
          </div>

          {/* Details Card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-[#F1F5F9]">
              <Coins className="h-4 w-4" style={{ color: "#4ade80" }} />
              Details
            </h3>
            <div className="space-y-2.5">
              {[
                { k: "Chain", v: "Solana" },
                { k: "Token Standard", v: "Metaplex Core" },
                { k: "Mint Price", v: "1 SOL" },
                { k: "Batch Size", v: "1,000" },
                { k: "Swap Fee", v: "2%" },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-white/40">{k}</span>
                  <span className="font-mono font-medium text-[#E2E8F0]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* About Card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-[#F1F5F9]">
              <Globe className="h-4 w-4" style={{ color: "#4ade80" }} />
              About
            </h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Non-Fungible Agents (NFAs) are autonomous AI trading agents minted as unique Metaplex Core NFTs on Solana.
              Each NFA has its own name, ticker, avatar, and trading strategy.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sub-Tabs: My NFAs / How It Works / Fees ── */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="flex border-b border-white/[0.08]">
          {([
            { id: "mynfas" as const, label: `My NFAs${myMints.length > 0 ? ` (${myMints.length})` : ""}` },
            { id: "howitworks" as const, label: "How It Works" },
            { id: "fees" as const, label: "Fee Structure" },
          ]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSubTab(id)}
              className={`flex-1 text-sm font-medium py-3.5 px-4 transition-colors relative ${
                subTab === id ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {label}
              {subTab === id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#4ade80" }} />
              )}
            </button>
          ))}
        </div>
        <div className="p-5">
          {subTab === "mynfas" && <MyNfasGrid mints={myMints} solanaAddress={solanaAddress} />}
          {subTab === "howitworks" && <HowItWorksTimeline />}
          {subTab === "fees" && <FeeStructureBars />}
        </div>
      </div>

      {/* Admin Section */}
      {isAdmin && <AdminCreateCollection />}
    </div>
  );
}
