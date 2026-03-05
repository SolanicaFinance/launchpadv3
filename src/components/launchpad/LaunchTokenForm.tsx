import { useState, lazy, Suspense, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMeteoraApi } from "@/hooks/useMeteoraApi";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useLaunchRateLimit } from "@/hooks/useLaunchRateLimit";
import { Loader2, ImageIcon, ChevronDown, ChevronUp, Clock, Users, Coins, Globe, Twitter, Send, MessageSquare, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { isBlockedName } from "@/lib/hiddenTokens";
import { MathCaptcha } from "./MathCaptcha";

interface LaunchTokenFormProps {
  onSuccess?: (mintAddress: string) => void;
}

const PrivyWalletProvider = lazy(() => import("./PrivyWalletProvider"));

const SOL_PRESETS = [0.1, 0.5, 1.0, 2.0];

const terminalInput = "w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white font-mono text-sm rounded px-3 py-2.5 placeholder:text-[#444] focus:outline-none focus:border-[#e84040]/60 transition-colors";
const sectionHeader = "font-mono text-[10px] text-[#e84040] uppercase tracking-widest border-l-2 border-[#e84040] pl-2";

export function LaunchTokenForm({ onSuccess }: LaunchTokenFormProps) {
  const { solanaAddress, isAuthenticated, login, user } = useAuth();
  const { toast } = useToast();
  const { createPool, isLoading: isApiLoading } = useMeteoraApi();
  const privyAvailable = usePrivyAvailable();
  const navigate = useNavigate();
  const { allowed: rateLimitAllowed, formattedCountdown, countdown, refresh: refreshRateLimit } = useLaunchRateLimit();

  const [wallets, setWallets] = useState<any[]>([]);
  const [signingWalletAddress, setSigningWalletAddress] = useState<string | null>(null);
  const [privySignTransaction, setPrivySignTransaction] = useState<
    ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null
  >(null);

  const handleSignTransactionChange = useCallback(
    (fn: ((tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>) | null) => {
      setPrivySignTransaction(() => fn);
    },
    []
  );

  const handleSigningWalletChange = useCallback((address: string | null) => {
    setSigningWalletAddress(address);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    ticker: '',
    description: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    discordUrl: '',
    initialBuySol: 0,
    feeMode: 'creator' as 'creator' | 'holder_rewards',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [imageDragOver, setImageDragOver] = useState(false);

  const { solPrice } = useSolPrice();
  const usdValue = (formData.initialBuySol * solPrice).toFixed(2);

  const handleImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImageDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  };

  const signTransaction = useCallback(
    async (tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> => {
      if (!privySignTransaction) {
        throw new Error("Wallet is still initializing. Please wait a few seconds and try again.");
      }
      return await privySignTransaction(tx);
    },
    [privySignTransaction]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !solanaAddress) {
      toast({ title: "Please connect your wallet first", variant: "destructive" });
      return;
    }
    if (!formData.name || !formData.ticker) {
      toast({ title: "Name and ticker are required", variant: "destructive" });
      return;
    }
    if (formData.ticker.length > 10) {
      toast({ title: "Ticker must be 10 characters or less", variant: "destructive" });
      return;
    }
    if (isBlockedName(formData.name)) {
      toast({ title: "Invalid token name", description: "This name contains blocked content.", variant: "destructive" });
      return;
    }
    if (isBlockedName(formData.ticker)) {
      toast({ title: "Invalid ticker", description: "This ticker contains blocked content.", variant: "destructive" });
      return;
    }
    if (isBlockedName(formData.description)) {
      toast({ title: "Invalid description", description: "The description contains blocked content.", variant: "destructive" });
      return;
    }
    if (!privyAvailable) {
      toast({ title: "Wallet not ready", description: "Wallet system is still initializing. Please refresh.", variant: "destructive" });
      return;
    }
    if (!privySignTransaction) {
      toast({ title: "No wallet connected", description: "Wait a few seconds for the embedded wallet to load.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `token-images/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const walletToUse = signingWalletAddress || solanaAddress;
      const data = await createPool(
        {
          creatorWallet: walletToUse,
          privyUserId: user?.privyId,
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          description: formData.description,
          imageUrl,
          websiteUrl: formData.websiteUrl || undefined,
          twitterUrl: formData.twitterUrl || undefined,
          telegramUrl: formData.telegramUrl || undefined,
          discordUrl: formData.discordUrl || undefined,
          initialBuySol: formData.initialBuySol,
          feeMode: formData.feeMode,
        },
        signTransaction
      );

      if (!data.success) throw new Error('Failed to create token');

      toast({
        title: "Token created successfully! 🚀",
        description: `${formData.name} ($${formData.ticker}) is now live!`,
      });

      if (onSuccess) {
        onSuccess(data.mintAddress);
      } else {
        navigate(`/trade/${data.mintAddress}`);
      }
    } catch (error) {
      console.error('Token launch error:', error);
      toast({
        title: "Failed to create token",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {privyAvailable && (
        <Suspense fallback={null}>
          <PrivyWalletProvider
            preferredAddress={solanaAddress}
            onWalletsChange={setWallets}
            onSignTransactionChange={handleSignTransactionChange}
            onSigningWalletChange={handleSigningWalletChange}
          />
        </Suspense>
      )}

      {/* Section 1: Token Identity */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className={`${sectionHeader} mb-4`}>Token Identity</div>

        <div className="flex gap-4">
          {/* Image Drop Zone */}
          <label
            className="flex-shrink-0 cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
            onDragLeave={() => setImageDragOver(false)}
            onDrop={handleDrop}
          >
            <div className={`w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
              imageDragOver
                ? "border-[#e84040] bg-[#e84040]/10"
                : imagePreview
                ? "border-[#333]"
                : "border-[#2a2a2a] hover:border-[#e84040]/40 hover:bg-[#e84040]/5"
            }`}>
              {imagePreview ? (
                <img src={imagePreview} alt="Token" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <>
                  <ImageIcon className="h-7 w-7 text-[#333]" />
                  <span className="font-mono text-[9px] text-[#444] uppercase tracking-widest text-center leading-tight">
                    Drop Image<br />or Click
                  </span>
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>

          {/* Name & Ticker */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="font-mono text-[9px] text-[#555] uppercase tracking-widest block mb-1">
                Token Name *
                <span className="float-right text-[#333]">{formData.name.length}/32</span>
              </label>
              <input
                className={terminalInput}
                placeholder="e.g. Moon Dog"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={32}
                required
              />
            </div>
            <div>
              <label className="font-mono text-[9px] text-[#555] uppercase tracking-widest block mb-1">
                Ticker *
                <span className="float-right text-[#333]">{formData.ticker.length}/10</span>
              </label>
              <input
                className={terminalInput}
                placeholder="e.g. MDOG"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                maxLength={10}
                required
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="font-mono text-[9px] text-[#555] uppercase tracking-widest block mb-1">
            Description
            <span className="float-right text-[#333]">{formData.description.length}/300</span>
          </label>
          <textarea
            className={`${terminalInput} min-h-[80px] resize-none`}
            placeholder="Describe your token..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            maxLength={300}
          />
        </div>
      </div>

      {/* Section 2: Social Links */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <Collapsible open={showSocialLinks} onOpenChange={setShowSocialLinks}>
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div className={sectionHeader}>Social Links <span className="text-[#333] border-none">(optional)</span></div>
            {showSocialLinks
              ? <ChevronUp className="h-3 w-3 text-[#444] group-hover:text-[#e84040] transition-colors" />
              : <ChevronDown className="h-3 w-3 text-[#444] group-hover:text-[#e84040] transition-colors" />
            }
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
              <input
                className={`${terminalInput} pl-8`}
                placeholder="https://yoursite.com"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              />
            </div>
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
              <input
                className={`${terminalInput} pl-8`}
                placeholder="https://twitter.com/..."
                value={formData.twitterUrl}
                onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
              />
            </div>
            <div className="relative">
              <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
              <input
                className={`${terminalInput} pl-8`}
                placeholder="https://t.me/..."
                value={formData.telegramUrl}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
              />
            </div>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
              <input
                className={`${terminalInput} pl-8`}
                placeholder="https://discord.gg/..."
                value={formData.discordUrl}
                onChange={(e) => setFormData({ ...formData, discordUrl: e.target.value })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Section 3: Fee Distribution */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className={`${sectionHeader} mb-4`}>Fee Distribution</div>
        <div className="grid grid-cols-2 gap-3">
          {/* Creator Rewards */}
          <label
            className={`flex flex-col gap-2 p-3.5 rounded-lg cursor-pointer transition-all border ${
              formData.feeMode === 'creator'
                ? "border-[#e84040] bg-[#e84040]/5"
                : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#333]"
            }`}
          >
            <input type="radio" name="feeMode" value="creator" checked={formData.feeMode === 'creator'} onChange={() => setFormData({ ...formData, feeMode: 'creator' })} className="sr-only" />
            <div className="flex items-center gap-2">
              <Coins className={`h-4 w-4 ${formData.feeMode === 'creator' ? 'text-[#e84040]' : 'text-[#555]'}`} />
              <span className={`font-mono text-xs uppercase tracking-wide ${formData.feeMode === 'creator' ? 'text-[#e84040]' : 'text-[#666]'}`}>Creator</span>
            </div>
            <p className="font-mono text-[10px] text-[#555] leading-snug">50% of fees → you</p>
          </label>

          {/* Holder Rewards */}
          <label
            className={`flex flex-col gap-2 p-3.5 rounded-lg cursor-pointer transition-all border ${
              formData.feeMode === 'holder_rewards'
                ? "border-green-500/60 bg-green-500/5"
                : "border-[#1e1e1e] bg-[#0d0d0d] hover:border-[#333]"
            }`}
          >
            <input type="radio" name="feeMode" value="holder_rewards" checked={formData.feeMode === 'holder_rewards'} onChange={() => setFormData({ ...formData, feeMode: 'holder_rewards' })} className="sr-only" />
            <div className="flex items-center gap-2">
              <Users className={`h-4 w-4 ${formData.feeMode === 'holder_rewards' ? 'text-green-400' : 'text-[#555]'}`} />
              <span className={`font-mono text-xs uppercase tracking-wide ${formData.feeMode === 'holder_rewards' ? 'text-green-400' : 'text-[#666]'}`}>Holders</span>
              <Badge className="bg-green-500/20 text-green-400 text-[8px] px-1 py-0 h-4 font-mono border-0">NEW</Badge>
            </div>
            <p className="font-mono text-[10px] text-[#555] leading-snug">50% → top 50 holders</p>
          </label>
        </div>
      </div>

      {/* Section 4: Initial Buy */}
      <div className="bg-[#111] border border-[#1e1e1e] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className={sectionHeader}>Initial Buy</div>
          <span className="font-mono text-[10px] text-[#555]">optional</span>
        </div>

        {/* SOL input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">◎</span>
            </div>
            <span className="font-mono text-xs text-[#666]">SOL</span>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.initialBuySol || ''}
            onChange={(e) => setFormData({ ...formData, initialBuySol: parseFloat(e.target.value) || 0 })}
            className={`${terminalInput} pl-16 pr-20 text-lg h-12`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#444]">
            ≈ ${usdValue}
          </span>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {SOL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setFormData({ ...formData, initialBuySol: preset })}
              className={`font-mono text-xs py-1.5 rounded border transition-all ${
                formData.initialBuySol === preset
                  ? "border-[#e84040] text-[#e84040] bg-[#e84040]/10"
                  : "border-[#222] text-[#555] hover:border-[#e84040]/40 hover:text-[#888]"
              }`}
            >
              {preset} SOL
            </button>
          ))}
        </div>
      </div>

      {/* Rate Limit Warning */}
      {!rateLimitAllowed && countdown > 0 && (
        <div className="bg-[#0f0000] border border-[#e84040]/30 rounded-lg p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-[#e84040]">
            <Clock className="h-4 w-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Rate Limited</span>
          </div>
          <p className="font-mono text-xs text-[#555]">
            You've launched 2 tokens in the last 60 minutes.
          </p>
          <div className="font-mono text-2xl font-bold text-[#e84040]">{formattedCountdown}</div>
          <p className="font-mono text-[10px] text-[#444] uppercase tracking-wide">Please wait before launching another token</p>
        </div>
      )}

      {/* CAPTCHA */}
      {isAuthenticated && formData.name && formData.ticker && rateLimitAllowed && (
        <MathCaptcha onVerified={setCaptchaVerified} />
      )}

      {/* Launch Button */}
      {isAuthenticated ? (
        <button
          type="submit"
          disabled={isLoading || isApiLoading || !formData.name || !formData.ticker || !captchaVerified || !rateLimitAllowed}
          className="w-full h-14 bg-[#e84040] hover:bg-[#c73333] disabled:bg-[#2a1515] disabled:text-[#555] text-white font-mono uppercase tracking-widest text-sm rounded transition-all flex items-center justify-center gap-2 group"
        >
          {isLoading || isApiLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Launching...
            </>
          ) : !rateLimitAllowed ? (
            `Wait ${formattedCountdown}`
          ) : !captchaVerified ? (
            "Complete Verification Above"
          ) : (
            <>
              <Rocket className="h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
              Launch Token
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => login()}
          className="w-full h-14 bg-[#e84040] hover:bg-[#c73333] text-white font-mono uppercase tracking-widest text-sm rounded transition-all flex items-center justify-center gap-2"
        >
          <Rocket className="h-4 w-4" />
          Log In To Launch
        </button>
      )}
    </form>
  );
}
