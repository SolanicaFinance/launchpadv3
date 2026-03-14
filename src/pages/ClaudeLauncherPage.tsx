import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFunTokens } from "@/hooks/useFunTokens";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useFunFeeClaims, useFunFeeClaimsSummary, useFunDistributions, useFunBuybacks } from "@/hooks/useFunFeeData";
import { useFunTopPerformers } from "@/hooks/useFunTopPerformers";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { MemeLoadingAnimation, MemeLoadingText } from "@/components/launchpad/MemeLoadingAnimation";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { SniperStatusPanel } from "@/components/admin/SniperStatusPanel";
import { 
  Shuffle, 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Clock,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle,
  Coins,
  ArrowDownCircle,
  Wallet,
  AlertTriangle,
  PartyPopper,
  Bot,
  Image,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trophy,
  Link as LinkIcon,
  Repeat2,
  Menu,
  Scale,
  Key,
  Pencil,
  Globe,
  Twitter,
  MessageCircle,
  MessageSquare
} from "lucide-react";
import { useBannerGenerator } from "@/hooks/useBannerGenerator";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { usePhantomWallet } from "@/hooks/usePhantomWallet";
import { VersionedTransaction, Transaction, Keypair, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import "@/styles/gate-theme.css";

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
  onChainSuccess?: boolean;
  solscanUrl?: string;
  tradeUrl?: string;
  message?: string;
  error?: string;
}

type MainTab = "tokens" | "top" | "claimed" | "buybacks" | "creators";

