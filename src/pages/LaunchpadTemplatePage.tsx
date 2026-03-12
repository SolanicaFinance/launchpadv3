import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSwap } from "@/hooks/useSwap";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatChange24h } from "@/lib/formatters";
import { LaunchpadTokenCreator } from "@/components/launchpad/LaunchpadTokenCreator";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  ArrowUpDown, 
  X, 
  Loader2,
  Bell,
  BellOff,
  Plus,
  Rocket
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DesignConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    accent: string;
    success: string;
    danger: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    logoSize: string;
  };
  layout: {
    style: string;
    borderRadius: string;
    spacing: string;
    headerPosition: string;
  };
  branding: {
    name: string;
    tagline: string;
    logoStyle: string;
    logoUrl?: string;
  };
  effects: {
    gradients: boolean;
    animations: boolean;
    glowEffects: boolean;
    particles: boolean;
  };
  customDomain?: string;
}

const defaultDesign: DesignConfig = {
  colors: {
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    background: "#0A0A0A",
    surface: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "#A1A1AA",
    accent: "#F59E0B",
    success: "#22C55E",
    danger: "#EF4444",
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter",
    logoSize: "2xl",
  },
  layout: {
    style: "modern",
    borderRadius: "lg",
    spacing: "normal",
    headerPosition: "top",
  },
  branding: {
    name: "Launchpad",
    tagline: "Trade tokens with low fees",
    logoStyle: "text",
  },
  effects: {
    gradients: true,
    animations: true,
    glowEffects: false,
    particles: false,
  },
};

interface Token {
  id: string;
  name: string;
  ticker: string;
  mint_address: string;
  image_url: string | null;
  price_sol: number | null;
  volume_24h_sol: number | null;
  price_change_24h: number | null;
  market_cap_sol: number | null;
  status: string;
}

// Custom hook for launchpad-specific swaps with x-launchpad-id header
function useLaunchpadSwap(launchpadId: string | null) {
  const { swap: baseSwap, isSwapping } = useSwap();
  
  const swap = useCallback(async (params: {
    mintAddress: string;
    amount: number;
    isBuy: boolean;
    slippageBps?: number;
  }) => {
    // Store launchpad ID in localStorage for the swap hook to pick up
    if (launchpadId) {
      localStorage.setItem('x-launchpad-id', launchpadId);
    }
    
    try {
      const result = await baseSwap(params);
      return result;
    } finally {
      localStorage.removeItem('x-launchpad-id');
    }
  }, [baseSwap, launchpadId]);
  
  return { swap, isSwapping };
}

