import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Rocket, Image as ImageIcon, Globe, Twitter, AlertCircle, Loader2, Coins, Shield, TrendingUp, Zap, Info } from 'lucide-react';
import { EvmWalletCard } from './EvmWalletCard';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface BnbLaunchFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  initialBuyBnb: string;
}

const PLATFORM_FEE_PCT = 1; // 1% always

export function BnbLauncher() {
  const { isConnected, address, balance, connect } = useEvmWallet();
  const [isLaunching, setIsLaunching] = useState(false);
  const [formData, setFormData] = useState<BnbLaunchFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
    initialBuyBnb: '0',
  });

  const handleInputChange = (field: keyof BnbLaunchFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  const canLaunch = isConnected && formData.name && formData.ticker;

  const handleLaunch = useCallback(async () => {
    if (!canLaunch || !address) return;

    setIsLaunching(true);
    toast.info('🚀 Creating token on BNB Chain...', {
      description: 'Deploying with bonding curve. This may take 30-60 seconds.',
    });

    try {
      const { data, error } = await supabase.functions.invoke('bnb-create-token', {
        body: {
          name: formData.name,
          ticker: formData.ticker.toUpperCase(),
          creatorWallet: address,
          initialBuyBnb: formData.initialBuyBnb !== '0' ? formData.initialBuyBnb : undefined,
          creatorFeeBps: 0,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          websiteUrl: formData.websiteUrl || null,
          twitterUrl: formData.twitterUrl || null,
          telegramUrl: formData.telegramUrl || null,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to create token');

      toast.success('🎉 Token launched on BNB Chain!', {
        description: `${formData.name} ($${formData.ticker}) is live on the bonding curve!`,
        action: data.tokenUrl ? {
          label: 'View on BscScan',
          onClick: () => window.open(data.tokenUrl, '_blank'),
        } : undefined,
      });

      setFormData({
        name: '', ticker: '', description: '', imageUrl: '',
        websiteUrl: '', twitterUrl: '', telegramUrl: '',
        initialBuyBnb: '0',
      });
    } catch (error) {
      console.error('BNB launch error:', error);
      toast.error('Launch failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLaunching(false);
    }
  }, [canLaunch, address, formData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Launch on BNB Chain
                </CardTitle>
                <CardDescription className="mt-1">
                  Deploy a BEP-20 token with bonding curve. Auto-migrates to PancakeSwap.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                BNB Chain
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Info Banners */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                <TrendingUp className="h-4 w-4 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Curve</p>
                  <p className="text-sm font-semibold text-yellow-400">Bonding AMM</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                <Coins className="h-4 w-4 text-green-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Supply</p>
                  <p className="text-sm font-semibold">1B Tokens</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                <Zap className="h-4 w-4 text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Graduates</p>
                  <p className="text-sm font-semibold">PancakeSwap</p>
                </div>
              </div>
            </div>

            {/* Token Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bnb-name">Token Name *</Label>
                <Input
                  id="bnb-name"
                  placeholder="e.g., Moon Coin"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  maxLength={32}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-ticker">Symbol *</Label>
                <Input
                  id="bnb-ticker"
                  placeholder="e.g., MOON"
                  value={formData.ticker}
                  onChange={(e) => handleInputChange('ticker', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="bnb-description">Description</Label>
              <Textarea
                id="bnb-description"
                placeholder="Tell the world about your token..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                maxLength={500}
                rows={3}
                className="bg-background/50"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="bnb-imageUrl" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Image URL
              </Label>
              <Input
                id="bnb-imageUrl"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                className="bg-background/50"
              />
              {formData.imageUrl && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary/30">
                  <img
                    src={formData.imageUrl}
                    alt="Token preview"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bnb-websiteUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="bnb-websiteUrl"
                  placeholder="https://..."
                  value={formData.websiteUrl}
                  onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-twitterUrl" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter/X
                </Label>
                <Input
                  id="bnb-twitterUrl"
                  placeholder="https://x.com/..."
                  value={formData.twitterUrl}
                  onChange={(e) => handleInputChange('twitterUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bnb-telegramUrl">Telegram</Label>
                <Input
                  id="bnb-telegramUrl"
                  placeholder="https://t.me/..."
                  value={formData.telegramUrl}
                  onChange={(e) => handleInputChange('telegramUrl', e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Creator Fee */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  Creator Fee
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Label>
                <span className="text-sm font-semibold text-primary">{formData.creatorFeePct}%</span>
              </div>
              <Slider
                value={[formData.creatorFeePct]}
                onValueChange={([v]) => handleInputChange('creatorFeePct', v)}
                min={0}
                max={MAX_CREATOR_FEE_PCT}
                step={1}
                className="w-full"
              />
              <div className="flex items-start gap-2 p-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-lg">
                <Info className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    <span className="text-foreground font-medium">Total token tax: {totalTaxPct}%</span>
                    {' '}({PLATFORM_FEE_PCT}% platform + {formData.creatorFeePct}% creator)
                  </p>
                  <p>
                    Creator fee is sent to your connected wallet on every trade.
                  </p>
                </div>
              </div>
            </div>

            {/* Initial Buy */}
            <div className="space-y-2">
              <Label htmlFor="bnb-initialBuy">Initial Buy (optional)</Label>
              <Input
                id="bnb-initialBuy"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={formData.initialBuyBnb === '0' ? '' : formData.initialBuyBnb}
                onChange={(e) => handleInputChange('initialBuyBnb', e.target.value || '0')}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                BNB amount for your initial purchase on the bonding curve. Leave empty for no initial buy.
              </p>
            </div>

            {/* Info Notice */}
            <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Token launches on a bonding curve — price increases as people buy.
                <strong className="text-foreground"> At ~16 BNB in reserves, it graduates to PancakeSwap with full liquidity.</strong>
              </p>
            </div>

            {/* Launch Button */}
            {!isConnected ? (
              <Button
                onClick={connect}
                className="w-full h-12 text-lg font-semibold"
                variant="outline"
              >
                Connect Wallet to Launch
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                disabled={!canLaunch || isLaunching}
                className="w-full h-12 text-lg font-semibold bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Launching on BNB Chain...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-5 w-5" />
                    Launch Token ({totalTaxPct}% tax)
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <EvmWalletCard />

        {/* How It Works */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">1.</span>
              <p>Token deploys on BNB Chain with a <strong className="text-foreground">bonding curve</strong> (1B supply, BEP-20)</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">2.</span>
              <p>Users buy & sell against the curve — price goes up as more BNB flows in. <strong className="text-foreground">{totalTaxPct}% tax</strong> per trade ({PLATFORM_FEE_PCT}% platform + {formData.creatorFeePct}% to you).</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400 font-bold shrink-0">3.</span>
              <p>At <strong className="text-foreground">~16 BNB</strong> in reserves, token <strong className="text-foreground">graduates to PancakeSwap</strong> with full liquidity. Tradable on any DEX aggregator.</p>
            </div>
          </CardContent>
        </Card>

        {/* Fee Breakdown */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-400" />
              Fee Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="font-mono font-semibold">{PLATFORM_FEE_PCT}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creator fee</span>
              <span className="font-mono font-semibold text-primary">{formData.creatorFeePct}%</span>
            </div>
            <div className="border-t border-border/50 pt-2 flex items-center justify-between">
              <span className="text-foreground font-medium">Total tax per trade</span>
              <span className="font-mono font-bold text-yellow-400">{totalTaxPct}%</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Max total tax: {PLATFORM_FEE_PCT + MAX_CREATOR_FEE_PCT}% ({MAX_CREATOR_FEE_PCT}% creator + {PLATFORM_FEE_PCT}% platform)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
