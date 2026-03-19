import { Globe, Twitter, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

interface PoolInfo {
  pairAddress: string;
  dexId: string;
  liquidity_usd: number;
  market_cap: number;
  volume_24h: number;
  priceUsd: string;
  quoteToken: string;
}

interface TokenInfo {
  name: string;
  ticker: string;
  image_url: string;
  description: string;
  website_url: string;
  twitter_url: string;
  telegram_url: string;
  discord_url: string;
}

interface TokenLookupCardProps {
  tokenInfo: TokenInfo;
  pools: PoolInfo[];
  onConfirm: (poolAddress: string, maxLeverage: number) => void;
  isSubmitting: boolean;
}

export function TokenLookupCard({ tokenInfo, pools, onConfirm, isSubmitting }: TokenLookupCardProps) {
  const [selectedPool, setSelectedPool] = useState(pools[0]?.pairAddress || "");
  const [manualPool, setManualPool] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [maxLeverage, setMaxLeverage] = useState(10);

  const activePool = useManual ? manualPool : selectedPool;
  const selectedPoolInfo = pools.find((p) => p.pairAddress === selectedPool);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Token header */}
      <div className="flex items-center gap-4">
        {tokenInfo.image_url && (
          <img
            src={tokenInfo.image_url}
            alt={tokenInfo.name}
            className="w-14 h-14 rounded-full border border-border object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-foreground truncate">
            {tokenInfo.name}{" "}
            <span className="text-muted-foreground font-mono text-sm">${tokenInfo.ticker}</span>
          </h3>
          {tokenInfo.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{tokenInfo.description}</p>
          )}
        </div>
        {/* Socials */}
        <div className="flex gap-2 shrink-0">
          {tokenInfo.website_url && (
            <a href={tokenInfo.website_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <Globe className="w-4 h-4" />
            </a>
          )}
          {tokenInfo.twitter_url && (
            <a href={tokenInfo.twitter_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
          )}
          {tokenInfo.telegram_url && (
            <a href={tokenInfo.telegram_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Pool selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Select Pool</label>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {pools.map((pool) => (
            <label
              key={pool.pairAddress}
              className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                !useManual && selectedPool === pool.pairAddress
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground/50"
              }`}
              onClick={() => { setUseManual(false); setSelectedPool(pool.pairAddress); }}
            >
              <input
                type="radio"
                checked={!useManual && selectedPool === pool.pairAddress}
                onChange={() => { setUseManual(false); setSelectedPool(pool.pairAddress); }}
                className="accent-primary"
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono text-foreground truncate block">{pool.pairAddress}</span>
                <span className="text-xs text-muted-foreground">
                  {pool.dexId} · {pool.quoteToken} · Liq ${(pool.liquidity_usd / 1000).toFixed(1)}k · MCap ${(pool.market_cap / 1000).toFixed(1)}k
                </span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="radio"
            checked={useManual}
            onChange={() => setUseManual(true)}
            className="accent-primary"
          />
          <Input
            placeholder="Enter pool address manually"
            value={manualPool}
            onChange={(e) => { setManualPool(e.target.value); setUseManual(true); }}
            className="flex-1 font-mono text-xs"
          />
        </div>
      </div>

      {/* Leverage setting */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Max Leverage</label>
          <span className="text-xl font-bold text-primary font-mono">{maxLeverage}x</span>
        </div>
        <Slider
          value={[maxLeverage]}
          onValueChange={([v]) => setMaxLeverage(v)}
          min={1}
          max={50}
          step={1}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1x</span>
          <span>25x</span>
          <span>50x</span>
        </div>
      </div>

      {/* Stats summary */}
      {selectedPoolInfo && !useManual && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground">Market Cap</div>
            <div className="text-sm font-bold text-foreground">${(selectedPoolInfo.market_cap / 1000).toFixed(1)}k</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground">Liquidity</div>
            <div className="text-sm font-bold text-foreground">${(selectedPoolInfo.liquidity_usd / 1000).toFixed(1)}k</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground">24h Volume</div>
            <div className="text-sm font-bold text-foreground">${(selectedPoolInfo.volume_24h / 1000).toFixed(1)}k</div>
          </div>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={() => onConfirm(activePool, maxLeverage)}
        disabled={!activePool || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Listing..." : "List Token for Leverage Trading"}
      </Button>
    </div>
  );
}