export default function LaunchpadTemplatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const launchpadId = searchParams.get("id");
  const { isAuthenticated, login, solanaAddress } = useAuth();
  const { getBalance } = useSolanaWallet();
  const { swap, isSwapping } = useLaunchpadSwap(launchpadId);
  
  const [solBalance, setSolBalance] = useState<number>(0);
  
  const [design, setDesign] = useState<DesignConfig>(defaultDesign);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchpadName, setLaunchpadName] = useState("Launchpad");
  
  // Trading modal state
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [tradeAmount, setTradeAmount] = useState("");
  const [isBuy, setIsBuy] = useState(true);
  
  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  useEffect(() => {
    // Check for embedded design config (deployed version)
    const envConfig = import.meta.env.VITE_DESIGN_CONFIG;
    if (envConfig) {
      try {
        const parsed = JSON.parse(envConfig);
        setDesign({ ...defaultDesign, ...parsed });
        if (parsed.branding?.name) setLaunchpadName(parsed.branding.name);
      } catch (e) {
        console.error("Failed to parse design config:", e);
      }
    }

    // Fetch launchpad data if ID provided
    if (launchpadId) {
      fetchLaunchpadData();
      subscribeToTrades();
    } else {
      setLoading(false);
    }
    
    return () => {
      // Cleanup realtime subscription
    };
  }, [launchpadId]);

  // Fetch SOL balance when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      getBalance().then(setSolBalance).catch(console.error);
    }
  }, [isAuthenticated, getBalance]);

  const fetchLaunchpadData = async () => {
    try {
      const lpResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-launchpad?id=${launchpadId}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const lpData = await lpResponse.json();
      
      if (lpData.launchpad) {
        if (lpData.launchpad.design_config) {
          setDesign({ ...defaultDesign, ...lpData.launchpad.design_config });
        }
        setLaunchpadName(lpData.launchpad.name || "Launchpad");
      }

      const tokensResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-tokens?launchpadId=${launchpadId}`,
        {
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      const tokensData = await tokensResponse.json();
      setTokens(tokensData.tokens || []);
    } catch (error) {
      console.error("Error fetching launchpad:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToTrades = () => {
    // Real-time trade notifications would go here
    // Using Supabase realtime to listen for launchpad_transactions
  };

  const handleTrade = async () => {
    if (!selectedToken || !tradeAmount || !isAuthenticated) return;
    
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    
    try {
      const result = await swap({
        mintAddress: selectedToken.mint_address,
        amount,
        isBuy,
        slippageBps: 500, // 5% default
      });
      
      if (result?.success) {
        toast.success(`${isBuy ? "Bought" : "Sold"} successfully!`);
        setSelectedToken(null);
        setTradeAmount("");
        fetchLaunchpadData(); // Refresh token data
      }
    } catch (error: any) {
      toast.error(error?.message || "Trade failed");
    }
  };

  const getBorderRadius = (size: string) => {
    switch (size) {
      case "none": return "0px";
      case "sm": return "4px";
      case "md": return "8px";
      case "lg": return "12px";
      case "xl": return "16px";
      case "full": return "24px";
      default: return "12px";
    }
  };

  const radius = getBorderRadius(design.layout.borderRadius);

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: design.colors.background }}
      >
        <div 
          className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
          style={{ borderTopColor: design.colors.primary }}
        />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        backgroundColor: design.colors.background,
        fontFamily: design.typography.bodyFont,
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ 
          backgroundColor: design.colors.surface,
          borderColor: `${design.colors.text}10`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {design.branding.logoUrl ? (
              <img 
                src={design.branding.logoUrl} 
                alt={launchpadName}
                className="h-8 w-auto"
              />
            ) : (
              <div 
                className="font-bold text-xl"
                style={{ color: design.colors.text }}
              >
                {launchpadName}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notifications toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              style={{ color: design.colors.textMuted }}
            >
              {notificationsEnabled ? (
                <Bell className="w-5 h-5" style={{ color: design.colors.primary }} />
              ) : (
                <BellOff className="w-5 h-5" />
              )}
            </Button>
            
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div 
                  className="px-3 py-1.5 text-sm"
                  style={{ 
                    backgroundColor: `${design.colors.success}20`,
                    color: design.colors.success,
                    borderRadius: radius,
                  }}
                >
                  {solBalance?.toFixed(3)} SOL
                </div>
                <div 
                  className="px-3 py-1.5 text-sm font-mono"
                  style={{ 
                    backgroundColor: `${design.colors.primary}20`,
                    color: design.colors.primary,
                    borderRadius: radius,
                  }}
                >
                  {solanaAddress?.slice(0, 4)}...{solanaAddress?.slice(-4)}
                </div>
              </div>
            ) : (
              <Button
                onClick={() => login()}
                style={{ 
                  backgroundColor: design.colors.primary,
                  color: "#fff",
                  borderRadius: radius,
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="py-12 md:py-16 px-4"
        style={{
          background: design.effects.gradients
            ? `linear-gradient(180deg, ${design.colors.surface} 0%, ${design.colors.background} 100%)`
            : design.colors.surface,
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-3xl md:text-5xl font-bold mb-4"
            style={{ 
              color: design.colors.text,
              fontFamily: design.typography.headingFont,
            }}
          >
            {design.branding.tagline}
          </h1>
          <p
            className="text-base md:text-lg mb-6"
            style={{ color: design.colors.textMuted }}
          >
            Trade tokens with 2% fees • Powered by Meteora
          </p>
          
          {/* Quick stats */}
          <div className="flex justify-center gap-6 md:gap-12">
            <div>
              <div className="text-2xl font-bold" style={{ color: design.colors.text }}>
                {tokens.length}
              </div>
              <div className="text-sm" style={{ color: design.colors.textMuted }}>Tokens</div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: design.colors.success }}>
                {tokens.reduce((sum, t) => sum + (t.volume_24h_sol || 0), 0).toFixed(1)} SOL
              </div>
              <div className="text-sm" style={{ color: design.colors.textMuted }}>24h Volume</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tokens Grid */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl md:text-2xl font-bold"
            style={{ color: design.colors.text }}
          >
            Featured Tokens
          </h2>
          
          {/* Token Creator Button */}
          {launchpadId && solanaAddress && (
            <LaunchpadTokenCreator
              launchpadId={launchpadId}
              walletAddress={solanaAddress}
              design={design}
              onTokenCreated={() => fetchLaunchpadData()}
            />
          )}
        </div>

        {tokens.length === 0 ? (
          <div
            className="text-center py-16"
            style={{ color: design.colors.textMuted }}
          >
            <p className="text-lg mb-2">No tokens available yet</p>
            <p className="text-sm">Tokens will appear here when added to this launchpad</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => {
              const priceChange = token.price_change_24h ?? 0;
              const isPositive = priceChange >= 0;
              
              return (
                <Card
                  key={token.id}
                  className="cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: design.colors.surface,
                    borderColor: `${design.colors.text}10`,
                    borderRadius: radius,
                    boxShadow: design.effects.glowEffects 
                      ? `0 0 20px ${design.colors.primary}20`
                      : undefined,
                  }}
                  onClick={() => setSelectedToken(token)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {token.image_url ? (
                        <img
                          src={token.image_url}
                          alt={token.ticker}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                          style={{ 
                            backgroundColor: `${design.colors.primary}30`,
                            color: design.colors.primary,
                          }}
                        >
                          {token.ticker?.slice(0, 2)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-semibold truncate"
                          style={{ color: design.colors.text }}
                        >
                          {token.name}
                        </div>
                        <div
                          className="text-sm"
                          style={{ color: design.colors.textMuted }}
                        >
                          ${token.ticker}
                        </div>
                      </div>
                      <Badge
                        className="shrink-0"
                        style={{
                          backgroundColor: isPositive 
                            ? `${design.colors.success}20`
                            : `${design.colors.danger}20`,
                          color: isPositive
                            ? design.colors.success
                            : design.colors.danger,
                        }}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        {formatChange24h(priceChange)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div style={{ color: design.colors.textMuted }}>Price</div>
                        <div style={{ color: design.colors.text }} className="font-medium">
                          {(token.price_sol ?? 0).toFixed(8)} SOL
                        </div>
                      </div>
                      <div>
                        <div style={{ color: design.colors.textMuted }}>24h Volume</div>
                        <div style={{ color: design.colors.text }} className="font-medium">
                          {(token.volume_24h_sol ?? 0).toFixed(2)} SOL
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex gap-2" style={{ borderColor: `${design.colors.text}10` }}>
                      <Button
                        className="flex-1"
                        style={{
                          backgroundColor: design.colors.success,
                          color: "#fff",
                          borderRadius: radius,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedToken(token);
                          setIsBuy(true);
                        }}
                      >
                        Buy
                      </Button>
                      <Button
                        className="flex-1"
                        variant="outline"
                        style={{
                          borderColor: design.colors.danger,
                          color: design.colors.danger,
                          borderRadius: radius,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedToken(token);
                          setIsBuy(false);
                        }}
                      >
                        Sell
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Trade Modal */}
      <Dialog open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
        <DialogContent 
          className="max-w-md"
          style={{
            backgroundColor: design.colors.surface,
            borderColor: `${design.colors.text}20`,
            color: design.colors.text,
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedToken?.image_url ? (
                <img
                  src={selectedToken.image_url}
                  alt={selectedToken.ticker}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{ 
                    backgroundColor: `${design.colors.primary}30`,
                    color: design.colors.primary,
                  }}
                >
                  {selectedToken?.ticker?.slice(0, 2)}
                </div>
              )}
              <span style={{ color: design.colors.text }}>
                Trade {selectedToken?.ticker}
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Buy/Sell Toggle */}
            <Tabs value={isBuy ? "buy" : "sell"} onValueChange={(v) => setIsBuy(v === "buy")}>
              <TabsList className="w-full" style={{ backgroundColor: `${design.colors.text}10` }}>
                <TabsTrigger 
                  value="buy" 
                  className="flex-1 data-[state=active]:text-white"
                  style={{ 
                    '--tw-bg-opacity': 1,
                  } as any}
                  data-active-bg={design.colors.success}
                >
                  Buy
                </TabsTrigger>
                <TabsTrigger 
                  value="sell" 
                  className="flex-1 data-[state=active]:text-white"
                >
                  Sell
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Amount Input */}
            <div className="space-y-2">
              <label 
                className="text-sm"
                style={{ color: design.colors.textMuted }}
              >
                Amount ({isBuy ? "SOL" : selectedToken?.ticker})
              </label>
              <Input
                type="number"
                placeholder="0.0"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                style={{
                  backgroundColor: `${design.colors.text}10`,
                  borderColor: `${design.colors.text}20`,
                  color: design.colors.text,
                }}
              />
              
              {/* Quick amounts */}
              <div className="flex gap-2">
                {(isBuy ? [0.1, 0.5, 1, 2] : [25, 50, 75, 100]).map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    style={{
                      borderColor: `${design.colors.text}20`,
                      color: design.colors.textMuted,
                    }}
                    onClick={() => setTradeAmount(String(isBuy ? amt : amt))}
                  >
                    {isBuy ? `${amt} SOL` : `${amt}%`}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Price Info */}
            <div 
              className="p-3 rounded-lg text-sm space-y-1"
              style={{ backgroundColor: `${design.colors.text}05` }}
            >
              <div className="flex justify-between">
                <span style={{ color: design.colors.textMuted }}>Price</span>
                <span style={{ color: design.colors.text }}>
                  {(selectedToken?.price_sol ?? 0).toFixed(8)} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: design.colors.textMuted }}>Fee (2%)</span>
                <span style={{ color: design.colors.text }}>
                  {(parseFloat(tradeAmount || "0") * 0.02).toFixed(4)} SOL
                </span>
              </div>
            </div>
            
            {/* Trade Button */}
            {isAuthenticated ? (
              <Button
                className="w-full"
                disabled={isSwapping || !tradeAmount}
                onClick={handleTrade}
                style={{
                  backgroundColor: isBuy ? design.colors.success : design.colors.danger,
                  color: "#fff",
                  borderRadius: radius,
                }}
              >
                {isSwapping ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                )}
                {isSwapping ? "Processing..." : isBuy ? "Buy" : "Sell"} {selectedToken?.ticker}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => login()}
                style={{
                  backgroundColor: design.colors.primary,
                  color: "#fff",
                  borderRadius: radius,
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect to Trade
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Real-time Trade Notifications */}
      {notificationsEnabled && recentTrades.length > 0 && (
        <div 
          className="fixed bottom-4 right-4 w-80 space-y-2 z-50"
        >
          {recentTrades.slice(0, 3).map((trade, i) => (
            <div
              key={i}
              className="p-3 rounded-lg shadow-lg animate-in slide-in-from-right"
              style={{
                backgroundColor: design.colors.surface,
                borderLeft: `3px solid ${trade.type === 'buy' ? design.colors.success : design.colors.danger}`,
              }}
            >
              <div className="text-sm" style={{ color: design.colors.text }}>
                {trade.type === 'buy' ? '🟢' : '🔴'} {trade.amount} SOL • {trade.token}
              </div>
              <div className="text-xs" style={{ color: design.colors.textMuted }}>
                {trade.wallet?.slice(0, 4)}...{trade.wallet?.slice(-4)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer
        className="py-8 px-4 mt-8 border-t"
        style={{ 
          backgroundColor: design.colors.surface,
          borderColor: `${design.colors.text}10`,
        }}
      >
        <div className="max-w-7xl mx-auto text-center">
          <p style={{ color: design.colors.textMuted }} className="text-sm">
            Powered by MoonDexo • 2% trading fees
          </p>
        </div>
      </footer>
    </div>
  );
}