export default function ClaudeLauncherPage() {
  const { toast } = useToast();
  const { solPrice } = useSolPrice();
  const isMobile = useIsMobile();
  const { tokens, isLoading: tokensLoading, lastUpdate, refetch } = useFunTokens();

  // Idempotency key to prevent duplicate launches - regenerated on successful launch
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Main tabs
  const [activeTab, setActiveTab] = useState<MainTab>("tokens");
  
  // Pagination
  const [tokensPage, setTokensPage] = useState(1);
  const [claimedPage, setClaimedPage] = useState(1);
  const pageSize = 15;

  // Data hooks
  const { data: feeClaimsData, isLoading: claimsLoading } = useFunFeeClaims({ page: claimedPage, pageSize });
  const { data: summary } = useFunFeeClaimsSummary();
  const { data: distributions = [] } = useFunDistributions();
  const { data: buybacks = [], isLoading: buybacksLoading } = useFunBuybacks();
  const { data: topPerformers = [], isLoading: topPerformersLoading } = useFunTopPerformers(10);

  // Generator state
  const [generatorMode, setGeneratorMode] = useState<"random" | "custom" | "describe" | "phantom">("random");
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
  const [customImageFile, setCustomImageFile] = useState<File | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Banner state
  const [bannerTextName, setBannerTextName] = useState("");
  const [bannerTextTicker, setBannerTextTicker] = useState("");
  const [isEditingBannerText, setIsEditingBannerText] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  
  const { isAdmin } = useIsAdmin(walletAddress || null);
  
  // Phantom wallet
  const phantomWallet = usePhantomWallet();
  const [isPhantomLaunching, setIsPhantomLaunching] = useState(false);
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
  const [phantomInputMode, setPhantomInputMode] = useState<"random" | "describe" | "custom">("random");
  const [phantomTradingFee, setPhantomTradingFee] = useState(100); // 100 bps = 1% creator fee default
  
  const { 
    generateBanner, 
    downloadBanner, 
    clearBanner, 
    isGenerating: isBannerGenerating, 
    bannerUrl 
  } = useBannerGenerator();

  // Computed stats
  const totalCreatorPaid = useMemo(() => 
    distributions.filter(d => d.status === 'completed').reduce((sum, d) => sum + d.amount_sol, 0), 
    [distributions]
  );
  const totalBuybacks = useMemo(() => 
    buybacks.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.amount_sol, 0), 
    [buybacks]
  );

  // Creators data
  const creatorsData = useMemo(() => {
    const creatorMap = new Map<string, { wallet: string; tokens: number; totalEarned: number }>();
    
    tokens.forEach(token => {
      const existing = creatorMap.get(token.creator_wallet) || { 
        wallet: token.creator_wallet, 
        tokens: 0, 
        totalEarned: 0 
      };
      existing.tokens++;
      creatorMap.set(token.creator_wallet, existing);
    });
    
    distributions.filter(d => d.status === 'completed').forEach(dist => {
      const existing = creatorMap.get(dist.creator_wallet);
      if (existing) {
        existing.totalEarned += dist.amount_sol;
      }
    });
    
    return Array.from(creatorMap.values()).sort((a, b) => b.totalEarned - a.totalEarned);
  }, [tokens, distributions]);

  // Helpers
  const isValidSolanaAddress = (address: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const formatSOL = (amount: number) => {
    if (!Number.isFinite(amount)) return "0";
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    if (amount >= 1) return amount.toFixed(2);
    if (amount > 0 && amount < 0.000001) return amount.toExponential(2);
    if (amount > 0 && amount < 0.01) return amount.toFixed(8);
    return amount.toFixed(6);
  };

  const formatUsd = (sol: number) => {
    if (!solPrice) return `${formatSOL(sol)} SOL`;
    const usd = sol * solPrice;
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
    return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generator handlers
  const handleRandomize = useCallback(async () => {
    setIsGenerating(true);
    setMeme(null);
    clearBanner();
    
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generation failed");

      if (data?.meme) {
        setMeme(data.meme);
        setBannerTextName(data.meme.name);
        setBannerTextTicker(data.meme.ticker);
        setBannerImageUrl(data.meme.imageUrl);
        toast({ title: "Token Generated! 🎲", description: `${data.meme.name} ($${data.meme.ticker}) is ready!` });
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Failed to generate", variant: "destructive" });
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

  const performLaunch = useCallback(async (tokenToLaunch: MemeToken) => {
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      toast({ title: "Invalid wallet", description: "Enter a valid Solana address", variant: "destructive" });
      return;
    }

    setIsLaunching(true);
    try {
      toast({ title: "🔄 Creating Token...", description: "This may take up to 60 seconds..." });

      const { data, error } = await supabase.functions.invoke("fun-create", {
        body: {
          name: tokenToLaunch.name,
          ticker: tokenToLaunch.ticker,
          description: tokenToLaunch.description,
          imageUrl: tokenToLaunch.imageUrl,
          websiteUrl: tokenToLaunch.websiteUrl,
          twitterUrl: tokenToLaunch.twitterUrl,
          telegramUrl: tokenToLaunch.telegramUrl,
          discordUrl: tokenToLaunch.discordUrl,
          creatorWallet: walletAddress,
          idempotencyKey, // Prevent duplicate launches
        },
      });

      if (error) throw new Error(error.message || error.toString());
      
      // Handle in-progress response (duplicate request while still processing)
      if (!data?.success && data?.inProgress) {
        toast({ 
          title: "Launch In Progress", 
          description: "This token is already being created. Please wait.",
        });
        return;
      }
      
      if (!data?.success) throw new Error(data?.error || "Launch failed");

      // Direct response - no polling needed!
      setLaunchResult({
        success: true,
        name: tokenToLaunch.name,
        ticker: tokenToLaunch.ticker,
        mintAddress: data.mintAddress,
        imageUrl: tokenToLaunch.imageUrl,
        onChainSuccess: true,
        solscanUrl: data.solscanUrl,
        tradeUrl: data.tradeUrl,
        message: "🚀 Token launched!",
      });

      setShowResultModal(true);
      toast({ title: "🚀 Token Launched!", description: `${tokenToLaunch.name} is now live!` });
      setMeme(null);
      clearBanner();
      setCustomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setCustomImageFile(null);
      setCustomImagePreview(null);
      setWalletAddress("");
      setIdempotencyKey(crypto.randomUUID()); // New key for next launch attempt
      refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to launch";
      setLaunchResult({ success: false, error: msg });
      setShowResultModal(true);
      toast({ title: "Launch Failed", description: msg.slice(0, 100), variant: "destructive" });
    } finally {
      setIsLaunching(false);
    }
  }, [walletAddress, toast, clearBanner, refetch]);

  const handleLaunch = useCallback(async () => {
    if (!meme) {
      toast({ title: "No token", description: "Generate a token first", variant: "destructive" });
      return;
    }
    await performLaunch(meme);
  }, [meme, performLaunch, toast]);

  const handleCustomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handleCustomLaunch = useCallback(async () => {
    if (!customToken.name.trim() || !customToken.ticker.trim()) {
      toast({ title: "Missing info", description: "Name and ticker required", variant: "destructive" });
      return;
    }
    if (!customImageFile && !customToken.imageUrl.trim()) {
      toast({ title: "Image required", variant: "destructive" });
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
      toast({ title: 'Failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  }, [customToken, performLaunch, toast, uploadCustomImageIfNeeded]);

  const handleDescribeGenerate = useCallback(async () => {
    if (!describePrompt.trim()) {
      toast({ title: "Enter description", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setDescribedToken(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: describePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setDescribedToken(data.meme);
        setBannerTextName(data.meme.name);
        setBannerTextTicker(data.meme.ticker);
        setBannerImageUrl(data.meme.imageUrl);
        if (data.meme.imageUrl) {
          await generateBanner({ imageUrl: data.meme.imageUrl, tokenName: data.meme.name, ticker: data.meme.ticker });
        }
        toast({ title: "Token Generated! 🎨", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [describePrompt, toast, clearBanner, generateBanner]);

  const handleDescribeLaunch = useCallback(async () => {
    if (!describedToken) {
      toast({ title: "Generate first", variant: "destructive" });
      return;
    }
    await performLaunch(describedToken);
  }, [describedToken, performLaunch, toast]);

  // Phantom handlers
  const uploadPhantomImageIfNeeded = useCallback(async (): Promise<string> => {
    if (!phantomImageFile) return phantomToken.imageUrl || phantomMeme?.imageUrl || "";
    const fileExt = phantomImageFile.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `token-images/${fileName}`;
    const { error } = await supabase.storage.from('post-images').upload(filePath, phantomImageFile);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [phantomImageFile, phantomToken.imageUrl, phantomMeme?.imageUrl]);

  const handlePhantomRandomize = useCallback(async () => {
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: {} });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: data.meme.name || "",
          ticker: data.meme.ticker || "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl || "",
          websiteUrl: data.meme.websiteUrl || "",
          twitterUrl: data.meme.twitterUrl || "",
          telegramUrl: data.meme.telegramUrl || "",
          discordUrl: data.meme.discordUrl || "",
        });
        toast({ title: "Token Generated! 🎲", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [toast, clearBanner]);

  const handlePhantomDescribeGenerate = useCallback(async () => {
    if (!phantomDescribePrompt.trim()) {
      toast({ title: "Enter description", variant: "destructive" });
      return;
    }
    setIsPhantomGenerating(true);
    setPhantomMeme(null);
    clearBanner();
    try {
      const { data, error } = await supabase.functions.invoke("fun-generate", { body: { description: phantomDescribePrompt } });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);
      if (data?.meme) {
        setPhantomMeme(data.meme);
        setPhantomToken({
          name: data.meme.name || "",
          ticker: data.meme.ticker || "",
          description: data.meme.description || "",
          imageUrl: data.meme.imageUrl || "",
          websiteUrl: data.meme.websiteUrl || "",
          twitterUrl: data.meme.twitterUrl || "",
          telegramUrl: data.meme.telegramUrl || "",
          discordUrl: data.meme.discordUrl || "",
        });
        toast({ title: "Generated! 🎨", description: `${data.meme.name} ($${data.meme.ticker})` });
      }
    } catch (error) {
      toast({ title: "Failed", description: error instanceof Error ? error.message : "Error", variant: "destructive" });
    } finally {
      setIsPhantomGenerating(false);
    }
  }, [phantomDescribePrompt, toast, clearBanner]);

  const handlePhantomImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setPhantomImageFile(file);
    setPhantomImagePreview(URL.createObjectURL(file));
  }, [toast]);

  const handlePhantomLaunch = useCallback(async () => {
    if (!phantomWallet.isConnected || !phantomWallet.address) {
      toast({ title: "Connect Phantom", variant: "destructive" });
      return;
    }

    let tokenData: MemeToken;
    if (phantomInputMode === "custom") {
      if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
        toast({ title: "Missing info", variant: "destructive" });
        return;
      }
      if (!phantomImageFile && !phantomToken.imageUrl) {
        toast({ title: "Image required", variant: "destructive" });
        return;
      }
      try {
        const imageUrl = await uploadPhantomImageIfNeeded();
        tokenData = { ...phantomToken, imageUrl, name: phantomToken.name.slice(0, 20), ticker: phantomToken.ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 10) };
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
        return;
      }
    } else {
      // Random or Describe mode - use generated token or form data
      if (!phantomToken.name.trim() || !phantomToken.ticker.trim()) {
        toast({ title: "Generate a token first", variant: "destructive" });
        return;
      }
      const imageUrl = phantomImageFile ? await uploadPhantomImageIfNeeded() : (phantomMeme?.imageUrl || phantomToken.imageUrl);
      if (!imageUrl) {
        toast({ title: "Image required", variant: "destructive" });
        return;
      }
      tokenData = { ...phantomToken, imageUrl };
    }

    setIsPhantomLaunching(true);
    try {
      // Phase 1: Prepare unsigned transactions
      const { data, error } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          name: tokenData.name,
          ticker: tokenData.ticker,
          description: tokenData.description,
          imageUrl: tokenData.imageUrl,
          websiteUrl: tokenData.websiteUrl,
          twitterUrl: tokenData.twitterUrl,
          telegramUrl: tokenData.telegramUrl,
          discordUrl: tokenData.discordUrl,
          phantomWallet: phantomWallet.address,
          tradingFeeBps: phantomTradingFee + 100, // creator fee + 1% platform base
          creatorFeeBps: phantomTradingFee, // creator portion only
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to prepare");

      const { unsignedTransactions, mintAddress, dbcPoolAddress, imageUrl: storedImageUrl } = data;
      
      if (!unsignedTransactions || unsignedTransactions.length < 2) {
        throw new Error("Invalid transaction data received");
      }

      const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

      // Reconstruct ephemeral keypairs for post-Phantom signing
      const ephemeralKeypairs: Map<string, Keypair> = new Map();
      if (data?.ephemeralKeypairs) {
        for (const [pubkey, secretKeyB58] of Object.entries(data.ephemeralKeypairs)) {
          const kp = Keypair.fromSecretKey(bs58.decode(secretKeyB58 as string));
          ephemeralKeypairs.set(pubkey, kp);
        }
      }
      const txRequiredKeypairs: string[][] = data?.txRequiredKeypairs || [];

      const txIsVersioned: boolean[] = data?.txIsVersioned || [];

      // Phantom-first signing flow for Lighthouse compatibility
      for (let i = 0; i < unsignedTransactions.length; i++) {
        const txName = i === 0 ? "Config" : "Pool";
        toast({ title: `Sign ${txName} Transaction (${i + 1}/${unsignedTransactions.length})`, description: "Approve in Phantom..." });
        
        // Deserialize using server hint for type
        const bytes = Uint8Array.from(atob(unsignedTransactions[i]), (c: string) => c.charCodeAt(0));
        let tx: Transaction | VersionedTransaction;
        if (txIsVersioned[i]) {
          tx = VersionedTransaction.deserialize(bytes);
        } else {
          try {
            tx = VersionedTransaction.deserialize(bytes);
          } catch {
            tx = Transaction.from(bytes);
          }
        }

        // Apply ephemeral keypair signatures BEFORE wallet signs and sends
        const neededPubkeys = txRequiredKeypairs[i] || [];
        const localSigners = neededPubkeys
          .map(pk => ephemeralKeypairs.get(pk))
          .filter((kp): kp is Keypair => !!kp);

        if (localSigners.length > 0) {
          if (tx instanceof Transaction) {
            tx.partialSign(...localSigners);
          } else {
            tx.sign(localSigners);
          }
        }

        const connection = new Connection(rpcUrl, 'confirmed');

        // Phantom handles simulation, signing, and sending
        toast({ title: `Action required in Phantom`, description: `Approve ${txName}` });
        const signature = await phantomWallet.signAndSendTransaction(tx as any);
        if (!signature) throw new Error(`${txName} was cancelled or failed`);

        // Wait for confirmation
        toast({ title: `Confirming ${txName}...`, description: "Waiting for network..." });
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (i < unsignedTransactions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Phase 2: Record in DB AFTER successful on-chain transactions
      const { data: recordData, error: recordError } = await supabase.functions.invoke("fun-phantom-create", {
        body: {
          confirmed: true,
          mintAddress,
          dbcPoolAddress,
          name: tokenData.name,
          ticker: tokenData.ticker,
          description: tokenData.description,
          imageUrl: storedImageUrl || tokenData.imageUrl,
          websiteUrl: tokenData.websiteUrl?.trim() || undefined,
          twitterUrl: tokenData.twitterUrl?.trim() || undefined,
          telegramUrl: tokenData.telegramUrl?.trim() || undefined,
          discordUrl: tokenData.discordUrl?.trim() || undefined,
          phantomWallet: phantomWallet.address,
        },
      });
      
      if (recordError || !recordData?.success) {
        console.error("Phase 2 recording failed:", recordError || recordData?.error);
        toast({ title: "Warning", description: "Token launched but database recording failed.", variant: "destructive" });
      }

      setLaunchResult({
        success: true,
        name: tokenData.name,
        ticker: tokenData.ticker,
        mintAddress,
        imageUrl: tokenData.imageUrl,
        onChainSuccess: true,
        solscanUrl: `https://solscan.io/token/${mintAddress}`,
        tradeUrl: mintAddress ? `/trade/${mintAddress}` : undefined,
        message: "Token launched with your Phantom wallet!",
      });
      setShowResultModal(true);
      toast({ title: "🚀 Token Launched!", description: `${tokenData.name} is live!` });
      setPhantomMeme(null);
      setPhantomToken({ name: "", ticker: "", description: "", imageUrl: "", websiteUrl: "", twitterUrl: "", telegramUrl: "", discordUrl: "" });
      setPhantomImageFile(null);
      setPhantomImagePreview(null);
      phantomWallet.refreshBalance();
      refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Launch failed";
      toast({ title: "Failed", description: msg.slice(0, 100), variant: "destructive" });
    } finally {
      setIsPhantomLaunching(false);
    }
  }, [phantomWallet, phantomInputMode, phantomToken, phantomMeme, phantomImageFile, phantomTradingFee, uploadPhantomImageIfNeeded, toast, refetch]);

  // Tab content renderers
  const renderTokensTab = () => {
    const paginatedTokens = tokens.slice((tokensPage - 1) * pageSize, tokensPage * pageSize);
    const totalPages = Math.ceil(tokens.length / pageSize);

    return (
      <div className="gate-card">
        <div className="gate-card-header">
          <div className="gate-card-title"><BarChart3 className="h-5 w-5 text-primary" /> Live Tokens</div>
          <span className="text-sm text-muted-foreground">{tokens.length} total</span>
        </div>
        
        <div className="gate-table-wrapper">
          <table className="gate-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Token</th>
                <th className="text-right">Market Cap</th>
                <th className="text-center" style={{ width: 100 }}>Progress</th>
                <th className="text-right" style={{ width: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tokensLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-4 w-6" /></td>
                    <td><Skeleton className="h-10 w-32" /></td>
                    <td><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td><Skeleton className="h-2 w-full" /></td>
                    <td><Skeleton className="h-8 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedTokens.length === 0 ? (
                <tr><td colSpan={5} className="gate-empty">No tokens yet. Be the first!</td></tr>
              ) : (
                paginatedTokens.map((token, idx) => (
                  <tr key={token.id}>
                    <td className="text-muted-foreground">{(tokensPage - 1) * pageSize + idx + 1}</td>
                    <td>
                      <div className="gate-token-row">
                        <div className="gate-token-avatar">
                          {token.image_url ? <img src={token.image_url} alt={token.name} /> : <span className="text-xs font-bold text-muted-foreground">{token.ticker?.slice(0, 2)}</span>}
                        </div>
                        <div className="gate-token-info">
                          <div className="flex items-center gap-2">
                            <span className="gate-token-name">{token.name}</span>
                            <button onClick={() => copyToClipboard(token.mint_address!)} className="gate-copy-btn">
                              {copiedAddress === token.mint_address ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-primary font-mono">${token.ticker}</span>
                            <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />{token.holder_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="font-semibold">{formatUsd(token.market_cap_sol || 0)}</div>
                      <div className="text-xs text-muted-foreground">{formatSOL(token.market_cap_sol || 0)} SOL</div>
                    </td>
                    <td>
                      <div className="gate-progress">
                        <div className="gate-progress-bar" style={{ width: `${token.bonding_progress || 0}%` }} />
                      </div>
                      <div className="text-xs text-center text-muted-foreground mt-1">{(token.bonding_progress || 0).toFixed(1)}%</div>
                    </td>
                    <td className="text-right">
                      <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer" className="gate-link">
                        Trade <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="gate-pagination">
            <span className="gate-pagination-info">{(tokensPage - 1) * pageSize + 1}–{Math.min(tokensPage * pageSize, tokens.length)} of {tokens.length}</span>
            <div className="gate-pagination-buttons">
              <button className="gate-page-btn" disabled={tokensPage === 1} onClick={() => setTokensPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button className="gate-page-btn" disabled={tokensPage >= totalPages} onClick={() => setTokensPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTopTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Trophy /></div>
        <span className="claude-section-title">Top Performers</span>
      </div>
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Token</th>
              <th className="text-right">Market Cap</th>
              <th className="text-right">24h Volume</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {topPerformersLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><Skeleton className="h-10 w-full bg-[hsl(220,12%,18%)]" /></td></tr>
              ))
            ) : topPerformers.length === 0 ? (
              <tr><td colSpan={5} className="claude-empty">No performers yet</td></tr>
            ) : (
              topPerformers.map((token: any, idx: number) => (
                <tr key={token.id}>
                  <td className="text-[hsl(220,10%,45%)]">{idx + 1}</td>
                  <td>
                    <div className="claude-token-cell">
                      <div className="claude-avatar">{token.image_url ? <img src={token.image_url} alt={token.name} /> : <span className="text-xs font-bold">{token.ticker?.slice(0, 2)}</span>}</div>
                      <div><span className="font-medium">{token.name}</span><div className="text-xs text-[hsl(160,70%,50%)] font-mono">${token.ticker}</div></div>
                    </div>
                  </td>
                  <td className="text-right font-semibold">{formatUsd(token.market_cap_sol || 0)}</td>
                  <td className="text-right text-[hsl(160,70%,50%)]">{formatSOL(token.volume_24h_sol || 0)} SOL</td>
                  <td className="text-right">
                    <a href={`https://axiom.trade/meme/${token.dbc_pool_address || token.mint_address}?chain=sol`} target="_blank" rel="noopener noreferrer" className="claude-link">Trade <ExternalLink className="h-3.5 w-3.5" /></a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderClaimedTab = () => {
    const claims = feeClaimsData?.items || [];
    const totalClaims = feeClaimsData?.count || 0;
    const totalPages = Math.ceil(totalClaims / pageSize);

    return (
      <div className="claude-card">
        <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
          <div className="claude-section-icon"><LinkIcon /></div>
          <span className="claude-section-title">Claimed Fees</span>
          <div className="ml-auto claude-total-badge">Total: <strong>{formatSOL(summary?.totalClaimedSol || 0)} SOL</strong></div>
        </div>
        <div className="claude-table-wrapper">
          <table className="claude-table">
            <thead>
              <tr><th>Token</th><th>Creator</th><th className="text-right">Amount</th><th className="text-right">Time</th><th className="text-right">TX</th></tr>
            </thead>
            <tbody>
              {claimsLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5}><Skeleton className="h-10 w-full bg-[hsl(220,12%,18%)]" /></td></tr>)
              ) : claims.length === 0 ? (
                <tr><td colSpan={5} className="claude-empty">No claims yet</td></tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <div className="claude-token-cell">
                        <div className="claude-avatar">{claim.fun_token?.image_url ? <img src={claim.fun_token.image_url} alt={claim.fun_token.name} /> : <span className="text-xs">{claim.fun_token?.ticker?.slice(0, 2)}</span>}</div>
                        <div><span className="font-medium">{claim.fun_token?.name || "Unknown"}</span><div className="text-xs text-[hsl(160,70%,50%)] font-mono">${claim.fun_token?.ticker}</div></div>
                      </div>
                    </td>
                    <td><div className="claude-wallet"><Wallet className="claude-wallet-icon" />{shortenAddress(claim.fun_token?.creator_wallet || claim.pool_address)}</div></td>
                    <td className="text-right claude-amount-positive">+{formatSOL(claim.claimed_sol)} SOL</td>
                    <td className="text-right claude-time">{formatDistanceToNow(new Date(claim.claimed_at), { addSuffix: true })}</td>
                    <td className="text-right">{claim.signature ? <a href={`https://solscan.io/tx/${claim.signature}`} target="_blank" rel="noopener noreferrer" className="claude-link">View <ExternalLink className="h-3.5 w-3.5" /></a> : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="claude-pagination">
            <span className="claude-pagination-info">{(claimedPage - 1) * pageSize + 1}–{Math.min(claimedPage * pageSize, totalClaims)} of {totalClaims}</span>
            <div className="claude-pagination-buttons">
              <button className="claude-page-btn" disabled={claimedPage === 1} onClick={() => setClaimedPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
              <button className="claude-page-btn" disabled={claimedPage >= totalPages} onClick={() => setClaimedPage(p => p + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBuybacksTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Repeat2 /></div>
        <span className="claude-section-title">Buybacks</span>
        <div className="ml-auto claude-total-badge">Total: <strong>{formatSOL(totalBuybacks)} SOL</strong></div>
      </div>
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead><tr><th>Token</th><th className="text-right">Amount</th><th className="text-right">Tokens</th><th className="text-center">Status</th><th className="text-right">TX</th></tr></thead>
          <tbody>
            {buybacksLoading ? (
              Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={5}><Skeleton className="h-10 w-full bg-[hsl(220,12%,18%)]" /></td></tr>)
            ) : buybacks.length === 0 ? (
              <tr><td colSpan={5} className="claude-empty">No buybacks yet</td></tr>
            ) : (
              buybacks.map((bb) => (
                <tr key={bb.id}>
                  <td>
                    <div className="claude-token-cell">
                      <div className="claude-avatar">{bb.fun_token?.image_url ? <img src={bb.fun_token.image_url} alt={bb.fun_token.name} /> : <span className="text-xs">{bb.fun_token?.ticker?.slice(0, 2)}</span>}</div>
                      <div><span className="font-medium">{bb.fun_token?.name || "Unknown"}</span><div className="text-xs text-[hsl(160,70%,50%)] font-mono">${bb.fun_token?.ticker}</div></div>
                    </div>
                  </td>
                  <td className="text-right font-semibold">{formatSOL(bb.amount_sol)} SOL</td>
                  <td className="text-right text-[hsl(220,10%,65%)]">{bb.tokens_bought?.toLocaleString() || "—"}</td>
                  <td className="text-center"><span className={`claude-badge ${bb.status === 'completed' ? 'claude-badge-success' : ''}`}>{bb.status}</span></td>
                  <td className="text-right">{bb.signature ? <a href={`https://solscan.io/tx/${bb.signature}`} target="_blank" rel="noopener noreferrer" className="claude-link">View <ExternalLink className="h-3.5 w-3.5" /></a> : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCreatorsTab = () => (
    <div className="claude-card">
      <div className="claude-section-header px-5 py-4 border-b border-[hsl(220,12%,20%)]">
        <div className="claude-section-icon"><Users /></div>
        <span className="claude-section-title">Creators</span>
        <span className="ml-auto text-sm text-[hsl(220,10%,45%)]">{creatorsData.length} total</span>
      </div>
      <div className="claude-table-wrapper">
        <table className="claude-table">
          <thead><tr><th style={{ width: 50 }}>#</th><th>Wallet</th><th className="text-right">Tokens</th><th className="text-right">Total Earned</th></tr></thead>
          <tbody>
            {creatorsData.length === 0 ? (
              <tr><td colSpan={4} className="claude-empty">No creators yet</td></tr>
            ) : (
              creatorsData.slice(0, 100).map((creator, idx) => (
                <tr key={creator.wallet}>
                  <td className="text-[hsl(220,10%,45%)]">{idx + 1}</td>
                  <td>
                    <div className="claude-wallet">
                      <Wallet className="claude-wallet-icon" />{shortenAddress(creator.wallet)}
                      <button onClick={() => copyToClipboard(creator.wallet)} className="claude-copy-btn">{copiedAddress === creator.wallet ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button>
                    </div>
                  </td>
                  <td className="text-right font-medium">{creator.tokens}</td>
                  <td className="text-right claude-amount-positive">+{formatSOL(creator.totalEarned)} SOL</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="gate-theme min-h-screen">
      {/* Token Ticker Bar */}
      <TokenTickerBar />
      
      {/* Header */}
      <header className="gate-header">
        <div className="gate-header-inner">
          {/* Mobile Header */}
          <div className="sm:hidden flex items-center justify-between w-full">
            <Link to="/" className="gate-logo">
              <div className="gate-logo-icon">
                <Rocket className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold">TUNA</span>
            </Link>
            <div className="flex items-center gap-2">
              <SolPriceDisplay />
              <Button onClick={() => refetch()} variant="ghost" size="sm" className="gate-btn-ghost h-8 w-8 p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="gate-btn-ghost h-8 w-8 p-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-card border-border p-0">
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 p-4 border-b border-border">
                      <div className="gate-logo-icon">
                        <Rocket className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-lg font-bold">TUNA</span>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                      <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-muted transition-colors">
                        <Rocket className="h-5 w-5 text-primary" />
                        <span className="font-medium">Launchpad</span>
                      </Link>
                      <Link to="/trending" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-muted transition-colors">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Narratives</span>
                      </Link>
                      <Link to="/api" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-muted transition-colors">
                        <Key className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">API</span>
                      </Link>
                      <Link to="/governance" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary hover:bg-muted transition-colors">
                        <Scale className="h-5 w-5 text-cyan-500" />
                        <span className="font-medium">Governance</span>
                      </Link>
                      <div className="pt-4 border-t border-border space-y-2">
                        <a href="https://dune.com/clawmode/stats" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                          <BarChart3 className="h-5 w-5 text-orange-500" />
                          <span className="text-muted-foreground">Analytics</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                        </a>
                        <a href="https://x.com/clawmode" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                          <Twitter className="h-5 w-5 text-muted-foreground" />
                          <span className="text-muted-foreground">Follow on X</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                        </a>
                      </div>
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Desktop Header */}
          <div className="hidden sm:flex items-center justify-between w-full">
            <Link to="/" className="gate-logo">
              <div className="gate-logo-icon">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold">CLAW</span>
                <span className="text-xs text-muted-foreground ml-2">Meme Launchpad</span>
              </div>
            </Link>

            <nav className="gate-nav">
              <Link to="/trending" className="gate-nav-link">Narratives</Link>
              <Link to="/api" className="gate-nav-link">API</Link>
              <Link to="/governance" className="gate-nav-link">Governance</Link>
              <a href="https://dune.com/clawmode/stats" target="_blank" rel="noopener noreferrer" className="gate-nav-link">Analytics</a>
            </nav>

            <div className="flex items-center gap-4">
              <SolPriceDisplay />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                {lastUpdate ? formatDistanceToNow(lastUpdate, { addSuffix: true }) : "Live"}
              </div>
              <a href="https://x.com/clawmode" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <Button onClick={() => refetch()} variant="ghost" size="sm" className="gate-btn-ghost">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Launch Box - TOP POSITION */}
        <div className="gate-launch-box mb-6">
          <div className="gate-launch-box-title">
            <Rocket className="h-6 w-6 text-primary" />
            <span>Launch Meme Coin</span>
          </div>
            
            {/* Mode Selector - Gate.io Style */}
            <div className="gate-launch-modes">
              {[
                { id: "random", label: "AI Generate", icon: Shuffle },
                { id: "describe", label: "Describe", icon: Sparkles },
                { id: "custom", label: "Custom", icon: Image },
                { id: "phantom", label: "Wallet", icon: Wallet },
              ].map((mode) => (
                <button 
                  key={mode.id} 
                  onClick={() => setGeneratorMode(mode.id as any)} 
                  className={`gate-launch-mode ${generatorMode === mode.id ? "active" : ""}`}
                >
                  <mode.icon className="h-5 w-5" />
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Random Mode - Gate.io Style */}
            {generatorMode === "random" && (
              <div className="space-y-4">
                <div className="gate-token-preview">
                  <div className="gate-token-preview-avatar">
                    {isGenerating ? <RefreshCw className="h-6 w-6 text-primary animate-spin" /> : meme?.imageUrl ? <img src={meme.imageUrl} alt={meme.name} /> : <Bot className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="gate-token-preview-info">
                    {isGenerating ? (
                      <div className="space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-20" /></div>
                    ) : meme ? (
                      <>
                        <Input value={meme.name} onChange={(e) => setMeme({ ...meme, name: e.target.value.slice(0, 20) })} className="gate-input h-9 font-semibold mb-2" maxLength={20} />
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">$</span>
                          <Input value={meme.ticker} onChange={(e) => setMeme({ ...meme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })} className="gate-input h-8 w-28 font-mono text-sm" maxLength={10} />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">Click Generate to create a token</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleRandomize} disabled={isGenerating || isLaunching} className="gate-btn gate-btn-secondary w-full">
                  {isGenerating ? <><Shuffle className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Shuffle className="h-4 w-4 mr-2" /> Generate Token</>}
                </Button>
                {meme && (
                  <>
                    <Textarea value={meme.description} onChange={(e) => setMeme({ ...meme, description: e.target.value.slice(0, 280) })} className="gate-input gate-textarea min-h-[80px]" placeholder="Token description" maxLength={280} />
                    <Input placeholder="Your SOL wallet address" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="gate-input font-mono text-sm" />
                    <Button onClick={handleLaunch} disabled={isLaunching || !walletAddress || !meme} className="gate-btn gate-btn-primary w-full">
                      {isLaunching ? <><Rocket className="h-4 w-4 mr-2 animate-bounce" /> Launching...</> : <><Rocket className="h-4 w-4 mr-2" /> Launch (50% fees to you)</>}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Describe Mode - Compact */}
            {generatorMode === "describe" && (
              <div className="space-y-3">
                <Textarea value={describePrompt} onChange={(e) => setDescribePrompt(e.target.value)} placeholder="Describe your meme concept..." className="claude-input min-h-[60px] text-xs resize-none" />
                <Button onClick={handleDescribeGenerate} disabled={isGenerating || !describePrompt.trim()} size="sm" className="claude-btn-secondary w-full h-9 text-xs">
                  {isGenerating ? <><Sparkles className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate</>}
                </Button>
                {isGenerating && <div className="flex items-center justify-center py-4"><MemeLoadingAnimation /></div>}
                {describedToken && !isGenerating && (
                  <>
                    <div className="flex gap-3 p-3 bg-[hsl(220,12%,14%)] rounded-xl border border-[hsl(160,70%,50%)]/30">
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">{describedToken.imageUrl && <img src={describedToken.imageUrl} alt={describedToken.name} className="w-full h-full object-cover" />}</div>
                      <div><h3 className="text-sm font-semibold">{describedToken.name}</h3><span className="text-xs text-[hsl(160,70%,50%)] font-mono">${describedToken.ticker}</span></div>
                    </div>
                    <Input placeholder="Your SOL wallet" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="claude-input font-mono text-xs h-8" />
                    <Button onClick={handleDescribeLaunch} disabled={isLaunching || !walletAddress} size="sm" className="claude-btn-primary w-full h-9 text-xs">
                      {isLaunching ? <><Rocket className="h-3.5 w-3.5 mr-1.5 animate-bounce" /> Launching...</> : <><Rocket className="h-3.5 w-3.5 mr-1.5" /> Launch</>}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Custom Mode - Compact */}
            {generatorMode === "custom" && (
              <div className="space-y-3">
                <div className="flex gap-3 p-3 bg-[hsl(220,12%,14%)] rounded-xl border border-[hsl(220,12%,20%)]">
                  <div className="w-14 h-14 rounded-lg bg-[hsl(220,12%,18%)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {customImagePreview || customToken.imageUrl ? <img src={customImagePreview || customToken.imageUrl} alt="Token" className="w-full h-full object-cover" /> : <Image className="h-6 w-6 text-[hsl(220,10%,35%)]" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input value={customToken.name} onChange={(e) => setCustomToken({ ...customToken, name: e.target.value.slice(0, 20) })} className="claude-input h-7 text-sm font-semibold" placeholder="Token Name" maxLength={20} />
                    <div className="flex items-center gap-1">
                      <span className="text-[hsl(160,70%,50%)] text-xs">$</span>
                      <Input value={customToken.ticker} onChange={(e) => setCustomToken({ ...customToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })} className="claude-input h-6 w-24 text-xs font-mono" placeholder="TICKER" maxLength={10} />
                    </div>
                  </div>
                </div>
                <Textarea value={customToken.description} onChange={(e) => setCustomToken({ ...customToken, description: e.target.value })} className="claude-input min-h-[50px] text-xs" placeholder="Description" />
                <Input type="file" accept="image/*" onChange={handleCustomImageChange} className="claude-input text-xs h-8" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={customToken.websiteUrl || ""} onChange={(e) => setCustomToken({ ...customToken, websiteUrl: e.target.value })} className="claude-input text-xs h-7" placeholder="Website" />
                  <Input value={customToken.twitterUrl || ""} onChange={(e) => setCustomToken({ ...customToken, twitterUrl: e.target.value })} className="claude-input text-xs h-7" placeholder="Twitter" />
                </div>
                <Input placeholder="Your SOL wallet" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="claude-input font-mono text-xs h-8" />
                <Button onClick={handleCustomLaunch} disabled={isLaunching || !walletAddress || !customToken.name.trim() || !customToken.ticker.trim()} size="sm" className="claude-btn-primary w-full h-9 text-xs">
                  {isLaunching ? <><Rocket className="h-3.5 w-3.5 mr-1.5 animate-bounce" /> Launching...</> : <><Rocket className="h-3.5 w-3.5 mr-1.5" /> Launch</>}
                </Button>
              </div>
            )}

            {/* Phantom Mode - Compact */}
            {generatorMode === "phantom" && (
              <div className="space-y-3">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-purple-400">Phantom Wallet</span>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] h-5">You Pay Fee</Badge>
                  </div>
                  
                  {!phantomWallet.isConnected ? (
                    <Button onClick={phantomWallet.connect} disabled={phantomWallet.isConnecting} size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white h-9 text-xs">
                      {phantomWallet.isConnecting ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Connecting...</> : <><Wallet className="h-3.5 w-3.5 mr-1.5" /> Connect Phantom</>}
                    </Button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between bg-[hsl(220,12%,14%)] rounded-lg p-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center"><Wallet className="h-3 w-3 text-purple-400" /></div>
                          <div>
                            <div className="text-xs font-mono text-white">{phantomWallet.address?.slice(0, 4)}...{phantomWallet.address?.slice(-4)}</div>
                            <div className="text-[10px] text-[hsl(220,10%,45%)]">{phantomWallet.balance?.toFixed(3) || "0"} SOL</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={phantomWallet.disconnect} className="text-[hsl(220,10%,45%)] hover:text-white h-6 px-2 text-[10px]">×</Button>
                      </div>

                      {/* Sub-mode selector */}
                      <div className="flex gap-1 mb-3">
                        {[{ id: "random" as const, label: "AI", icon: Shuffle }, { id: "describe" as const, label: "Desc", icon: Sparkles }, { id: "custom" as const, label: "Custom", icon: Image }].map((m) => (
                          <button key={m.id} onClick={() => setPhantomInputMode(m.id)} className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium border ${phantomInputMode === m.id ? "border-purple-500/50 bg-purple-500/20 text-purple-400" : "border-[hsl(220,12%,20%)] bg-[hsl(220,12%,14%)] text-[hsl(220,10%,45%)]"}`}>
                            <m.icon className="h-3 w-3" />{m.label}
                          </button>
                        ))}
                      </div>

                      {/* Trading Fee */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[10px] text-[hsl(220,10%,45%)] mb-1">
                          <span>Creator Fee: <span className="text-purple-400 font-semibold">{(phantomTradingFee / 100).toFixed(1)}%</span></span>
                          <span className="text-[9px]">Total: {((phantomTradingFee + 100) / 100).toFixed(1)}% (incl. 1% platform)</span>
                        </div>
                        <Slider value={[phantomTradingFee]} onValueChange={(v) => setPhantomTradingFee(v[0])} min={10} max={1000} step={10} className="w-full" />
                      </div>

                      {phantomInputMode === "random" && (
                        <Button onClick={handlePhantomRandomize} disabled={isPhantomGenerating} size="sm" className="w-full bg-purple-600/80 hover:bg-purple-600 text-white h-8 text-xs mb-3">
                          {isPhantomGenerating ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating...</> : <><Shuffle className="h-3.5 w-3.5 mr-1.5" /> AI Randomize</>}
                        </Button>
                      )}
                      {phantomInputMode === "describe" && (
                        <div className="space-y-2 mb-3">
                          <Textarea value={phantomDescribePrompt} onChange={(e) => setPhantomDescribePrompt(e.target.value)} placeholder="Describe meme..." className="claude-input min-h-[50px] text-xs resize-none" />
                          <Button onClick={handlePhantomDescribeGenerate} disabled={isPhantomGenerating || !phantomDescribePrompt.trim()} size="sm" className="w-full bg-purple-600/80 hover:bg-purple-600 text-white h-8 text-xs">
                            {isPhantomGenerating ? <><Sparkles className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate</>}
                          </Button>
                        </div>
                      )}

                      {isPhantomGenerating && <div className="flex items-center justify-center py-3"><MemeLoadingAnimation /></div>}

                      {!isPhantomGenerating && (
                        <div className="space-y-2">
                          <div className="flex gap-2 p-2 bg-[hsl(220,12%,14%)] rounded-lg border border-purple-500/20">
                            <div className="w-10 h-10 rounded-lg bg-[hsl(220,12%,18%)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl ? <img src={phantomImagePreview || phantomMeme?.imageUrl || phantomToken.imageUrl} alt="Token" className="w-full h-full object-cover" /> : <Bot className="h-5 w-5 text-[hsl(220,10%,35%)]" />}
                            </div>
                            <div className="flex-1 space-y-1">
                              <Input value={phantomToken.name} onChange={(e) => setPhantomToken({ ...phantomToken, name: e.target.value.slice(0, 32) })} className="claude-input h-6 text-xs font-semibold" placeholder="Name" maxLength={32} />
                              <div className="flex items-center gap-1">
                                <span className="text-purple-400 text-[10px]">$</span>
                                <Input value={phantomToken.ticker} onChange={(e) => setPhantomToken({ ...phantomToken, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 10) })} className="claude-input h-5 w-16 text-[10px] font-mono" placeholder="TICKER" maxLength={10} />
                              </div>
                            </div>
                          </div>
                          {phantomInputMode === "custom" && <Input type="file" accept="image/*" onChange={handlePhantomImageChange} className="claude-input text-[10px] h-7" />}
                          <Button onClick={handlePhantomLaunch} disabled={isPhantomLaunching || !phantomToken.name.trim() || !phantomToken.ticker.trim() || (!phantomImagePreview && !phantomMeme?.imageUrl && !phantomToken.imageUrl)} size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white h-9 text-xs">
                            {isPhantomLaunching ? <><Rocket className="h-3.5 w-3.5 mr-1.5 animate-bounce" /> Launching...</> : <><Rocket className="h-3.5 w-3.5 mr-1.5" /> Launch (~0.02 SOL)</>}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Main Tabs */}
        <div className="mb-4 overflow-x-auto pb-2">
          <div className="claude-tabs-container">
            {[
              { id: "tokens" as MainTab, icon: BarChart3, label: "Tokens", count: tokens.length },
              { id: "top" as MainTab, icon: Trophy, label: "Top" },
              { id: "claimed" as MainTab, icon: LinkIcon, label: "Claimed", count: summary?.claimCount },
              { id: "buybacks" as MainTab, icon: Repeat2, label: "Buybacks", count: buybacks.length },
              { id: "creators" as MainTab, icon: Users, label: "Creators", count: creatorsData.length },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`claude-tab ${activeTab === tab.id ? "active" : ""}`}>
                <tab.icon className="claude-tab-icon" />
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="text-[hsl(220,10%,45%)]">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="claude-animate-in">
          {activeTab === "tokens" && renderTokensTab()}
          {activeTab === "top" && renderTopTab()}
          {activeTab === "claimed" && renderClaimedTab()}
          {activeTab === "buybacks" && renderBuybacksTab()}
          {activeTab === "creators" && renderCreatorsTab()}
        </div>
      </main>

      {/* Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="claude-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {launchResult?.success ? <><PartyPopper className="h-6 w-6 text-[hsl(160,70%,50%)]" /> Token Launched!</> : <><AlertTriangle className="h-6 w-6 text-red-500" /> Launch Failed</>}
            </DialogTitle>
            <DialogDescription>
              {launchResult?.success ? `${launchResult.name} ($${launchResult.ticker}) is now live!` : launchResult?.error}
            </DialogDescription>
          </DialogHeader>
          {launchResult?.success && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[hsl(220,12%,14%)] rounded-xl">
                {launchResult.imageUrl && <img src={launchResult.imageUrl} alt={launchResult.name} className="w-16 h-16 rounded-xl" />}
                <div><div className="font-bold text-lg">{launchResult.name}</div><div className="text-[hsl(160,70%,50%)] font-mono">${launchResult.ticker}</div></div>
              </div>
              {launchResult.mintAddress && (
                <div className="flex items-center gap-2 p-3 bg-[hsl(220,12%,12%)] rounded-lg">
                  <span className="text-xs text-[hsl(220,10%,45%)]">CA:</span>
                  <code className="flex-1 text-xs font-mono text-white truncate">{launchResult.mintAddress}</code>
                  <button onClick={() => copyToClipboard(launchResult.mintAddress!)} className="claude-copy-btn">{copiedAddress === launchResult.mintAddress ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
                </div>
              )}
              <div className="flex gap-3">
                {launchResult.solscanUrl && <a href={launchResult.solscanUrl} target="_blank" rel="noopener noreferrer" className="flex-1"><Button variant="outline" className="w-full claude-btn-ghost border-[hsl(220,12%,20%)]"><ExternalLink className="h-4 w-4 mr-2" /> Solscan</Button></a>}
                {launchResult.tradeUrl && <a href={launchResult.tradeUrl} target="_blank" rel="noopener noreferrer" className="flex-1"><Button className="w-full claude-btn-primary"><Rocket className="h-4 w-4 mr-2" /> Trade Now</Button></a>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
