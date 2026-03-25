import { useState } from "react";
import { usePerpTokenLookup } from "@/hooks/usePerpMarkets";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Search, CheckCircle2, XCircle, Loader2, Rocket, Lock, DollarSign, Info } from "lucide-react";

const LOCK_OPTIONS = [
  { days: 30, badge: "Silver", color: "text-zinc-400" },
  { days: 60, badge: "Gold", color: "text-yellow-400" },
  { days: 90, badge: "Gold", color: "text-yellow-400" },
  { days: 180, badge: "Platinum", color: "text-cyan-400" },
];

export function PerpCreateMarket() {
  const { solanaAddress: walletAddress, login } = useAuth();
  const { lookup, loading: lookupLoading, token, eligible, checks, error, reset } = usePerpTokenLookup();

  const [address, setAddress] = useState("");
  const [vaultAmount, setVaultAmount] = useState("600");
  const [lockDays, setLockDays] = useState(30);
  const [creating, setCreating] = useState(false);

  const handleLookup = () => {
    if (!address.trim()) return;
    lookup(address.trim());
  };

  const handleCreate = async () => {
    if (!walletAddress || !token || !eligible) return;
    const vault = parseFloat(vaultAmount);
    if (isNaN(vault) || vault < 500) {
      toast({ title: "Minimum $500 vault required", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("perp-create-market", {
        body: {
          action: "create",
          tokenAddress: token.address,
          creatorWallet: walletAddress,
          vaultAmountUsd: vault,
          lockDurationDays: lockDays,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          dexPairAddress: token.pairAddress,
          dexQuoteToken: token.quoteToken,
          marketCapUsd: token.marketCap,
          liquidityUsd: token.liquidity,
          priceUsd: parseFloat(token.priceUsd),
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Failed to create market");

      toast({ title: "Market Created!", description: `${token.symbol}/USDT perpetual market is now live.` });
      reset();
      setAddress("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Compute preview params
  const vault = parseFloat(vaultAmount) || 0;
  const maxPosition = Math.min(100, Math.max(5, vault / 50));
  const selectedLock = LOCK_OPTIONS.find((l) => l.days === lockDays) || LOCK_OPTIONS[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step 1: Token Address */}
      <div className="bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Enter Token Address</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste your BEP-20 contract address. The token must have a PancakeSwap USDT, BNB, or WBNB pair.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); reset(); }}
            placeholder="0x..."
            className="flex-1 px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
          />
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !address.trim()}
            className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 hover:brightness-110 transition-all"
          >
            {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Lookup
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Token info */}
        {token && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/30">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {token.symbol.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground">{token.name} ({token.symbol})</div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{token.address}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-bold text-foreground">${parseFloat(token.priceUsd).toFixed(6)}</div>
                <div className="text-[10px] text-muted-foreground">MCap: ${token.marketCap.toLocaleString()}</div>
              </div>
            </div>

            {/* Eligibility checks */}
            <div className="space-y-1.5">
              {checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {check.pass ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className={check.pass ? "text-foreground" : "text-red-400"}>{check.label}</span>
                  <span className="text-muted-foreground ml-auto">{check.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Vault Configuration */}
      {token && eligible && (
        <div className="bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Fund Your Vault</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Deposit USDT as your vault (min $500). This capital backs trader PnL and determines your market parameters.
          </p>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vault Deposit (USDT)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                value={vaultAmount}
                onChange={(e) => setVaultAmount(e.target.value)}
                min={500}
                className="w-full pl-8 pr-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[500, 600, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setVaultAmount(String(amt))}
                  className={cn(
                    "flex-1 py-1.5 rounded text-[10px] font-bold border transition-all",
                    vaultAmount === String(amt)
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-secondary border-border/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  ${amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Lock Duration */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Lock className="h-3 w-3" /> Lock Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {LOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setLockDays(opt.days)}
                  className={cn(
                    "py-2 rounded-lg text-center border transition-all",
                    lockDays === opt.days
                      ? "bg-primary/20 border-primary/40"
                      : "bg-secondary border-border/50 hover:border-border"
                  )}
                >
                  <div className="text-xs font-bold text-foreground">{opt.days}d</div>
                  <div className={cn("text-[9px] font-bold", opt.color)}>{opt.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview Parameters */}
          <div className="bg-secondary/50 border border-border/30 rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Info className="h-3 w-3" /> Market Parameters Preview
            </div>
            <Row label="Vault Size" value={`$${vault.toLocaleString()} USDT`} />
            <Row label="Max Leverage" value={`${vault >= 1000 ? "7" : vault >= 600 ? "5" : "2"}x`} />
            <Row label="Max Position" value={`$${maxPosition.toFixed(0)} per trade`} />
            <Row label="Max Open Interest" value={`$${vault.toLocaleString()}`} />
            <Row label="Spread" value={`${vault >= 5000 ? "0.20" : vault >= 2000 ? "0.25" : vault >= 1000 ? "0.30" : vault >= 600 ? "0.40" : "0.50"}%`} />
            <Row label="Fee" value="0.30% per side (min $1)" />
            <Row label="Insurance Reserve" value={`$${(vault * 0.1).toFixed(0)}`} />
            <Row label="Trust Badge" value={selectedLock.badge} valueClass={selectedLock.color} />
          </div>
        </div>
      )}

      {/* Step 3: Deploy */}
      {token && eligible && (
        <div className="bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Deploy Market</h3>
          </div>

          {!walletAddress ? (
            <button
              onClick={login}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition-all"
            >
              Connect Wallet to Continue
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating Market...</>
              ) : (
                <><Rocket className="h-4 w-4" /> Launch {token.symbol}/USDT Perpetual Market</>
              )}
            </button>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Your vault deposit will be locked for {lockDays} days. You'll earn {60}% of all trading fees generated.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground font-medium", valueClass)}>{value}</span>
    </div>
  );
}
