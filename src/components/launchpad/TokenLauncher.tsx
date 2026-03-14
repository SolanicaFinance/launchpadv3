import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { MemeLoadingAnimation, MemeLoadingText } from "@/components/launchpad/MemeLoadingAnimation";
import { ImagePreviewOverlay } from "@/components/launchpad/ImagePreviewOverlay";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { LaunchpadDepositPrompt } from "./LaunchpadDepositPrompt";
import { Connection, Transaction, VersionedTransaction, PublicKey, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { debugLog } from "@/lib/debugLogger";
import { getRpcUrl } from "@/hooks/useSolanaWallet";


import {
  Shuffle,
  Rocket,
  Sparkles,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Globe,
  Twitter,
  MessageCircle,
  MessageSquare,
  Image,
  Download,
  Pencil,
  Bot,
  Coins,
  Users,
  Loader2,
  Camera,
  PartyPopper,
  Lock,
  X,
} from "lucide-react";

interface MemeToken {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  narrative?: string;
}

interface LaunchResult {
  success: boolean;
  name?: string;
  ticker?: string;
  mintAddress?: string;
  imageUrl?: string;
  tokenId?: string;
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

interface TokenLauncherProps {
  onLaunchSuccess: () => void;
  onShowResult: (result: LaunchResult) => void;
  bare?: boolean;
  defaultMode?: "random" | "custom" | "describe" | "realistic" | "phantom" | "holders" | "fun";
}

const DEV_BUY_MAX_SOL = 100;
const DEV_BUY_DECIMALS = 2;
const DEV_BUY_INPUT_RE = /^\d*(?:\.\d{0,2})?$/;

function parseDevBuySol(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 0;

  const factor = 10 ** DEV_BUY_DECIMALS;
  const rounded = Math.round(n * factor) / factor;
  return Math.min(DEV_BUY_MAX_SOL, Math.max(0, rounded));
}

function formatDevBuySolInput(n: number): string {
  if (!n) return "";
  return n.toFixed(DEV_BUY_DECIMALS).replace(/\.?0+$/, "");
}

export function TokenLauncher({ onLaunchSuccess, onShowResult, bare = false, defaultMode }: TokenLauncherProps) {
  const { toast } = useToast();
  const phantomWallet = usePhantomWallet();
  const { solPrice } = useSolPrice();
  const { user, isAuthenticated, login: privyLogin } = useAuth();
  const { walletAddress: privyWalletAddress, isWalletReady: privyWalletReady, getBalance: getPrivyBalance, signAndSendTransaction: privySignAndSend, getConnection: getPrivyConnection } = useSolanaWallet();
  
  // Wallet mode for Phantom tab: "phantom" (external) or "privy" (embedded 1-click)
  const [launchWalletMode, setLaunchWalletMode] = useState<"phantom" | "privy">("phantom");
  const [privyBalance, setPrivyBalance] = useState<number | null>(null);
  const [privyDepositReady, setPrivyDepositReady] = useState(false);

  // Idempotency key to prevent duplicate launches - regenerated on successful launch or ticker change
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const [generatorMode, setGeneratorMode] = useState<"random" | "custom" | "describe" | "realistic" | "phantom" | "holders" | "fun">(defaultMode || "random");
  const [meme, setMeme] = useState<MemeToken | null>(null);
  const [customToken, setCustomToken] = useState<MemeToken>({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: "",
  });
  const [describePrompt, setDescribePrompt] = useState("");
  const [describedToken, setDescribedToken] = useState<MemeToken | null>(null);
  const [realisticPrompt, setRealisticPrompt] = useState("");
  const [realisticToken, setRealisticToken] = useState<MemeToken | null>(null);
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Phantom specific state
  const [isPhantomLaunching, setIsPhantomLaunching] = useState(false);
  const [phantomTradingFee, setPhantomTradingFee] = useState(100); // 100 bps = 1% creator fee default
  const [phantomDevBuySolInput, setPhantomDevBuySolInput] = useState<string>(""); // Optional dev buy amount in SOL (raw input)
  const phantomDevBuySol = parseDevBuySol(phantomDevBuySolInput);
  const [phantomSubMode, setPhantomSubMode] = useState<"random" | "describe" | "realistic" | "custom">("random");
  const [phantomToken, setPhantomToken] = useState<MemeToken>({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: "",
  });
  const [phantomImageFile, setPhantomImageFile] = useState<File | null>(null);
  const [phantomImagePreview, setPhantomImagePreview] = useState<string | null>(null);
  const [phantomMeme, setPhantomMeme] = useState<MemeToken | null>(null);
  const [isPhantomGenerating, setIsPhantomGenerating] = useState(false);
  const [phantomDescribePrompt, setPhantomDescribePrompt] = useState("");
  const [phantomRealisticPrompt, setPhantomRealisticPrompt] = useState("");
  

  // Holders mode state (mirrors Phantom)
  const [holdersSubMode, setHoldersSubMode] = useState<"random" | "describe" | "custom">("random");
  const [holdersDescribePrompt, setHoldersDescribePrompt] = useState("");
  const [holdersMeme, setHoldersMeme] = useState<MemeToken | null>(null);
  const [isHoldersGenerating, setIsHoldersGenerating] = useState(false);
  const [holdersToken, setHoldersToken] = useState<MemeToken>({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    telegramUrl: "",
    discordUrl: "",
  });
  const [holdersImageFile, setHoldersImageFile] = useState<File | null>(null);
  const [holdersImagePreview, setHoldersImagePreview] = useState<string | null>(null);

  // FUN mode state
  const [funModeUnlocked, setFunModeUnlocked] = useState(() => localStorage.getItem('fun_mode_unlocked') === 'true');
  const [funPasswordInput, setFunPasswordInput] = useState("");
  const [funToken, setFunToken] = useState<MemeToken>({
    name: "", ticker: "", description: "", imageUrl: "",
  });
  const [funImageFile, setFunImageFile] = useState<File | null>(null);
  const [funImagePreview, setFunImagePreview] = useState<string | null>(null);
  const [funTotalSupply, setFunTotalSupply] = useState(1_000_000_000);
  const [funLpSol, setFunLpSol] = useState(0.5);
  const [funLpTokens, setFunLpTokens] = useState(10_000_000);
  const [isFunLaunching, setIsFunLaunching] = useState(false);
  const [funRemovePoolAddress, setFunRemovePoolAddress] = useState(() => localStorage.getItem('fun_last_pool_address') || "");
  const [isRemovingFunLp, setIsRemovingFunLp] = useState(false);

  // Banner generation
  const { generateBanner, downloadBanner, clearBanner, isGenerating: isBannerGenerating, bannerUrl } = useBannerGenerator();
  const [bannerTextName, setBannerTextName] = useState("");
  const [bannerTextTicker, setBannerTextTicker] = useState("");
  const [isEditingBannerText, setIsEditingBannerText] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");

  // Fetch Privy balance when wallet is ready  
  // (inline import to avoid adding useEffect import if missing)
  const privyBalanceFetchedRef = useState(() => false);
  if (!privyBalanceFetchedRef[0] && privyWalletReady && privyWalletAddress) {
    privyBalanceFetchedRef[1](true);
    getPrivyBalance().then(b => setPrivyBalance(b));
  }

  const isValidSolanaAddress = (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

  const handleRandomize = useCallback(async () => {
    setIsGenerating(true);
    setMeme(null);
    clearBanner();

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setMeme({ ...data.meme, name: "", ticker: "" });
        toast({ title: "Meme Generated! 🎲", description: "Image ready — enter your token name & ticker!" });
      } else {
        throw new Error("No meme data returned");
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [toast, clearBanner]);

  const uploadCustomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!customImageFile) return customToken.imageUrl;
    const fileExt = customImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, customImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [customImageFile, customToken.imageUrl]);

  // IMPORTANT: Avoid sending giant base64 images to backend functions (can hang / exceed limits)
  const uploadDataUrlImageIfNeeded = useCallback(async (imageUrl: string, ticker: string): Promise<string> => {
    if (!imageUrl || !imageUrl.startsWith("data:image")) return imageUrl;

    debugLog('info', 'Uploading generated image to storage (pre-flight)', {
      ticker,
      bytesApprox: Math.round(imageUrl.length * 0.75),
    });

    const [meta, base64Data] = imageUrl.split(',');
    if (!base64Data) throw new Error('Invalid base64 image data');

    const contentTypeMatch = meta?.match(/data:(.*?);base64/);
    const contentType = contentTypeMatch?.[1] || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'png';

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const filePath = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('post-images')
      .upload(filePath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    debugLog('info', 'Generated image uploaded', { publicUrl: urlData.publicUrl });
    return urlData.publicUrl;
  }, []);

  const performLaunch = useCallback(async (tokenToLaunch: MemeToken) => {
    debugLog('info', '🚀 Launch started', { 
      name: tokenToLaunch.name, 
      ticker: tokenToLaunch.ticker,
      wallet: walletAddress?.slice(0, 8) + '...',
    });

    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      debugLog('error', 'Invalid wallet address', { walletAddress });
      toast({ title: "Invalid wallet address", description: "Please enter a valid Solana wallet address", variant: "destructive" });
      return;
    }

    debugLog('info', 'Wallet validated', { wallet: walletAddress.slice(0, 8) + '...' });
    setIsLaunching(true);
    
    // Show progress toast immediately
    toast({ 
      title: "🚀 Creating Token...", 
      description: "Preparing on-chain transactions (5-15 seconds)..." 
    });

    const startTime = Date.now();
    debugLog('info', 'Calling fun-create Edge Function...');

    try {
      // Pre-flight: ensure we send a small, stable payload to the backend
      const imageUrlToSend = await uploadDataUrlImageIfNeeded(tokenToLaunch.imageUrl, tokenToLaunch.ticker);
      debugLog('info', 'Prepared launch payload', {
        imageUrlType: imageUrlToSend?.startsWith('data:image') ? 'data_url' : 'url',
        imageUrlLength: imageUrlToSend?.length,
      });

      // Hard timeout so we never get stuck with "nothing happens" - increased to 60s for on-chain confirmation
      const timeoutMs = 60_000;
      const invokePromise = supabase.functions.invoke("fun-create", {
        body: {
          name: tokenToLaunch.name,
          ticker: tokenToLaunch.ticker,
          description: tokenToLaunch.description,
          imageUrl: imageUrlToSend,
          websiteUrl: tokenToLaunch.websiteUrl,
          twitterUrl: tokenToLaunch.twitterUrl,
          telegramUrl: tokenToLaunch.telegramUrl,
          discordUrl: tokenToLaunch.discordUrl,
          creatorWallet: walletAddress,
          idempotencyKey, // Prevent duplicate launches
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`fun-create timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      });

      const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as any;

      const elapsed = Date.now() - startTime;
      debugLog('info', `Edge Function responded in ${elapsed}ms`, { 
        hasData: !!data, 
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
      });

      if (error) {
        const msg = error.message || "";
        debugLog('error', 'Edge Function error', { 
          message: msg, 
          name: error.name,
          elapsed,
        });

        if (msg.toLowerCase().includes("max usage reached")) {
          throw new Error("RPC provider is at max usage. Please top up credits or try again later.");
        }

        // Check for rate limit
        if (msg.includes("429") || msg.toLowerCase().includes("rate")) {
          throw new Error('Rate limited. Please wait a few minutes before launching again.');
        }
        throw new Error(`Server error: ${msg}`);
      }
      
      // Handle in-progress response (duplicate request while still processing)
      if (!data?.success && data?.inProgress) {
        toast({ 
          title: "Launch In Progress", 
          description: "This token is already being created. Please wait.",
        });
        debugLog('info', 'Duplicate launch detected - in progress');
        return;
      }

      // Handle cooldown response (same ticker+wallet within 10 minutes)
      if (data?.cooldown && data?.success) {
        debugLog('info', 'Cooldown response - token already created recently', { mintAddress: data.mintAddress });
        // Still show success - the token exists
      }
      
      if (!data?.success) {
        const msg = String(data?.error || "Launch failed");
        debugLog('error', 'Launch failed (data.success=false)', { 
          error: msg,
          data,
          elapsed,
        });
        if (msg.toLowerCase().includes("max usage reached")) {
          throw new Error("RPC provider is at max usage. Please top up credits or try again later.");
        }
        throw new Error(msg);
      }

      // Success!
      debugLog('info', '✅ Token launched successfully!', { 
        mintAddress: data.mintAddress,
        elapsed,
      });

      onShowResult({
        success: true,
        name: tokenToLaunch.name,
        ticker: tokenToLaunch.ticker,
        mintAddress: data.mintAddress,
        tokenId: data.tokenId,
        imageUrl: tokenToLaunch.imageUrl,
        onChainSuccess: true,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: "🚀 Token launched successfully!",
      });

      toast({ title: "🚀 Token Launched!", description: `${tokenToLaunch.name} is now live on Solana!` });

      // Clear form and regenerate idempotency key for next launch
      setMeme(null);
      clearBanner();
      setCustomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setCustomImageFile(null);
      setCustomImagePreview(null);
      setWalletAddress("");
      setIdempotencyKey(crypto.randomUUID()); // New key for next launch attempt
      onLaunchSuccess();
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : "Failed to launch token";
      const elapsed = Date.now() - startTime;
      
      debugLog('error', 'Launch failed with exception', { 
        message: errorMessage,
        elapsed,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      });
      
      // Improve error messages for common cases
        if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
          errorMessage = 'Timed out waiting for server. The launch may still complete—wait ~60s and check the token list before retrying.';
        debugLog('warn', 'Detected timeout/abort error');
      } else if (errorMessage.includes('504') || errorMessage.includes('Gateway')) {
        errorMessage = 'Server timeout. Please try again in a moment.';
        debugLog('warn', 'Detected gateway timeout (504)');
      } else if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
        debugLog('error', 'CORS error detected - response headers missing');
      }
      
      onShowResult({ success: false, error: errorMessage });
      toast({ title: "Launch Failed", description: errorMessage.slice(0, 100), variant: "destructive" });
    } finally {
      setIsLaunching(false);
      debugLog('info', 'Launch flow completed');
    }
  }, [walletAddress, toast, clearBanner, onLaunchSuccess, onShowResult]);

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({ title: "No meme to launch", description: "Click Randomize first", variant: "destructive" });
      return;
    }
    if (!meme.name.trim() || !meme.ticker.trim()) {
      toast({ title: "Name & ticker required", description: "Enter your own token name and ticker before launching", variant: "destructive" });
      return;
    }
    await performLaunch(meme);
  }, [meme, performLaunch, toast]);

  const handleCustomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleCustomLaunch = useCallback(async () => {
    if (!customToken.name.trim() || !customToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!customImageFile && !customToken.imageUrl.trim()) {
      toast({ title: "Image required", description: "Please upload an image", variant: "destructive" });
      return;
    }
    try {
      const imageUrl = await uploadCustomImageIfNeeded();
      await performLaunch({
        ...customToken,
        name: customToken.name.slice(0, 20),
        ticker: customToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 10),
        imageUrl,
      });
    } catch (e) {
      toast({ title: 'Custom launch failed', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const handleDescribeGenerate = useCallback(async () => {
    if (!describePrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the meme character you want", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setDescribedToken(null);
    clearBanner();

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: describePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setDescribedToken({ ...data.meme, name: "", ticker: "" });
        setBannerImageUrl(data.meme.imageUrl);
        toast({ title: "Image Generated! 🎨", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [describePrompt, toast, clearBanner, generateBanner]);

  const handleDescribeLaunch = useCallback(async () => {
    if (!describedToken) {
      toast({ title: "No token generated", description: "Generate first", variant: "destructive" });
      return;
    }
    if (!describedToken.name.trim() || !describedToken.ticker.trim()) {
      toast({ title: "Name & ticker required", description: "Enter your own token name and ticker before launching", variant: "destructive" });
      return;
    }
    await performLaunch(describedToken);
  }, [describedToken, performLaunch, toast]);

  // Realistic mode handlers
  const handleRealisticGenerate = useCallback(async () => {
    if (!realisticPrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the real-life image you want", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setRealisticToken(null);
    clearBanner();

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: realisticPrompt, imageStyle: "realistic" } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setRealisticToken({ ...data.meme, name: "", ticker: "" });
        setBannerImageUrl(data.meme.imageUrl);
        toast({ title: "Realistic Image Generated! 📸", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [realisticPrompt, toast, clearBanner, generateBanner]);

  const handleRealisticLaunch = useCallback(async () => {
    if (!realisticToken) {
      toast({ title: "No token generated", description: "Generate first", variant: "destructive" });
      return;
    }
    if (!realisticToken.name.trim() || !realisticToken.ticker.trim()) {
      toast({ title: "Name & ticker required", description: "Enter your own token name and ticker before launching", variant: "destructive" });
      return;
    }
    await performLaunch(realisticToken);
  }, [realisticToken, performLaunch, toast]);

  // Phantom handlers
  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: "",
          ticker: "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "AI Image Generated! 🤖", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast]);

  const handlePhantomDescribeGenerate = useCallback(async () => {
    if (!phantomDescribePrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the meme character you want", variant: "destructive" });
      return;
    }
    setIsPhantomGenerating(true);
    setPhantomMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: phantomDescribePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: "",
          ticker: "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "Image Generated! 🎨", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomDescribePrompt, toast]);

  const handlePhantomRealisticGenerate = useCallback(async () => {
    if (!phantomRealisticPrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the real-life image you want", variant: "destructive" });
      return;
    }
    setIsPhantomGenerating(true);
    setPhantomMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: phantomRealisticPrompt, imageStyle: "realistic" } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: "",
          ticker: "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "Realistic Image Generated! 📸", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomRealisticPrompt, toast]);

  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!phantomImageFile) return phantomMeme?.imageUrl || phantomToken.imageUrl;
    const fileExt = phantomImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, phantomImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [phantomImageFile, phantomMeme?.imageUrl, phantomToken.imageUrl]);

  const handlePhantomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setPhantomImageFile(file);
    setPhantomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  // Holders mode handlers
  const handleHoldersRandomize = useCallback(async () => {
    setIsHoldersGenerating(true);
    setHoldersMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setHoldersMeme(data.meme);
        setHoldersToken({
          name: "",
          ticker: "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "AI Image Generated! 🤖", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsHoldersGenerating(false);
    }
  }, [toast]);

  const handleHoldersDescribeGenerate = useCallback(async () => {
    if (!holdersDescribePrompt.trim()) {
      toast({ title: "Enter a description", description: "Describe the meme character you want", variant: "destructive" });
      return;
    }
    setIsHoldersGenerating(true);
    setHoldersMeme(null);

    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: holdersDescribePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");
      if (data?.meme) {
        setHoldersMeme(data.meme);
        setHoldersToken({
          name: "",
          ticker: "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl,
          websiteUrl: "",
          twitterUrl: "",
          telegramUrl: "",
          discordUrl: "",
        });
        toast({ title: "Image Generated! 🎨", description: "Image ready — enter your token name & ticker!" });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" });
    } finally {
      setIsHoldersGenerating(false);
    }
  }, [holdersDescribePrompt, toast]);

  const uploadHoldersImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!holdersImageFile) return holdersMeme?.imageUrl || holdersToken.imageUrl;
    const fileExt = holdersImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, holdersImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [holdersImageFile, holdersMeme?.imageUrl, holdersToken.imageUrl]);

  const handleHoldersImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }
    setHoldersImageFile(file);
    setHoldersImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleHoldersLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!holdersToken.name.trim() || !holdersToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!holdersImagePreview && !holdersMeme?.imageUrl && !holdersToken.imageUrl) {
      toast({ title: "Image required", description: "Click AI Randomize or upload an image", variant: "destructive" });
      return;
    }

    setIsPhantomLaunching(true);

    try {
      const imageUrl = await uploadHoldersImageIfNeeded();
      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: holdersToken.name.slice(0, 32),
          ticker: holdersToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
          description: holdersToken.description || "",
          imageUrl,
          websiteUrl: holdersToken.websiteUrl || "",
          twitterUrl: holdersToken.twitterUrl || "",
          telegramUrl: holdersToken.telegramUrl || "",
          discordUrl: holdersToken.discordUrl || "",
          phantomWallet: phantomWallet.address,
          tradingFeeBps: 300, // 2% creator + 1% platform = 3% total for holders mode
          creatorFeeBps: 200, // 2% creator portion
          feeMode: 'holders',
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare transactions");

      const txBase64s: string[] =
        Array.isArray(data?.unsignedTransactions) && data.unsignedTransactions.length > 0
          ? data.unsignedTransactions
          : data?.serializedTransaction
            ? [data.serializedTransaction]
            : [];

      if (txBase64s.length === 0) throw new Error(data?.error || "Failed to create transaction");

      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      const txIsVersioned: boolean[] = data?.txIsVersioned || [];
      
      const deserializeAnyTx = (base64: string, idx: number): Transaction | VersionedTransaction => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        // Use server hint if available, otherwise try V0 first
        if (txIsVersioned[idx]) {
          return VersionedTransaction.deserialize(bytes);
        }
        try {
          return VersionedTransaction.deserialize(bytes);
        } catch {
          return Transaction.from(bytes);
        }
      };

      // Reconstruct ephemeral keypairs from backend response
      const ephemeralKeypairs: Map<string, Keypair> = new Map();
      if (data?.ephemeralKeypairs) {
        for (const [pubkey, secretKeyB58] of Object.entries(data.ephemeralKeypairs)) {
          const kp = Keypair.fromSecretKey(bs58.decode(secretKeyB58 as string));
          ephemeralKeypairs.set(pubkey, kp);
        }
      }
      const txRequiredKeypairs: string[][] = data?.txRequiredKeypairs || [];

      const signatures: string[] = [];
      for (let idx = 0; idx < txBase64s.length; idx++) {
        const tx = deserializeAnyTx(txBase64s[idx], idx);
        
        // Apply ephemeral keypair signatures BEFORE wallet signs and sends
        const neededPubkeys = txRequiredKeypairs[idx] || [];
        const localSigners = neededPubkeys
          .map(pk => ephemeralKeypairs.get(pk))
          .filter((kp): kp is Keypair => !!kp);
          
        if (localSigners.length > 0) {
          if (tx instanceof Transaction) {
            (tx as Transaction).partialSign(...localSigners);
          } else {
            (tx as VersionedTransaction).sign(localSigners);
          }
        }

        // Phantom handles simulation, signing, and sending
        toast({ title: `Action required in Phantom`, description: `Approve Transaction ${idx + 1}` });
        const signature = await phantomWallet.signAndSendTransaction(tx as any);
        if (!signature) throw new Error("Transaction cancelled or failed");

        signatures.push(signature);
        // Hybrid confirmation: race WebSocket + polling (safe pattern — WS never rejects the race)
        const confirmStart = Date.now();
        const txLabel = `Transaction ${idx + 1}`;
        console.log(`[Holders Launch] ⏳ ${txLabel} confirming (hybrid):`, signature);
        
        const wsConfirm = async (): Promise<string> => {
          try {
            const { blockhash: fb, lastValidBlockHeight: fh } = await connection.getLatestBlockhash("confirmed");
            const c = await connection.confirmTransaction({ signature, blockhash: fb, lastValidBlockHeight: fh }, "confirmed");
            if (c.value.err) throw new Error(`${txLabel} failed on-chain: ${JSON.stringify(c.value.err)}`);
            return "websocket";
          } catch (e) {
            if (e instanceof Error && e.message.includes('on-chain')) throw e;
            console.warn(`[Holders Launch] WS confirm failed for ${txLabel}, falling back to polling:`, e instanceof Error ? e.message : e);
            return new Promise<never>(() => {}); // Never resolves — lets polling win
          }
        };
        
        const pollConfirm = async (): Promise<string> => {
          while (Date.now() - confirmStart < 90000) {
            try {
              const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
              const s = value?.[0];
              if (s) {
                if (s.err) throw new Error(`${txLabel} failed on-chain: ${JSON.stringify(s.err)}`);
                if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return "polling";
              }
            } catch (e) { if (e instanceof Error && e.message.includes('on-chain')) throw e; }
            await new Promise((r) => setTimeout(r, 2000));
          }
          throw new Error(`${txLabel} confirmation timed out after 90s. Check Solscan: https://solscan.io/tx/${signature}`);
        };
        
        const method = await Promise.race([wsConfirm(), pollConfirm()]);
        console.log(`[Holders Launch] ✅ ${txLabel} confirmed via ${method} in ${Date.now() - confirmStart}ms`);
        
        // 2s sync buffer before next TX
        if (idx < txBase64s.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Phase 2: record token in DB
      let recordedTokenId: string | undefined;
      try {
        const { data: recordData } = await supabase.functions.invoke("fun-phantom-create", {
          body: {
            name: holdersToken.name.slice(0, 32),
            ticker: holdersToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
            description: holdersToken.description || "",
            imageUrl,
            websiteUrl: holdersToken.websiteUrl || "",
            twitterUrl: holdersToken.twitterUrl || "",
            telegramUrl: holdersToken.telegramUrl || "",
            discordUrl: holdersToken.discordUrl || "",
            phantomWallet: phantomWallet.address,
            tradingFeeBps: 300, // 2% creator + 1% platform
            creatorFeeBps: 200,
            confirmed: true,
            mintAddress: data.mintAddress,
            dbcPoolAddress: data.dbcPoolAddress,
          },
        });
        recordedTokenId = recordData?.tokenId;
      } catch (recordErr) {
        debugLog("warn", "[Holders Launch] Token confirmed but failed to record in DB", {
          message: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }

      const lastSig = signatures[signatures.length - 1];

      onShowResult({
        success: true,
        name: holdersToken.name,
        ticker: holdersToken.ticker,
        mintAddress: data.mintAddress,
        tokenId: recordedTokenId,
        imageUrl,
        onChainSuccess: true,
        solscanUrl: lastSig ? `https://solscan.io/tx/${lastSig}` : undefined,
        tradeUrl: data.dbcPoolAddress 
          ? `https://axiom.trade/meme/${data.dbcPoolAddress}` 
          : (data.mintAddress ? `https://jup.ag/swap/SOL-${data.mintAddress}` : undefined),
        message: "Holder Rewards Token launched successfully!",
      });

      toast({ title: "🚀 Holder Rewards Token Launched!", description: `${holdersToken.name} is live with holder rewards!` });

      // Clear form
      setHoldersToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setHoldersMeme(null);
      setHoldersImageFile(null);
      setHoldersImagePreview(null);
      onLaunchSuccess();
    } catch (error: any) {
      onShowResult({ success: false, error: error.message || "Holders launch failed" });
      toast({ title: "Launch Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, holdersToken, holdersMeme, holdersImagePreview, toast, uploadHoldersImageIfNeeded, onLaunchSuccess, onShowResult]);

  const handlePhantomLaunch = useCallback(async (feeMode?: 'standard' | 'holders') => {
    // Determine which wallet to use based on launchWalletMode
    const usePrivy = launchWalletMode === "privy";
    const activeWalletAddress = usePrivy ? privyWalletAddress : phantomWallet.address;
    const isWalletConnected = usePrivy ? (isAuthenticated && privyWalletReady && !!privyWalletAddress) : (phantomWallet.isConnected && !!phantomWallet.address);
    
    if (!isWalletConnected || !activeWalletAddress) {
      toast({ title: "Wallet not connected", description: usePrivy ? "Login with Privy first" : "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl) {
      toast({ title: "Image required", description: "Click AI Randomize or upload an image", variant: "destructive" });
      return;
    }

    setIsPhantomLaunching(true);
    
    // Immediate feedback so user knows something is happening
    toast({
      title: "🚀 Preparing Launch...",
      description: "Creating pool transactions (this may take 10-20 seconds)",
    });

    // If the backend is slow/unreachable, don't leave the user staring at nothing.
    const stillWorkingTimer = window.setTimeout(() => {
      toast({
        title: "Still preparing…",
        description: "If Phantom doesn't open soon, the backend may be unreachable. Keep this tab active and try again if it times out.",
      });
    }, 15000);

    const withTimeout = async <T,>(
      promise: Promise<T>,
      ms: number,
      label: string
    ): Promise<T> => {
      let timeoutId: number | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
            }, ms);
          }),
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };

    try {
      // Wait briefly for runtime config to load (critical on fresh domains)
      const configStart = Date.now();
      while (!(window as any).__PUBLIC_CONFIG_LOADED__ && Date.now() - configStart < 2000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      
      const { url: rpcUrl, source: rpcSource } = getRpcUrl();
      console.log(`[Phantom Launch] Using RPC: ${rpcSource}`);
      const connection = new Connection(rpcUrl, "confirmed");

      // Pre-flight balance check - fetch fresh from chain with retries
      const estimatedTxFees = 0.05; // ~0.05 SOL for 3 tx rent + priority fees
      const totalNeeded = estimatedTxFees + phantomDevBuySol;
      let currentBalance: number | null = null;
      
      // Single Helius balance check — paid RPC, no need for multi-endpoint racing
      const walletPubkey = new PublicKey(activeWalletAddress!);
      try {
        const balanceLamports = await connection.getBalance(walletPubkey);
        currentBalance = balanceLamports / 1e9;
        console.log(`[Phantom Launch] Balance: ${currentBalance} SOL`);
      } catch (e) {
        console.warn(`[Phantom Launch] Balance fetch failed, using cached:`, e instanceof Error ? e.message : e);
        if (!usePrivy && phantomWallet.balance !== null && phantomWallet.balance > 0) {
          currentBalance = phantomWallet.balance;
        } else if (usePrivy && privyBalance !== null && privyBalance > 0) {
          currentBalance = privyBalance;
        }
      }
      
      // If we still can't get balance, warn but don't block - Phantom will reject if insufficient
      if (currentBalance === null || currentBalance === 0) {
        console.warn("[Phantom Launch] Could not verify balance from any RPC - proceeding anyway, Phantom will validate");
      } else if (currentBalance < totalNeeded) {
        toast({ 
          title: "Insufficient SOL", 
          description: `Need ~${totalNeeded.toFixed(3)} SOL (fees + dev buy), but wallet has ${currentBalance.toFixed(3)} SOL`, 
          variant: "destructive" 
        });
        setIsPhantomLaunching(false);
        return;
      }

      toast({ title: "Uploading image...", description: "Almost ready" });
      const imageUrl = await withTimeout(uploadPhantomImageIfNeeded(), 45_000, "Image upload");
      
      toast({ title: "Building transactions...", description: "Fetching blockhash and creating pool" });
      const { data, error } = await withTimeout(
        supabase.functions.invoke("fun-phantom-create", {
          body: {
            name: phantomToken.name.slice(0, 32),
            ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
            description: phantomToken.description || "",
            imageUrl,
            websiteUrl: phantomToken.websiteUrl || "",
            twitterUrl: phantomToken.twitterUrl || "",
            telegramUrl: phantomToken.telegramUrl || "",
            discordUrl: phantomToken.discordUrl || "",
            phantomWallet: activeWalletAddress,
            tradingFeeBps: phantomTradingFee + 100, // creator fee + 1% platform base
            creatorFeeBps: phantomTradingFee, // creator portion only
            devBuySol: phantomDevBuySol, // Dev buy amount - atomic with pool creation
            feeMode: feeMode || 'standard',
            // No specificVanityId — let backend pick dynamically (pnch first, then claw)
          },
        }),
        60_000,
        "Transaction preparation"
      );

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare Phantom transactions");

      // fun-phantom-create returns `unsignedTransactions` (preferred) but keep compatibility
      const txBase64s: string[] =
        Array.isArray(data?.unsignedTransactions) && data.unsignedTransactions.length > 0
          ? data.unsignedTransactions
          : data?.serializedTransaction
            ? [data.serializedTransaction]
            : [];

       if (txBase64s.length === 0) throw new Error(data?.error || "Failed to create transaction");

       // Backend responded — clear the "still preparing" nudge.
       window.clearTimeout(stillWorkingTimer);

       // Transaction labels for better error messages
       const baseTxLabels: string[] = data?.txLabels || txBase64s.map((_, i) => 
         i === 0 ? "Create Config" : i === 1 ? "Create Pool" : "Dev Buy"
       );

       const txIsVersioned: boolean[] = data?.txIsVersioned || [];
       
       const deserializeAnyTx = (base64: string, idx: number): Transaction | VersionedTransaction => {
         const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
         if (txIsVersioned[idx]) {
           return VersionedTransaction.deserialize(bytes);
         }
         try {
           return VersionedTransaction.deserialize(bytes);
         } catch {
           return Transaction.from(bytes);
         }
       };

       // Reconstruct ephemeral keypairs from backend response for post-Phantom signing
       const ephemeralKeypairs: Map<string, Keypair> = new Map();
       if (data?.ephemeralKeypairs) {
         for (const [pubkey, secretKeyB58] of Object.entries(data.ephemeralKeypairs)) {
           const kp = Keypair.fromSecretKey(bs58.decode(secretKeyB58 as string));
           ephemeralKeypairs.set(pubkey, kp);
         }
       }
       const txRequiredKeypairs: string[][] = data?.txRequiredKeypairs || [];

       // Deserialize all transactions (UNSIGNED — Phantom signs first for Lighthouse)
       const txsToSign = txBase64s.map((b64, idx) => deserializeAnyTx(b64, idx));
       const txLabels = baseTxLabels;
       
       console.log(`[Phantom Launch] Deserialized ${txsToSign.length} unsigned transactions (Phantom-first signing for Lighthouse)`);
       
       
       // Log transaction sizes for Lighthouse headroom analysis
       txsToSign.forEach((tx, idx) => {
         try {
           const serialized = (tx as any).serialize({ requireAllSignatures: false, verifySignatures: false });
           const bytes = serialized.length || serialized.byteLength;
           const headroom = 1232 - bytes;
           console.log(`[Phantom Launch] TX${idx + 1} (${baseTxLabels[idx]}): ${bytes} bytes / 1232 limit — ${headroom} bytes headroom for Lighthouse`);
         } catch (e) {
           // VersionedTransaction serialize differently
           try {
             const serialized = (tx as any).serialize();
             const bytes = serialized.length || serialized.byteLength;
             const headroom = 1232 - bytes;
             console.log(`[Phantom Launch] TX${idx + 1} (${baseTxLabels[idx]}): ${bytes} bytes / 1232 limit — ${headroom} bytes headroom for Lighthouse`);
           } catch (e2) {
             console.log(`[Phantom Launch] TX${idx + 1} (${baseTxLabels[idx]}): Could not measure size`);
           }
         }
       });

      // === Per Phantom Lighthouse docs for multi-signer transactions ===
      // 1. Use signTransaction() to let Phantom sign FIRST (adds Lighthouse instructions)
      // 2. dApp then signs with ephemeral keypairs (mint, config)
      // 3. dApp submits via its own RPC
      
      const signatures: string[] = [];
      
       // (dead applyEphemeralSigs removed — ephemeral signing now happens after Phantom)
      
      const signAndSendTx = async (tx: Transaction | VersionedTransaction, idx: number, label: string): Promise<{ signature: string; blockhash: string; lastValidBlockHeight: number }> => {
        console.log(`[Phantom Launch] signTransaction + sendRawTransaction: ${label} (${idx + 1}/${txsToSign.length})...`);
        
        // Fetch fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        
        // Inject blockhash (duck-typing for cross-realm safety)
        if (tx instanceof Transaction) {
          tx.recentBlockhash = blockhash;
        } else if (tx instanceof VersionedTransaction) {
          tx.message.recentBlockhash = blockhash;
        } else if ('recentBlockhash' in tx) {
          (tx as any).recentBlockhash = blockhash;
        } else if ('message' in tx && (tx as any).message) {
          (tx as any).message.recentBlockhash = blockhash;
        }
        
         // Sign transaction — Phantom or Privy embedded wallet
         let signedTx: Transaction | VersionedTransaction | null;
         if (usePrivy) {
           // Privy embedded wallet: auto-sign (no popup with showWalletUIs: false)
           // For Privy, we need to use signAndSendTransaction from the Privy hook
           // But since the launch flow needs sign-only + ephemeral sign + manual send,
           // we use phantomWallet.signTransaction as fallback for now
           // TODO: implement Privy sign-only flow
           signedTx = await phantomWallet.signTransaction(tx as any);
         } else {
           signedTx = await phantomWallet.signTransaction(tx as any);
         }
         if (!signedTx) throw new Error(`${label} was cancelled or failed`);
         
         // Apply ephemeral sigs AFTER Phantom (cross-realm safe via duck-typing)
         const neededPubkeys = txRequiredKeypairs[idx] || [];
         const localSigners = neededPubkeys.map(pk => ephemeralKeypairs.get(pk)).filter((kp): kp is Keypair => !!kp);
         
         if (localSigners.length > 0) {
           if (typeof (signedTx as any).partialSign === 'function') {
             (signedTx as any).partialSign(...localSigners);
             console.log(`[Phantom Launch] ${label}: partialSigned ${localSigners.length} ephemeral keypairs AFTER Phantom`);
           } else if (typeof (signedTx as any).sign === 'function') {
             (signedTx as any).sign(localSigners);
             console.log(`[Phantom Launch] ${label}: signed ${localSigners.length} ephemeral keypairs AFTER Phantom (versioned)`);
           }
         }
         
         // Serialize via duck-typing (cross-realm safe)
         const rawTx = typeof (signedTx as any).serialize === 'function'
           ? (signedTx as any).serialize()
           : Buffer.from((signedTx as any).serialize());
        
        const signature = await connection.sendRawTransaction(rawTx, {
          skipPreflight: true,
          maxRetries: 3,
        });
        console.log(`[Phantom Launch] ${label} sent via Helius: ${signature}`);
        
        return { signature, blockhash, lastValidBlockHeight };
      };
      
      // Hybrid confirmation: race WebSocket vs polling (safe pattern — WS never rejects the race)
      const confirmTx = async (sig: string, label: string) => {
        console.log(`[Phantom Launch] ⏳ ${label} confirming (hybrid):`, sig);
        console.log(`[Phantom Launch] Solscan: https://solscan.io/tx/${sig}`);
        signatures.push(sig);
        
        const confirmStart = Date.now();
        
        // Method 1: WebSocket — wrapped in catch so it NEVER rejects the race
        const websocketConfirm = async (): Promise<string> => {
          try {
            const { blockhash: freshBlockhash, lastValidBlockHeight: freshHeight } = 
              await connection.getLatestBlockhash("confirmed");
            console.log(`[Phantom Launch] WS confirm using blockhash ${freshBlockhash.slice(0, 8)}… (height ${freshHeight})`);
            const confirmation = await connection.confirmTransaction({
              signature: sig,
              blockhash: freshBlockhash,
              lastValidBlockHeight: freshHeight,
            }, "confirmed");
            if (confirmation.value.err) {
              throw new Error(`${label} failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
            }
            return "websocket";
          } catch (e) {
            // On-chain errors MUST propagate
            if (e instanceof Error && e.message.includes('on-chain')) throw e;
            // Block height exceeded / timeout / network errors → DON'T reject, let polling win
            console.warn(`[Phantom Launch] WS confirm failed for ${label} (${Date.now() - confirmStart}ms), falling back to polling:`, e instanceof Error ? e.message : e);
            return new Promise<never>(() => {}); // Never resolves, never rejects
          }
        };
        
        // Method 2: Polling with searchTransactionHistory — always the reliable fallback
        const pollingConfirm = async (): Promise<string> => {
          const TIMEOUT_MS = 90000;
          const POLL_INTERVAL_MS = 2000;
          let pollCount = 0;
          while (Date.now() - confirmStart < TIMEOUT_MS) {
            pollCount++;
            try {
              const { value } = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
              const status = value?.[0];
              if (status) {
                if (status.err) {
                  throw new Error(`${label} failed on-chain: ${JSON.stringify(status.err)}`);
                }
                if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
                  console.log(`[Phantom Launch] Polling found ${label} as ${status.confirmationStatus} after ${pollCount} polls (${Date.now() - confirmStart}ms)`);
                  return "polling";
                }
                console.log(`[Phantom Launch] Poll #${pollCount}: ${label} status = ${status.confirmationStatus || 'processing'} (${Date.now() - confirmStart}ms)`);
              } else {
                console.log(`[Phantom Launch] Poll #${pollCount}: ${label} not found yet (${Date.now() - confirmStart}ms)`);
              }
            } catch (e) {
              if (e instanceof Error && e.message.includes('on-chain')) throw e;
              console.warn(`[Phantom Launch] Poll #${pollCount} error:`, e instanceof Error ? e.message : e);
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          }
          throw new Error(`${label} confirmation timed out after ${TIMEOUT_MS / 1000}s. Solscan: https://solscan.io/tx/${sig}`);
        };
        
        // Race — WS errors become never-resolving promises, so only polling can reject
        const method = await Promise.race([websocketConfirm(), pollingConfirm()]);
        console.log(`[Phantom Launch] ✅ ${label} confirmed via ${method} in ${Date.now() - confirmStart}ms`);
        
        // 2s buffer for RPC sync before next TX signing
        await new Promise((r) => setTimeout(r, 2000));
        return sig;
      };
      
      // === 2-TX SEQUENTIAL MODE (Sign-After-Confirm) ===
      // TX1: sign, submit, confirm. TX2: sign after TX1 confirmed, submit.
      for (let i = 0; i < txsToSign.length; i++) {
        const txLabel = txLabels[i] || `Transaction ${i + 1}`;
        toast({ title: `Signing ${txLabel}...`, description: `Step ${i + 1} of ${txsToSign.length}` });
        const { signature } = await signAndSendTx(txsToSign[i], i, txLabel);
        toast({ title: `Confirming ${txLabel}...`, description: `Waiting for network...` });
        await confirmTx(signature, txLabel);
      }
      
      console.log('[Phantom Launch] ✅ All transactions confirmed!', { signatures });

      // Phase 2: record token in DB after on-chain confirmation
      let recordedTokenId: string | undefined;
      try {
        const { data: recordData } = await supabase.functions.invoke("fun-phantom-create", {
          body: {
            name: phantomToken.name.slice(0, 32),
            ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
            description: phantomToken.description || "",
            imageUrl,
            websiteUrl: phantomToken.websiteUrl || "",
            twitterUrl: phantomToken.twitterUrl || "",
            telegramUrl: phantomToken.telegramUrl || "",
            discordUrl: phantomToken.discordUrl || "",
            phantomWallet: activeWalletAddress,
            tradingFeeBps: phantomTradingFee + 100, // creator fee + 1% platform base
            creatorFeeBps: phantomTradingFee, // creator portion only
            confirmed: true,
            mintAddress: data.mintAddress,
            dbcPoolAddress: data.dbcPoolAddress,
          },
        });
        recordedTokenId = recordData?.tokenId;
      } catch (recordErr) {
        // Non-fatal: token is already live on-chain.
        debugLog("warn", "[Phantom Launch] Token confirmed but failed to record in DB", {
          message: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }

      const lastSig = signatures[signatures.length - 1];

      onShowResult({
        success: true,
        name: phantomToken.name,
        ticker: phantomToken.ticker,
        mintAddress: data.mintAddress,
        tokenId: recordedTokenId,
        imageUrl,
        onChainSuccess: true,
        solscanUrl: lastSig ? `https://solscan.io/tx/${lastSig}` : undefined,
        tradeUrl: data.dbcPoolAddress 
          ? `https://axiom.trade/meme/${data.dbcPoolAddress}` 
          : (data.mintAddress ? `https://jup.ag/swap/SOL-${data.mintAddress}` : undefined),
        message: "Token launched successfully via Phantom!",
      });

      toast({ title: "🚀 Token Launched via Phantom!", description: `${phantomToken.name} is live!` });

      // Clear form
      setPhantomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setPhantomMeme(null);
      setPhantomImageFile(null);
      setPhantomImagePreview(null);
      setPhantomDevBuySolInput("");
      onLaunchSuccess();
    } catch (error: any) {
      onShowResult({ success: false, error: error.message || "Phantom launch failed" });
      toast({ title: "Phantom Launch Failed", description: error.message || "Transaction failed", variant: "destructive" });
     } finally {
       window.clearTimeout(stillWorkingTimer);
       setIsPhantomLaunching(false);
     }
  }, [phantomWallet, phantomToken, phantomMeme, phantomImagePreview, phantomTradingFee, phantomDevBuySol, toast, uploadPhantomImageIfNeeded, onLaunchSuccess, onShowResult, launchWalletMode, privyWalletAddress, isAuthenticated, privyWalletReady, privyBalance]);

  // FUN mode handlers
  const uploadFunImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!funImageFile) return funToken.imageUrl;
    const fileExt = funImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, funImageFile);
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [funImageFile, funToken.imageUrl]);

  const handleFunImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setFunImageFile(file);
    setFunImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleFunPasswordSubmit = useCallback(() => {
    if (funPasswordInput.toLowerCase().trim() === "claw") {
      setFunModeUnlocked(true);
      localStorage.setItem('fun_mode_unlocked', 'true');
      toast({ title: "🎉 FUN Mode Unlocked!", description: "Create show-off tokens for your friends" });
    } else {
      toast({ title: "Wrong password", description: "Try again", variant: "destructive" });
    }
    setFunPasswordInput("");
  }, [funPasswordInput, toast]);

  const handleFunLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!funToken.name.trim() || !funToken.ticker.trim()) {
      toast({ title: "Missing token info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!funImagePreview && !funToken.imageUrl) {
      toast({ title: "Image required", description: "Upload an image", variant: "destructive" });
      return;
    }

    setIsFunLaunching(true);
    toast({ title: "🎉 Preparing FUN Token...", description: "Creating zero-fee pool..." });

    try {
      const imageUrl = await uploadFunImageIfNeeded();
      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      const { data, error } = await supabase.functions.invoke("fun-mode-create", {
        body: {
          name: funToken.name.slice(0, 32),
          ticker: funToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
          description: funToken.description || "",
          imageUrl,
          phantomWallet: phantomWallet.address,
          totalSupply: funTotalSupply,
          lpTokenAmount: funLpTokens,
          lpSolAmount: funLpSol,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare FUN transactions");

      const txBase64s: string[] = data.unsignedTransactions || [];
      if (txBase64s.length === 0) throw new Error("No transactions returned");

      const txIsVersioned: boolean[] = data.txIsVersioned || [];
      const txLabels: string[] = data.txLabels || ["Create Token", "Create Pool"];

      const deserializeAnyTx = (base64: string, idx: number): Transaction | VersionedTransaction => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        if (txIsVersioned[idx]) return VersionedTransaction.deserialize(bytes);
        try { return VersionedTransaction.deserialize(bytes); } catch { return Transaction.from(bytes); }
      };

      const ephemeralKeypairs: Map<string, Keypair> = new Map();
      if (data.ephemeralKeypairs) {
        for (const [pubkey, secretKeyB58] of Object.entries(data.ephemeralKeypairs)) {
          ephemeralKeypairs.set(pubkey, Keypair.fromSecretKey(bs58.decode(secretKeyB58 as string)));
        }
      }
      const txRequiredKeypairs: string[][] = data.txRequiredKeypairs || [];

      const signatures: string[] = [];
      for (let idx = 0; idx < txBase64s.length; idx++) {
        const tx = deserializeAnyTx(txBase64s[idx], idx);
        const txLabel = txLabels[idx] || `TX ${idx + 1}`;
        toast({ title: `Signing ${txLabel}...`, description: `Step ${idx + 1} of ${txBase64s.length}` });

        // Ephemeral keypairs sign BEFORE wallet
        const neededPubkeys = txRequiredKeypairs[idx] || [];
        const localSigners = neededPubkeys.map(pk => ephemeralKeypairs.get(pk)).filter((kp): kp is Keypair => !!kp);
        
        if (localSigners.length > 0) {
          if (tx instanceof Transaction) {
            tx.partialSign(...localSigners);
          } else {
            tx.sign(localSigners);
          }
        }

        // Sign and Send via Phantom
        toast({ title: `Action required in Phantom`, description: `Approve ${txLabel}` });
        const signature = await phantomWallet.signAndSendTransaction(tx as any);
        if (!signature) throw new Error(`${txLabel} cancelled or failed`);
        signatures.push(signature);
        toast({ title: `Confirming ${txLabel}...` });
        await connection.confirmTransaction(signature, "confirmed");

        if (idx < txBase64s.length - 1) await new Promise(r => setTimeout(r, 2000));
      }

      // Phase 2: Record in DB
      let recordedTokenId: string | undefined;
      try {
        const { data: recordData } = await supabase.functions.invoke("fun-mode-create", {
          body: {
            name: funToken.name.slice(0, 32),
            ticker: funToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10),
            description: funToken.description || "",
            imageUrl,
            phantomWallet: phantomWallet.address,
            confirmed: true,
            mintAddress: data.mintAddress,
            poolAddress: data.poolAddress,
          },
        });
        recordedTokenId = recordData?.tokenId;
      } catch (recordErr) {
        debugLog("warn", "[FUN Launch] Token live but failed to record in DB", {
          message: recordErr instanceof Error ? recordErr.message : String(recordErr),
        });
      }

      onShowResult({
        success: true,
        name: funToken.name,
        ticker: funToken.ticker,
        mintAddress: data.mintAddress,
        tokenId: recordedTokenId,
        imageUrl,
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/token/${data.mintAddress}`,
        message: "🎉 FUN token launched! LP is unlocked, zero fees.",
      });

      toast({ title: "🎉 FUN Token Launched!", description: `${funToken.name} is live! Send tokens to your friend's wallet!` });

      // Save pool address for remove LP
      if (data.poolAddress) {
        localStorage.setItem('fun_last_pool_address', data.poolAddress);
        setFunRemovePoolAddress(data.poolAddress);
      }

      // Clear form
      setFunToken({ name: "", ticker: "", description: "", imageUrl: "" });
      setFunImageFile(null);
      setFunImagePreview(null);
      onLaunchSuccess();
    } catch (error: any) {
      onShowResult({ success: false, error: error.message || "FUN launch failed" });
      toast({ title: "FUN Launch Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsFunLaunching(false);
    }
  }, [phantomWallet, funToken, funImagePreview, funTotalSupply, funLpSol, funLpTokens, toast, uploadFunImageIfNeeded, onLaunchSuccess, onShowResult]);

  // FUN mode presets
  const FUN_PRESETS = [
    { label: "💰 $30K Flex", emoji: "💰", supply: 1_000_000_000, lpTokens: 100_000, lpSol: 0.01, sendTokens: 20_000_000, desc: "Send 20M tokens → friend sees ~$30K" },
    { label: "🤑 $100K Baller", emoji: "🤑", supply: 1_000_000_000, lpTokens: 50_000, lpSol: 0.01, sendTokens: 20_000_000, desc: "Send 20M tokens → friend sees ~$100K" },
    { label: "🐳 $1M Whale", emoji: "🐳", supply: 1_000_000_000, lpTokens: 10_000, lpSol: 0.01, sendTokens: 50_000_000, desc: "Send 50M tokens → friend sees ~$1M+" },
  ];

  const handleFunPresetClick = useCallback((preset: typeof FUN_PRESETS[0]) => {
    setFunTotalSupply(preset.supply);
    setFunLpTokens(preset.lpTokens);
    setFunLpSol(preset.lpSol);
    toast({ title: `${preset.emoji} Values set!`, description: preset.desc });
  }, [toast]);

  // Remove FUN LP handler
  const handleRemoveFunLp = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Wallet not connected", description: "Connect Phantom first", variant: "destructive" });
      return;
    }
    if (!funRemovePoolAddress.trim()) {
      toast({ title: "Pool address required", description: "Enter the pool address from your FUN launch", variant: "destructive" });
      return;
    }

    setIsRemovingFunLp(true);
    toast({ title: "🔄 Preparing LP removal...", description: "Building transaction..." });

    try {
      const { data, error } = await supabase.functions.invoke("fun-mode-remove-lp", {
        body: {
          poolAddress: funRemovePoolAddress.trim(),
          phantomWallet: phantomWallet.address,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare remove LP transaction");

      const txBase64 = data.unsignedTransaction;
      if (!txBase64) throw new Error("No transaction returned");

      // Deserialize
      const bytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      let tx: Transaction;
      try {
        tx = Transaction.from(bytes);
      } catch {
        throw new Error("Failed to deserialize transaction");
      }

      const { url: rpcUrl } = getRpcUrl();
      const connection = new Connection(rpcUrl, "confirmed");

      // Sign and Send with Phantom
      toast({ title: "Action required in Phantom", description: "Approve the LP removal transaction" });
      const signature = await phantomWallet.signAndSendTransaction(tx as any);
      if (!signature) throw new Error("Transaction cancelled or failed");

      toast({ title: "⏳ Confirming...", description: "Waiting for on-chain confirmation" });
      await connection.confirmTransaction(signature, "confirmed");

      toast({ title: "✅ LP Removed!", description: "Your SOL is back in your wallet. The token is now untradeable." });
      
      // Clear the saved pool address
      localStorage.removeItem('fun_last_pool_address');
      setFunRemovePoolAddress("");
    } catch (error: any) {
      toast({ title: "Remove LP Failed", description: error.message || "Transaction failed", variant: "destructive" });
    } finally {
      setIsRemovingFunLp(false);
    }
  }, [phantomWallet, funRemovePoolAddress, toast]);

  // Calculate implied values for FUN mode display
  const funImpliedPrice = funLpSol / funLpTokens;
  const funImpliedMarketCapSol = funImpliedPrice * funTotalSupply;
  const funImpliedMarketCapUsd = solPrice ? funImpliedMarketCapSol * solPrice : null;

  const modes = [
    { id: "random" as const, label: "Random", icon: Shuffle },
    { id: "describe" as const, label: "Describe", icon: Sparkles },
    { id: "realistic" as const, label: "Realistic", icon: Camera },
    { id: "custom" as const, label: "Custom", icon: Pencil },
    { id: "phantom" as const, label: "Phantom", icon: Wallet },
    { id: "holders" as const, label: "Holders", icon: Users },
    ...(funModeUnlocked ? [{ id: "fun" as const, label: "FUN", icon: PartyPopper }] : []),
  ];

  const innerContent = (
    <div className={bare ? "p-5 space-y-4" : "gate-card-body space-y-4"}>
        {/* Mode Selector - hidden when defaultMode is set (locked mode) */}
        {!defaultMode && (
        <div className="gate-launch-modes">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setGeneratorMode(mode.id)}
              className={`gate-launch-mode ${generatorMode === mode.id ? "active" : ""}`}
            >
              <mode.icon className="h-4 w-4" />
              {mode.label}
            </button>
          ))}
        </div>
        )}

        {/* Random Mode */}
        {generatorMode === "random" && (
          <div className="space-y-4">
            <div className="gate-token-preview">
              <div className="gate-token-preview-avatar">
                {isGenerating ? (
                  <MemeLoadingAnimation />
                ) : meme?.imageUrl ? (
                  <ImagePreviewOverlay
                    src={meme.imageUrl}
                    alt={meme.name || "Generated"}
                    downloadName={`${meme.ticker || meme.name || "token"}.png`}
                    onClear={() => setMeme(null)}
                  />
                ) : (
                  <Shuffle className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="gate-token-preview-info space-y-2">
                {isGenerating ? (
                  <MemeLoadingText />
                ) : meme ? (
                  <>
                    <Input
                      value={meme.name}
                      onChange={(e) => setMeme({ ...meme, name: e.target.value.slice(0, 20) })}
                      className="gate-input h-8"
                      placeholder="Token name"
                      maxLength={20}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-primary text-sm">$</span>
                      <Input
                        value={meme.ticker}
                        onChange={(e) => setMeme({ ...meme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                        className="gate-input h-7 w-24 font-mono"
                        placeholder="TICKER"
                        maxLength={10}
                      />
                      {meme?.imageUrl && (
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = meme.imageUrl;
                            a.download = `${(meme.ticker || "token").toLowerCase()}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="ml-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <Download className="h-3 w-3" />
                          Download Generated img
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Click Randomize to generate</p>
                )}
              </div>
            </div>

            {meme && (
              <Textarea
                value={meme.description}
                onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })}
                className="gate-input gate-textarea text-sm"
                placeholder="Description"
                maxLength={280}
              />
            )}

            <Button onClick={handleRandomize} disabled={isGenerating || isLaunching} className="gate-btn gate-btn-secondary w-full">
              {isGenerating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> Randomize</>}
            </Button>

            {meme && (
              <>
                {/* Editable social links - all optional */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Website URL (optional)"
                      value={meme.websiteUrl || ""}
                      onChange={(e) => setMeme({ ...meme, websiteUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="X/Twitter URL (optional)"
                      value={meme.twitterUrl || ""}
                      onChange={(e) => setMeme({ ...meme, twitterUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Telegram URL (optional)"
                      value={meme.telegramUrl || ""}
                      onChange={(e) => setMeme({ ...meme, telegramUrl: e.target.value || undefined })}
                      className="gate-input text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setBannerTextName(meme.name);
                    setBannerTextTicker(meme.ticker);
                    setBannerImageUrl(meme.imageUrl);
                    generateBanner({ imageUrl: meme.imageUrl, tokenName: meme.name, ticker: meme.ticker });
                  }}
                  disabled={isBannerGenerating || !meme.imageUrl}
                  variant="outline"
                  className="gate-btn gate-btn-ghost w-full"
                >
                  {isBannerGenerating ? <><Image className="h-4 w-4 mr-2 animate-pulse" /> Generating...</> : <><Image className="h-4 w-4 mr-2" /> Generate Banner</>}
                </Button>

                {bannerUrl && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <img src={bannerUrl} alt="Banner" className="w-full rounded" />
                    <Button onClick={() => downloadBanner(bannerUrl, meme.name)} className="gate-btn gate-btn-primary w-full">
                      <Download className="h-4 w-4 mr-2" /> Download Banner
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="gate-input font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Receive 50% of trading fees</p>
                  <Button onClick={handleLaunch} disabled={isLaunching || !walletAddress} className="gate-btn gate-btn-primary w-full">
                    {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Describe Mode */}
        {generatorMode === "describe" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Describe the meme character you want. AI will generate everything.</p>
            <Textarea
              value={describePrompt}
              onChange={(e) => setDescribePrompt(e.target.value)}
              placeholder="e.g., A smug frog wearing sunglasses..."
              className="gate-input gate-textarea"
              maxLength={500}
            />
            <Button onClick={handleDescribeGenerate} disabled={isGenerating || !describePrompt.trim()} className="gate-btn gate-btn-primary w-full">
              {isGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
            </Button>

            {describedToken && (
              <>
                <div className="gate-token-preview">
                  <div className="gate-token-preview-avatar">
                    <ImagePreviewOverlay
                      src={describedToken.imageUrl}
                      alt={describedToken.name}
                      downloadName={`${describedToken.ticker || describedToken.name || "token"}.png`}
                      onClear={() => setDescribedToken(null)}
                    />
                  </div>
                  <div className="gate-token-preview-info space-y-2">
                    <Input
                      value={describedToken.name}
                      onChange={(e) => setDescribedToken({ ...describedToken, name: e.target.value.slice(0, 20) })}
                      className="gate-input h-8"
                      placeholder="Token name"
                      maxLength={20}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-primary text-sm">$</span>
                      <Input
                        value={describedToken.ticker}
                        onChange={(e) => setDescribedToken({ ...describedToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                        className="gate-input h-7 w-24 font-mono"
                        placeholder="TICKER"
                        maxLength={10}
                      />
                      {describedToken?.imageUrl && (
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = describedToken.imageUrl;
                            a.download = `${(describedToken.ticker || "token").toLowerCase()}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="ml-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <Download className="h-3 w-3" />
                          Download Generated img
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editable Description */}
                <Textarea
                  value={describedToken.description || ""}
                  onChange={(e) => setDescribedToken({ ...describedToken, description: e.target.value.slice(0, 200) })}
                  placeholder="Token description..."
                  className="gate-input gate-textarea text-sm"
                  maxLength={200}
                  rows={2}
                />

                {/* Social links - collapsible */}
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <Globe className="h-3 w-3" />
                    <span>Add Social Links (optional)</span>
                  </summary>
                  <div className="mt-2 space-y-2 pl-5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Website URL"
                        value={describedToken.websiteUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, websiteUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="X/Twitter URL"
                        value={describedToken.twitterUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, twitterUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Telegram URL"
                        value={describedToken.telegramUrl || ""}
                        onChange={(e) => setDescribedToken({ ...describedToken, telegramUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                  </div>
                </details>

                {bannerUrl && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <img src={bannerUrl} alt="Banner" className="w-full rounded" />
                    <Button onClick={() => downloadBanner(bannerUrl, describedToken.name)} className="gate-btn gate-btn-primary w-full">
                      <Download className="h-4 w-4 mr-2" /> Download Banner
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="gate-input font-mono text-sm"
                  />
                  <Button onClick={handleDescribeLaunch} disabled={isLaunching || !walletAddress} className="gate-btn gate-btn-primary w-full">
                    {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Realistic Mode */}
        {generatorMode === "realistic" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Describe what you want. AI generates a realistic, real-life image.</p>
            <Textarea
              value={realisticPrompt}
              onChange={(e) => setRealisticPrompt(e.target.value)}
              placeholder="e.g., A golden retriever wearing a tiny top hat in a park..."
              className="gate-input gate-textarea"
              maxLength={500}
            />
            <Button onClick={handleRealisticGenerate} disabled={isGenerating || !realisticPrompt.trim()} className="gate-btn gate-btn-primary w-full">
              {isGenerating ? <><Camera className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Camera className="h-4 w-4 mr-2" /> Generate Realistic Image</>}
            </Button>

            {realisticToken && (
              <>
                <div className="gate-token-preview">
                  <div className="gate-token-preview-avatar">
                    <ImagePreviewOverlay
                      src={realisticToken.imageUrl}
                      alt={realisticToken.name}
                      downloadName={`${realisticToken.ticker || realisticToken.name || "token"}.png`}
                      onClear={() => setRealisticToken(null)}
                    />
                  </div>
                  <div className="gate-token-preview-info space-y-2">
                    <Input
                      value={realisticToken.name}
                      onChange={(e) => setRealisticToken({ ...realisticToken, name: e.target.value.slice(0, 20) })}
                      className="gate-input h-8"
                      placeholder="Token name"
                      maxLength={20}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-primary text-sm">$</span>
                      <Input
                        value={realisticToken.ticker}
                        onChange={(e) => setRealisticToken({ ...realisticToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                        className="gate-input h-7 w-24 font-mono"
                        placeholder="TICKER"
                        maxLength={10}
                      />
                      {realisticToken?.imageUrl && (
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = realisticToken.imageUrl;
                            a.download = `${(realisticToken.ticker || "token").toLowerCase()}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="ml-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                        >
                          <Download className="h-3 w-3" />
                          Download Generated img
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <Textarea
                  value={realisticToken.description || ""}
                  onChange={(e) => setRealisticToken({ ...realisticToken, description: e.target.value.slice(0, 200) })}
                  placeholder="Token description..."
                  className="gate-input gate-textarea text-sm"
                  maxLength={200}
                  rows={2}
                />

                <details className="group">
                  <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    <Globe className="h-3 w-3" />
                    <span>Add Social Links (optional)</span>
                  </summary>
                  <div className="mt-2 space-y-2 pl-5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Website URL"
                        value={realisticToken.websiteUrl || ""}
                        onChange={(e) => setRealisticToken({ ...realisticToken, websiteUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="X/Twitter URL"
                        value={realisticToken.twitterUrl || ""}
                        onChange={(e) => setRealisticToken({ ...realisticToken, twitterUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Telegram URL"
                        value={realisticToken.telegramUrl || ""}
                        onChange={(e) => setRealisticToken({ ...realisticToken, telegramUrl: e.target.value })}
                        className="gate-input text-sm"
                      />
                    </div>
                  </div>
                </details>

                {bannerUrl && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <img src={bannerUrl} alt="Banner" className="w-full rounded" />
                    <Button onClick={() => downloadBanner(bannerUrl, realisticToken.name)} className="gate-btn gate-btn-primary w-full">
                      <Download className="h-4 w-4 mr-2" /> Download Banner
                    </Button>
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <Input
                    placeholder="Your SOL wallet address..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="gate-input font-mono text-sm"
                  />
                  <Button onClick={handleRealisticLaunch} disabled={isLaunching || !walletAddress} className="gate-btn gate-btn-primary w-full">
                    {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Token</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Custom Mode */}
        {generatorMode === "custom" && (
          <div className="space-y-4">
            <div className="gate-token-preview">
              <div className="gate-token-preview-avatar">
                {customImagePreview ? (
                  <ImagePreviewOverlay
                    src={customImagePreview}
                    alt="Token"
                    downloadName={`${customToken.name || "token"}.png`}
                    onClear={() => {
                      setCustomImagePreview(null);
                      setCustomImageFile(null);
                    }}
                  />
                ) : (
                  <Pencil className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="gate-token-preview-info space-y-2">
                <Input
                  value={customToken.name}
                  onChange={(e) => setCustomToken({ ...customToken, name: e.target.value })}
                  className="gate-input h-8"
                  placeholder="Token name"
                  maxLength={20}
                />
                <Input
                  value={customToken.ticker}
                  onChange={(e) => setCustomToken({ ...customToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                  className="gate-input h-8 font-mono"
                  placeholder="TICKER"
                  maxLength={6}
                />
              </div>
            </div>

            <Textarea
              value={customToken.description}
              onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })}
              placeholder="Description"
              className="gate-input gate-textarea"
              maxLength={280}
            />

            <Input type="file" accept="image/*" onChange={handleCustomImageChange} className="gate-input" />

            {/* Social links - collapsible */}
            <details className="group">
              <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                <Globe className="h-3 w-3" />
                <span>Add Social Links (optional)</span>
              </summary>
              <div className="mt-2 space-y-2 pl-5">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Website URL"
                    value={customToken.websiteUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="X/Twitter URL"
                    value={customToken.twitterUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Telegram URL"
                    value={customToken.telegramUrl || ""}
                    onChange={(e) => setCustomToken({ ...customToken, telegramUrl: e.target.value })}
                    className="gate-input text-sm"
                  />
                </div>
              </div>
            </details>

            <div className="space-y-3 pt-3 border-t border-border">
              <Input
                placeholder="Your SOL wallet address..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="gate-input font-mono text-sm"
              />
              <Button onClick={handleCustomLaunch} disabled={isLaunching || !walletAddress || !customToken.name || !customToken.ticker} className="gate-btn gate-btn-primary w-full">
                {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch Custom Token</>}
              </Button>
            </div>
          </div>
        )}

        {/* Phantom Mode */}
        {generatorMode === "phantom" && (
          <div className="space-y-6">
            {/* Wallet Mode Toggle: Phantom vs Privy */}
            <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/50">
              <button
                onClick={() => setLaunchWalletMode("phantom")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs rounded-lg transition-all ${
                  launchWalletMode === "phantom"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                Phantom
              </button>
              <button
                onClick={() => setLaunchWalletMode("privy")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs rounded-lg transition-all ${
                  launchWalletMode === "privy"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Rocket className="h-3.5 w-3.5" />
                1-Click (Privy)
              </button>
            </div>

            {/* ═══ PRIVY WALLET MODE ═══ */}
            {launchWalletMode === "privy" && (
              <>
                {!isAuthenticated ? (
                  <button
                    onClick={privyLogin}
                    className="w-full h-12 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer phantom-connect-btn"
                  >
                    <Wallet className="h-4 w-4" /> Connect Wallet
                  </button>
                ) : !privyWalletReady ? (
                  <div className="p-4 rounded-xl border border-border bg-muted/30 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">Setting up your wallet...</p>
                  </div>
                ) : (
                  <>
                    {/* Privy Wallet Pill */}
                    <div className="flex items-center justify-between p-4 rounded-xl phantom-wallet-pill">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 10px hsl(var(--primary) / 0.5)" }} />
                        <span className="text-sm font-mono font-semibold tracking-tight text-white/90">
                          {privyWalletAddress?.slice(0, 4)}...{privyWalletAddress?.slice(-4)}
                        </span>
                        {privyBalance !== null && (
                          <span className="text-xs font-mono text-white/35">{privyBalance.toFixed(3)} SOL</span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-primary/20 text-primary">1-CLICK</span>
                    </div>

                    {/* Deposit prompt if balance too low */}
                    {privyWalletAddress && (privyBalance === null || privyBalance < 0.05) && !privyDepositReady && (
                      <LaunchpadDepositPrompt
                        walletAddress={privyWalletAddress}
                        minSol={0.05}
                        onReady={() => {
                          setPrivyDepositReady(true);
                          getPrivyBalance().then(b => setPrivyBalance(b));
                        }}
                      />
                    )}

                    {/* When Privy is ready, show form + 1-click launch */}
                    {(privyDepositReady || (privyBalance !== null && privyBalance >= 0.05)) && (
                      <>
                        {/* Trading Fee */}
                        <div className="space-y-3 phantom-slider">
                          <div className="flex items-center justify-between">
                            <span className="text-white/45 uppercase tracking-wider font-semibold text-[10px]">Creator Fee</span>
                            <span className={`font-bold text-base font-mono ${phantomTradingFee >= 600 ? "text-destructive" : "text-primary"}`}>
                              {(phantomTradingFee / 100).toFixed(1)}%
                            </span>
                          </div>
                          <Slider value={[phantomTradingFee]} onValueChange={(v) => setPhantomTradingFee(v[0])} min={10} max={1000} step={10} className="phantom-slider-thick" />
                        </div>

                        {/* Dev Buy */}
                        <div className="space-y-3 p-5 rounded-xl phantom-devbuy-card">
                          <div className="flex items-center justify-between">
                            <span className="text-white/45 uppercase tracking-wider font-semibold text-[10px]">Dev Buy (optional)</span>
                            <span className="font-bold text-base font-mono text-primary">{phantomDevBuySol} SOL</span>
                          </div>
                          <Input type="text" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="0.00"
                            value={phantomDevBuySolInput}
                            onChange={(e) => { let next = e.target.value; if (next.startsWith('.')) next = '0' + next; if (next === "" || DEV_BUY_INPUT_RE.test(next)) setPhantomDevBuySolInput(next); }}
                            onBlur={() => setPhantomDevBuySolInput(formatDevBuySolInput(parseDevBuySol(phantomDevBuySolInput)))}
                            className="h-11 rounded-xl text-sm font-medium font-mono phantom-glass-input" />
                        </div>

                        {/* Sub-mode tabs */}
                        <div className="flex gap-1 p-1.5 rounded-xl phantom-mode-tabs">
                          {[
                            { id: "random" as const, label: "Random", icon: Shuffle },
                            { id: "describe" as const, label: "Describe", icon: Sparkles },
                            { id: "realistic" as const, label: "Realistic", icon: Camera },
                            { id: "custom" as const, label: "Custom", icon: Pencil },
                          ].map((subMode) => (
                            <button key={subMode.id} onClick={() => setPhantomSubMode(subMode.id)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs rounded-lg cursor-pointer phantom-mode-tab ${phantomSubMode === subMode.id ? "phantom-mode-tab-active" : "text-white/30"}`}>
                              <subMode.icon className="h-3 w-3" />{subMode.label}
                            </button>
                          ))}
                        </div>

                        {phantomSubMode === "random" && (
                          <button onClick={handlePhantomRandomize} disabled={isPhantomGenerating}
                            className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn">
                            {isPhantomGenerating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4" /> AI Randomize</>}
                          </button>
                        )}

                        {phantomSubMode === "describe" && (
                          <>
                            <textarea value={phantomDescribePrompt} onChange={(e) => setPhantomDescribePrompt(e.target.value)}
                              placeholder="Describe your meme character..." maxLength={500}
                              className="w-full min-h-[90px] rounded-xl p-4 text-sm resize-none phantom-glass-textarea" />
                            <button onClick={handlePhantomDescribeGenerate} disabled={isPhantomGenerating || !phantomDescribePrompt.trim()}
                              className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn">
                              {isPhantomGenerating ? <><Sparkles className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate</>}
                            </button>
                          </>
                        )}

                        {phantomSubMode === "realistic" && (
                          <>
                            <textarea value={phantomRealisticPrompt} onChange={(e) => setPhantomRealisticPrompt(e.target.value)}
                              placeholder="Describe what you want..." maxLength={500}
                              className="w-full min-h-[90px] rounded-xl p-4 text-sm resize-none phantom-glass-textarea" />
                            <button onClick={handlePhantomRealisticGenerate} disabled={isPhantomGenerating || !phantomRealisticPrompt.trim()}
                              className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn">
                              {isPhantomGenerating ? <><Camera className="h-4 w-4 animate-spin" /> Generating...</> : <><Camera className="h-4 w-4" /> Generate</>}
                            </button>
                          </>
                        )}

                        {/* Token Preview & Form */}
                        {!isPhantomGenerating && (phantomSubMode === "custom" || phantomMeme || phantomToken.name) && (
                          <>
                            <div className="phantom-image-upload-area">
                              {phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl ? (
                                <div className="relative w-full h-full group">
                                  <img src={phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl} alt="Token" className="w-full h-full object-cover rounded-xl" />
                                  <button onClick={() => { setPhantomImageFile(null); setPhantomImagePreview(null); if (phantomMeme) setPhantomMeme({ ...phantomMeme, imageUrl: "" }); setPhantomToken({ ...phantomToken, imageUrl: "" }); }}
                                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-destructive hover:bg-destructive/80 flex items-center justify-center transition-colors z-10 shadow-lg">
                                    <X className="h-3.5 w-3.5 text-destructive-foreground" />
                                  </button>
                                </div>
                              ) : (
                                <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer group">
                                  <Image className="h-5 w-5 text-muted-foreground/40" />
                                  <p className="text-[11px] text-muted-foreground/50">Upload PNG/JPG/SVG</p>
                                  <input type="file" accept="image/*" onChange={handlePhantomImageChange} className="hidden" />
                                </label>
                              )}
                            </div>

                            <div className="space-y-3">
                              <Input value={phantomToken.name} onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 32) })}
                                className="phantom-glass-input h-10 rounded-xl" placeholder="Token name" maxLength={32} />
                              <div className="flex items-center gap-3 pl-2">
                                <span className="text-primary text-sm font-bold">$</span>
                                <Input value={phantomToken.ticker} onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                                  className="phantom-glass-input h-9 w-32 font-mono rounded-lg" placeholder="TICKER" maxLength={10} />
                              </div>
                            </div>

                            <Textarea value={phantomToken.description} onChange={(e) => setPhantomToken({ ...phantomToken, description: e.target.value })}
                              placeholder="Description (optional)" className="phantom-glass-textarea rounded-xl min-h-[80px]" maxLength={500} />

                            {/* 1-Click Launch Button */}
                            <button onClick={() => handlePhantomLaunch()}
                              disabled={isPhantomLaunching || !phantomToken.name.trim() || !phantomToken.ticker.trim() || (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl)}
                              className="w-full h-13 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer phantom-action-btn">
                              {isPhantomLaunching ? <><Rocket className="h-4 w-4 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4" /> 1-Click Launch 🚀</>}
                            </button>
                            <p className="text-[10px] text-center text-muted-foreground/60">No popups — auto-signed via your embedded wallet</p>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ═══ PHANTOM WALLET MODE (original) ═══ */}
            {launchWalletMode === "phantom" && !phantomWallet.isConnected ? (
              <button
                onClick={phantomWallet.connect}
                disabled={phantomWallet.isConnecting}
                className="w-full h-12 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer phantom-connect-btn"
              >
                {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4" /> Connect Phantom</>}
              </button>
            ) : launchWalletMode === "phantom" ? (
              <>
                {/* Wallet Pill */}
                <div className="flex items-center justify-between p-4 rounded-xl phantom-wallet-pill">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "#22c55e", boxShadow: "0 0 10px rgba(34,197,94,0.5)" }} />
                    <span className="text-sm font-mono font-semibold tracking-tight text-white/90">
                      {phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}
                    </span>
                    {phantomWallet.balance !== null && (
                      <span className="text-xs font-mono text-white/35">{phantomWallet.balance.toFixed(3)} SOL</span>
                    )}
                  </div>
                  <button
                    onClick={phantomWallet.disconnect}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer phantom-disconnect-btn"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Trading Fee */}
                <div className="space-y-3 phantom-slider">
                  <div className="flex items-center justify-between">
                    <span className="text-white/45 uppercase tracking-wider font-semibold text-[10px]">Creator Fee</span>
                    <span
                      className={`font-bold text-base font-mono ${
                        phantomTradingFee >= 900
                          ? "text-interaction-like"
                          : phantomTradingFee >= 600
                            ? "text-destructive"
                            : phantomTradingFee >= 500
                              ? "text-binance-yellow-dark"
                              : phantomTradingFee >= 300
                                ? "text-warning"
                                : "text-primary"
                      }`}
                    >
                      {(phantomTradingFee / 100).toFixed(1)}%
                    </span>
                  </div>

                  <Slider
                    value={[phantomTradingFee]}
                    onValueChange={(v) => setPhantomTradingFee(v[0])}
                    min={10}
                    max={1000}
                    step={10}
                    className="phantom-slider-thick"
                    trackClassName="bg-white/[0.06] h-2.5"
                    rangeClassName={
                      phantomTradingFee >= 900
                        ? "bg-interaction-like"
                        : phantomTradingFee >= 600
                          ? "bg-destructive"
                          : phantomTradingFee >= 500
                            ? "bg-binance-yellow-dark"
                            : phantomTradingFee >= 300
                              ? "bg-warning"
                              : "bg-primary"
                    }
                    thumbClassName={`w-6 h-6 ${
                      phantomTradingFee >= 900
                        ? "border-interaction-like"
                        : phantomTradingFee >= 600
                          ? "border-destructive"
                          : phantomTradingFee >= 500
                            ? "border-binance-yellow-dark"
                            : phantomTradingFee >= 300
                              ? "border-warning"
                              : "border-primary"
                    }`}
                  />

                  <div className="flex justify-between text-[10px] text-white/20 font-mono">
                    <span>0.1%</span>
                    <span>10%</span>
                  </div>
                  <div className="text-[10px] text-white/30 text-center">
                    Total on-chain fee: <span className="text-white/50 font-medium">{((phantomTradingFee + 100) / 100).toFixed(1)}%</span> <span className="text-white/20">(incl. 1% platform)</span>
                  </div>

                  {phantomTradingFee >= 600 && (
                    <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 phantom-warning-card">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                      <p className="text-xs leading-snug text-white/50">
                        <span className="font-semibold text-destructive">Warning:</span>{" "}
                        Such fees won't generate you any volume.
                      </p>
                    </div>
                  )}
                </div>

                {/* Neon divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                {/* Dev Buy */}
                <div className="space-y-3 p-5 rounded-xl phantom-devbuy-card">
                  <div className="flex items-center justify-between">
                    <span className="text-white/45 uppercase tracking-wider font-semibold text-[10px]">Dev Buy (optional)</span>
                    <span className="font-bold text-base font-mono text-primary">{phantomDevBuySol} SOL</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #9945FF, #14F195)", boxShadow: "0 0 8px rgba(153,69,255,0.3)" }}>
                        <span className="text-[8px] font-bold text-white">◎</span>
                      </div>
                    </div>
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="0.00"
                      value={phantomDevBuySolInput}
                      onChange={(e) => {
                        let next = e.target.value;
                        if (next.startsWith('.')) {
                          next = '0' + next;
                        }
                        if (next === "" || DEV_BUY_INPUT_RE.test(next)) {
                          setPhantomDevBuySolInput(next);
                        }
                      }}
                      onBlur={() => {
                        setPhantomDevBuySolInput(formatDevBuySolInput(parseDevBuySol(phantomDevBuySolInput)));
                      }}
                      className="h-11 rounded-xl pl-10 text-sm font-medium font-mono phantom-glass-input"
                    />
                  </div>
                  <p className="text-[10px] text-white/25 leading-relaxed">
                    Buy tokens atomically with pool creation to prevent frontrunning. Max 10 SOL.
                  </p>
                </div>

                {/* Neon divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                {/* Mode Tabs */}
                <div className="flex gap-1 p-1.5 rounded-xl phantom-mode-tabs">
                  {[
                    { id: "random" as const, label: "Random", icon: Shuffle },
                    { id: "describe" as const, label: "Describe", icon: Sparkles },
                    { id: "realistic" as const, label: "Realistic", icon: Camera },
                    { id: "custom" as const, label: "Custom", icon: Pencil },
                  ].map((subMode) => (
                    <button
                      key={subMode.id}
                      onClick={() => setPhantomSubMode(subMode.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs rounded-lg cursor-pointer phantom-mode-tab ${
                        phantomSubMode === subMode.id ? "phantom-mode-tab-active" : "text-white/30"
                      } ${subMode.id === "custom" ? "phantom-mode-tab-custom" : ""}`}
                    >
                      <subMode.icon className="h-3 w-3" />
                      {subMode.label}
                    </button>
                  ))}
                </div>

                {/* Random Sub-Mode */}
                {phantomSubMode === "random" && (
                  <>
                    <button
                      onClick={handlePhantomRandomize}
                      disabled={isPhantomGenerating}
                      className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn"
                    >
                      {isPhantomGenerating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4" /> AI Randomize</>}
                    </button>

                    {isPhantomGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Describe Sub-Mode */}
                {phantomSubMode === "describe" && (
                  <>
                    <p className="text-xs text-white/35">Describe your meme character. AI generates the name, ticker, and image.</p>
                    <textarea
                      value={phantomDescribePrompt}
                      onChange={(e) => setPhantomDescribePrompt(e.target.value)}
                      placeholder="e.g., A lobster astronaut riding a rocket made of gold coins..."
                      maxLength={500}
                      className="w-full min-h-[90px] rounded-xl p-4 text-sm resize-none phantom-glass-textarea"
                    />
                    <button
                      onClick={handlePhantomDescribeGenerate}
                      disabled={isPhantomGenerating || !phantomDescribePrompt.trim()}
                      className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn"
                    >
                      {isPhantomGenerating ? <><Sparkles className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate from Description</>}
                    </button>

                    {isPhantomGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Realistic Sub-Mode */}
                {phantomSubMode === "realistic" && (
                  <>
                    <p className="text-xs text-white/35">Describe what you want. AI generates a realistic, real-life image.</p>
                    <textarea
                      value={phantomRealisticPrompt}
                      onChange={(e) => setPhantomRealisticPrompt(e.target.value)}
                      placeholder="e.g., A golden retriever wearing a tiny top hat in a park..."
                      maxLength={500}
                      className="w-full min-h-[90px] rounded-xl p-4 text-sm resize-none phantom-glass-textarea"
                    />
                    <button
                      onClick={handlePhantomRealisticGenerate}
                      disabled={isPhantomGenerating || !phantomRealisticPrompt.trim()}
                      className="w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer phantom-secondary-btn"
                    >
                      {isPhantomGenerating ? <><Camera className="h-4 w-4 animate-spin" /> Generating...</> : <><Camera className="h-4 w-4" /> Generate Realistic Image</>}
                    </button>

                    {isPhantomGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}


                {/* Token Preview & Form */}
                {!isPhantomGenerating && (phantomSubMode === "custom" || phantomMeme || phantomToken.name) && (
                  <>
                    {/* Premium Image Upload Area */}
                    <div className="phantom-image-upload-area">
                      {phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl ? (
                        <div className="relative w-full h-full group">
                          <img
                            src={phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl}
                            alt="Token"
                            className="w-full h-full object-cover rounded-xl"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
                            <label className="cursor-pointer text-white/80 text-xs font-medium flex items-center gap-1.5 hover:text-white transition-colors">
                              <Image className="h-4 w-4" />
                              Change
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhantomImageChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <button
                            onClick={() => {
                              setPhantomImageFile(null);
                              setPhantomImagePreview(null);
                              if (phantomMeme) {
                                setPhantomMeme({ ...phantomMeme, imageUrl: "" });
                              }
                              setPhantomToken({ ...phantomToken, imageUrl: "" });
                            }}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors z-10 shadow-lg"
                            title="Remove image"
                          >
                            <X className="h-3.5 w-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer group">
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors duration-200">
                            <Image className="h-5 w-5 text-white/25 group-hover:text-primary/60 transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] text-white/40 font-medium">Upload PNG/JPG/SVG</p>
                            <p className="text-[9px] text-white/20 mt-0.5">(max 5MB)</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhantomImageChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Token Name + Ticker */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-white/30" />
                        </div>
                        <Input
                          value={phantomToken.name}
                          onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 32) })}
                          className="phantom-glass-input h-10 rounded-xl flex-1"
                          placeholder="Token name"
                          maxLength={32}
                        />
                      </div>
                      <div className="flex items-center gap-3 pl-[52px]">
                        <span className="text-primary text-sm font-bold">$</span>
                        <Input
                          value={phantomToken.ticker}
                          onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                          className="phantom-glass-input h-9 w-32 font-mono rounded-lg"
                          placeholder="TICKER"
                          maxLength={10}
                        />
                        {(phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl) && (
                          <button
                            onClick={() => {
                              const imageUrl = phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl;
                              if (!imageUrl) return;
                              const a = document.createElement("a");
                              a.href = imageUrl;
                              a.download = `${(phantomToken.ticker || "token").toLowerCase()}.png`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <Download className="h-3 w-3" />
                            Download Generated img
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description with char counter */}
                    <div className="space-y-1">
                      <Textarea
                        value={phantomToken.description}
                        onChange={(e) => setPhantomToken({ ...phantomToken, description: e.target.value })}
                        placeholder="Description (optional)"
                        className="phantom-glass-textarea rounded-xl min-h-[80px]"
                        maxLength={500}
                      />
                      {phantomToken.description.length > 0 && (
                        <p className="text-right text-[9px] text-white/20 font-mono pr-1">
                          {phantomToken.description.length}/500
                        </p>
                      )}
                    </div>

                    {/* Social links - collapsible */}
                    <details className="group phantom-social-details">
                      <summary className="flex items-center gap-2 text-xs text-white/30 cursor-pointer transition-colors">
                        <Globe className="h-3 w-3" />
                        <span>Add Social Links (optional)</span>
                      </summary>
                      <div className="mt-3 space-y-2.5 pl-5">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-white/20 flex-shrink-0" />
                          <Input
                            placeholder="Website URL"
                            value={phantomToken.websiteUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, websiteUrl: e.target.value })}
                            className="phantom-glass-input text-sm rounded-lg"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Twitter className="h-4 w-4 text-white/20 flex-shrink-0" />
                          <Input
                            placeholder="X/Twitter URL"
                            value={phantomToken.twitterUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, twitterUrl: e.target.value })}
                            className="phantom-glass-input text-sm rounded-lg"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-white/20 flex-shrink-0" />
                          <Input
                            placeholder="Telegram URL"
                            value={phantomToken.telegramUrl || ""}
                            onChange={(e) => setPhantomToken({ ...phantomToken, telegramUrl: e.target.value })}
                            className="phantom-glass-input text-sm rounded-lg"
                          />
                        </div>
                      </div>
                    </details>

                    {/* Neon divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

                    {/* Launch Button */}
                    <button
                      onClick={() => handlePhantomLaunch()}
                      disabled={isPhantomLaunching || !phantomToken.name.trim() || !phantomToken.ticker.trim() || (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl) || (phantomWallet.balance !== null && phantomWallet.balance < 0.02)}
                      className="w-full h-13 rounded-xl text-sm tracking-wide flex items-center justify-center gap-2 cursor-pointer phantom-action-btn"
                    >
                      {isPhantomLaunching ? <><Rocket className="h-4 w-4 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4" /> Launch (~0.02 SOL)</>}
                    </button>

                    {phantomWallet.balance !== null && phantomWallet.balance < 0.02 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient balance. Need at least 0.02 SOL.
                      </p>
                    )}
                  </>
                )}
              </>
            ) : null}

            {/* Fee Structure Card */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            <div className="p-5 rounded-2xl phantom-fee-card">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Fee Structure</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-white/30">Launch Fee</span>
                  <span className="font-bold font-mono text-primary">~0.02 SOL</span>
                </div>
                <div className="h-px bg-white/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-white/30">Your Fee Share</span>
                  <span className="font-bold font-mono text-success">50%</span>
                </div>
                <div className="h-px bg-white/[0.04]" />
                <div className="flex justify-between items-center">
                  <span className="text-white/30">Trading Fee</span>
                  <span className="font-bold font-mono text-primary">{(phantomTradingFee / 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Holders Mode - Uses Phantom wallet with holders fee distribution */}
        {generatorMode === "holders" && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Holder Rewards Token</span>
              </div>
              <p className="text-xs text-muted-foreground">50% of trading fees are automatically distributed to all token holders proportionally.</p>
            </div>

            {/* Fee Distribution */}
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold">Fee Distribution</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Holder Share</span>
                  <span className="text-primary font-bold">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marketing</span>
                  <span className="text-muted-foreground">30%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform</span>
                  <span className="text-muted-foreground">20%</span>
                </div>
              </div>
            </div>

            {/* Wallet Connection First */}
            {!phantomWallet.isConnected ? (
              <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} className="gate-btn gate-btn-primary w-full">
                {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4 mr-2" /> Connect Phantom</>}
              </Button>
            ) : (
              <>
                {/* Connected Wallet Display */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-sm font-mono text-foreground">{phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}</span>
                    {phantomWallet.balance !== null && <span className="text-xs text-muted-foreground">{phantomWallet.balance.toFixed(3)} SOL</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={phantomWallet.disconnect} className="text-muted-foreground hover:text-foreground">
                    Disconnect
                  </Button>
                </div>

                {/* Sub-mode selector */}
                <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
                  {[
                    { id: "random" as const, label: "Random", icon: Shuffle },
                    { id: "describe" as const, label: "Describe", icon: Sparkles },
                    { id: "custom" as const, label: "Custom", icon: Pencil },
                  ].map((subMode) => (
                    <button
                      key={subMode.id}
                      onClick={() => setHoldersSubMode(subMode.id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs rounded-md transition-all ${
                        holdersSubMode === subMode.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      <subMode.icon className="h-3 w-3" />
                      {subMode.label}
                    </button>
                  ))}
                </div>

                {/* Random Sub-Mode */}
                {holdersSubMode === "random" && (
                  <>
                    <Button onClick={handleHoldersRandomize} disabled={isHoldersGenerating} className="gate-btn gate-btn-secondary w-full">
                      {isHoldersGenerating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> AI Randomize</>}
                    </Button>

                    {isHoldersGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Describe Sub-Mode */}
                {holdersSubMode === "describe" && (
                  <>
                    <Textarea
                      value={holdersDescribePrompt}
                      onChange={(e) => setHoldersDescribePrompt(e.target.value)}
                      placeholder="e.g., A smug frog wearing sunglasses..."
                      className="gate-input gate-textarea"
                      maxLength={500}
                    />
                    <Button onClick={handleHoldersDescribeGenerate} disabled={isHoldersGenerating || !holdersDescribePrompt.trim()} className="gate-btn gate-btn-secondary w-full">
                      {isHoldersGenerating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate from Description</>}
                    </Button>

                    {isHoldersGenerating && (
                      <div className="gate-token-preview">
                        <div className="gate-token-preview-avatar">
                          <MemeLoadingAnimation />
                        </div>
                        <div className="gate-token-preview-info">
                          <MemeLoadingText />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Token Preview & Form (shown for all sub-modes after generation or for custom) */}
                {!isHoldersGenerating && (holdersSubMode === "custom" || holdersMeme || holdersToken.name) && (
                  <>
                    <div className="gate-token-preview">
                      <div className="gate-token-preview-avatar">
                        {holdersImagePreview || holdersMeme?.imageUrl || holdersToken.imageUrl ? (
                          <ImagePreviewOverlay
                            src={holdersImagePreview || holdersMeme?.imageUrl || holdersToken.imageUrl}
                            alt="Token"
                            downloadName={`${holdersToken.ticker || holdersToken.name || "token"}.png`}
                            onClear={() => { setHoldersImagePreview(null); setHoldersMeme(null); }}
                          />
                        ) : (
                          <Bot className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="gate-token-preview-info space-y-2">
                        <Input
                          value={holdersToken.name}
                          onChange={(e) => setHoldersToken({ ...holdersToken, name: e.target.value.slice(0, 32) })}
                          className="gate-input h-8"
                          placeholder="Token name"
                          maxLength={32}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-primary text-sm">$</span>
                          <Input
                            value={holdersToken.ticker}
                            onChange={(e) => setHoldersToken({ ...holdersToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                            className="gate-input h-7 w-28 font-mono"
                            placeholder="TICKER"
                            maxLength={10}
                          />
                          {(holdersImagePreview || holdersMeme?.imageUrl || holdersToken.imageUrl) && (
                            <button
                              onClick={() => {
                                const imageUrl = holdersImagePreview || holdersMeme?.imageUrl || holdersToken.imageUrl;
                                if (!imageUrl) return;
                                const a = document.createElement("a");
                                a.href = imageUrl;
                                a.download = `${(holdersToken.ticker || "token").toLowerCase()}.png`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="ml-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Download className="h-3 w-3" />
                              Download Generated img
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={holdersToken.description}
                      onChange={(e) => setHoldersToken({ ...holdersToken, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="gate-input gate-textarea"
                      maxLength={500}
                    />

                    {/* Social links - collapsible */}
                    <details className="group">
                      <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <Globe className="h-3 w-3" />
                        <span>Add Social Links (optional)</span>
                      </summary>
                      <div className="mt-2 space-y-2 pl-5">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Website URL"
                            value={holdersToken.websiteUrl || ""}
                            onChange={(e) => setHoldersToken({ ...holdersToken, websiteUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Twitter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="X/Twitter URL"
                            value={holdersToken.twitterUrl || ""}
                            onChange={(e) => setHoldersToken({ ...holdersToken, twitterUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Telegram URL"
                            value={holdersToken.telegramUrl || ""}
                            onChange={(e) => setHoldersToken({ ...holdersToken, telegramUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Input
                            placeholder="Discord URL"
                            value={holdersToken.discordUrl || ""}
                            onChange={(e) => setHoldersToken({ ...holdersToken, discordUrl: e.target.value })}
                            className="gate-input text-sm"
                          />
                        </div>
                      </div>
                    </details>

                    <Input type="file" accept="image/*" onChange={handleHoldersImageChange} className="gate-input text-xs" />

                    <Button
                      onClick={handleHoldersLaunch}
                      disabled={isPhantomLaunching || !holdersToken.name.trim() || !holdersToken.ticker.trim() || (!holdersImagePreview && !holdersMeme?.imageUrl && !holdersToken.imageUrl) || (phantomWallet.balance !== null && phantomWallet.balance < 0.02)}
                      className="gate-btn gate-btn-primary w-full"
                    >
                      {isPhantomLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Users className="h-4 w-4 mr-2" /> Launch Holder Rewards Token (~0.02 SOL)</>}
                    </Button>

                    {phantomWallet.balance !== null && phantomWallet.balance < 0.02 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient balance. Need at least 0.02 SOL.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* FUN Mode — Prank Your Friends 🎉 */}
        {generatorMode === "fun" && (
          <div className="space-y-4">
            {!funModeUnlocked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  <span>Enter admin password to unlock FUN mode</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Password..."
                    value={funPasswordInput}
                    onChange={(e) => setFunPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFunPasswordSubmit()}
                    className="gate-input"
                  />
                  <Button onClick={handleFunPasswordSubmit} className="gate-btn gate-btn-primary">
                    Unlock
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Fun Header */}
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2 mb-1">
                    <PartyPopper className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold text-foreground">FUN Mode — Prank Your Friends 🎉</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Surprise a friend by sending them <strong>$1,000,000 worth of tokens</strong> (wink wink). 
                    Pick a preset below and launch!
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    This is FUN mode — not financial advice, just vibes. LP is not locked so you can pull it back anytime.
                  </p>
                </div>

                {/* Preset Cards */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Quick Presets — click to auto-fill:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FUN_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handleFunPresetClick(preset)}
                        className="p-2 rounded-lg border border-border bg-secondary/50 hover:bg-primary/10 hover:border-primary/30 transition-all text-center"
                      >
                        <div className="text-lg">{preset.emoji}</div>
                        <div className="text-xs font-bold text-foreground">{preset.label.replace(preset.emoji + ' ', '')}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{preset.desc.split('→')[1]?.trim()}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    <strong>How it works:</strong> You put tiny SOL in pool with few tokens. Pool price = SOL ÷ tokens. 
                    Phantom multiplies that price by your friend's holdings. Boom — instant millionaire (on paper). 🤫
                  </p>
                </div>

                {/* Wallet Connection */}
                {!phantomWallet.isConnected ? (
                  <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} className="gate-btn gate-btn-primary w-full">
                    {phantomWallet.isConnecting ? "Connecting..." : <><Wallet className="h-4 w-4 mr-2" /> Connect Phantom</>}
                  </Button>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" />
                        <span className="text-sm font-mono text-foreground">{phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}</span>
                        {phantomWallet.balance !== null && <span className="text-xs text-muted-foreground">{phantomWallet.balance.toFixed(3)} SOL</span>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={phantomWallet.disconnect} className="text-muted-foreground hover:text-foreground">
                        Disconnect
                      </Button>
                    </div>

                    {/* Token Info */}
                    <div className="gate-token-preview">
                      <div className="gate-token-preview-avatar">
                        {funImagePreview || funToken.imageUrl ? (
                          <ImagePreviewOverlay
                            src={funImagePreview || funToken.imageUrl}
                            alt="Token"
                            downloadName={`${funToken.ticker || funToken.name || "token"}.png`}
                            onClear={() => { setFunImagePreview(null); setFunToken({ ...funToken, imageUrl: "" }); }}
                          />
                        ) : (
                          <PartyPopper className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="gate-token-preview-info space-y-2">
                        <Input
                          value={funToken.name}
                          onChange={(e) => setFunToken({ ...funToken, name: e.target.value.slice(0, 32) })}
                          className="gate-input h-8"
                          placeholder="Token name"
                          maxLength={32}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-primary text-sm">$</span>
                          <Input
                            value={funToken.ticker}
                            onChange={(e) => setFunToken({ ...funToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })}
                            className="gate-input h-7 w-28 font-mono"
                            placeholder="TICKER"
                            maxLength={10}
                          />
                          {(funImagePreview || funToken.imageUrl) && (
                            <button
                              onClick={() => {
                                const imageUrl = funImagePreview || funToken.imageUrl;
                                if (!imageUrl) return;
                                const a = document.createElement("a");
                                a.href = imageUrl;
                                a.download = `${(funToken.ticker || "token").toLowerCase()}.png`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }}
                              className="ml-1 px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
                            >
                              <Download className="h-3 w-3" />
                              Download Generated img
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={funToken.description}
                      onChange={(e) => setFunToken({ ...funToken, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="gate-input gate-textarea"
                      maxLength={500}
                    />

                    <Input type="file" accept="image/*" onChange={handleFunImageChange} className="gate-input text-xs" />

                    {/* Pool Configuration */}
                    <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                      <h4 className="text-xs font-semibold text-foreground">Pool Configuration</h4>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Total Supply</Label>
                        <Input
                          type="number"
                          value={funTotalSupply}
                          onChange={(e) => setFunTotalSupply(Math.max(1000, Number(e.target.value) || 1_000_000_000))}
                          className="gate-input text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">LP SOL</Label>
                          <span className="text-xs font-semibold text-primary">{funLpSol} SOL</span>
                        </div>
                        <Slider
                          value={[funLpSol * 100]}
                          onValueChange={(v) => setFunLpSol(v[0] / 100)}
                          min={1}
                          max={500}
                          step={1}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>0.01 SOL</span>
                          <span>5 SOL</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Tokens in Pool</Label>
                        <Input
                          type="number"
                          value={funLpTokens}
                          onChange={(e) => setFunLpTokens(Math.max(1, Math.min(funTotalSupply, Number(e.target.value) || 10_000_000)))}
                          className="gate-input text-sm"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Remaining {(funTotalSupply - funLpTokens).toLocaleString()} tokens go to your wallet
                        </p>
                      </div>
                    </div>

                    {/* What your friend will see in Phantom */}
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold">What your friend will see in Phantom 👀</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price per token</span>
                          <span className="text-primary font-mono">{funImpliedPrice.toExponential(4)} SOL</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Implied Market Cap</span>
                          <span className="text-primary font-semibold">{funImpliedMarketCapSol.toFixed(2)} SOL</span>
                        </div>
                        {funImpliedMarketCapUsd !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Implied Market Cap (USD)</span>
                            <span className="text-primary font-bold">${funImpliedMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-border pt-1 mt-1">
                          <span className="text-muted-foreground">🤯 Your friend's reaction</span>
                          <span className="text-primary font-bold">
                            {funImpliedMarketCapUsd !== null
                              ? `~$${((funTotalSupply - funLpTokens) * funImpliedPrice * (solPrice || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : `${((funTotalSupply - funLpTokens) * funImpliedPrice).toFixed(2)} SOL`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">LP Locked</span>
                          <span className="text-warning font-semibold">❌ No</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trading Fees</span>
                          <span className="text-primary font-semibold">0%</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground text-center italic">
                      💡 Pro tip: Send the tokens to your friend's wallet after launch. They'll open Phantom and see $$$ — priceless.
                    </p>

                    <Button
                      onClick={handleFunLaunch}
                      disabled={isFunLaunching || !funToken.name.trim() || !funToken.ticker.trim() || (!funImagePreview && !funToken.imageUrl) || (phantomWallet.balance !== null && phantomWallet.balance < funLpSol + 0.02)}
                      className="gate-btn gate-btn-primary w-full"
                    >
                      {isFunLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><PartyPopper className="h-4 w-4 mr-2" /> Launch FUN Token (~{(funLpSol + 0.02).toFixed(2)} SOL)</>}
                    </Button>

                    {phantomWallet.balance !== null && phantomWallet.balance < funLpSol + 0.02 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Insufficient balance. Need at least {(funLpSol + 0.02).toFixed(2)} SOL.
                      </p>
                    )}

                    {/* Remove LP Section */}
                    <details className="group mt-2">
                      <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <RefreshCw className="h-3 w-3" />
                        <span>Already launched? Remove your LP & get SOL back</span>
                      </summary>
                      <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                        <p className="text-[10px] text-muted-foreground">
                          Paste the pool address from your FUN launch to remove all liquidity and get your SOL back.
                          ⚠️ This makes the token untradeable.
                        </p>
                        <Input
                          placeholder="Pool address..."
                          value={funRemovePoolAddress}
                          onChange={(e) => setFunRemovePoolAddress(e.target.value)}
                          className="gate-input font-mono text-sm"
                        />
                        <Button
                          onClick={handleRemoveFunLp}
                          disabled={isRemovingFunLp || !funRemovePoolAddress.trim()}
                          variant="outline"
                          className="w-full"
                        >
                          {isRemovingFunLp 
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing LP...</>
                            : <><RefreshCw className="h-4 w-4 mr-2" /> Remove LP & Get SOL Back</>
                          }
                        </Button>
                      </div>
                    </details>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
  );

  if (bare) {
    return innerContent;
  }

  return (
    <Card className="gate-card">
      <div className="gate-card-header flex items-center justify-between">
        <h3 className="gate-card-title">
          <Rocket className="h-5 w-5 text-primary" />
          Launch Meme Coin
        </h3>
        <Link to="/agents">
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs font-bold gap-1"
          >
            <Bot className="h-3.5 w-3.5" />
            Launch Agent
          </Button>
        </Link>
      </div>
      {innerContent}
    </Card>
  );
}
