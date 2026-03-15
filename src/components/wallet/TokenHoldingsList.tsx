import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletHoldings, TokenHolding } from "@/hooks/useWalletHoldings";
import { useTokenMetadata, TokenMetadata } from "@/hooks/useTokenMetadata";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { Search, Loader2, ArrowUpRight, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TokenHoldingsListProps {
  walletAddress: string | null;
  solBalance: number | null;
  onSendToken?: (mint: string, symbol: string, balance: number, decimals: number) => void;
}

export default function TokenHoldingsList({ walletAddress, solBalance, onSendToken }: TokenHoldingsListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: holdings = [], isLoading } = useWalletHoldings(walletAddress);
  const [search, setSearch] = useState("");
  const [sellingMint, setSellingMint] = useState<string | null>(null);

  const mints = holdings.map((h) => h.mint);
  const { data: metadata = {} } = useTokenMetadata(mints);
  const { data: prices = {} } = useTokenPrices(mints);
  const { solPrice } = useSolPrice();
  const { executeTurboSwap } = useTurboSwap();

  const filtered = holdings.filter((h) => {
    if (!search) return true;
    const m = metadata[h.mint];
    const q = search.toLowerCase();
    return (
      h.mint.toLowerCase().includes(q) ||
      m?.name?.toLowerCase().includes(q) ||
      m?.symbol?.toLowerCase().includes(q)
    );
  });

  const formatUsd = (value: number) => {
    if (value < 0.01) return "<$0.01";
    if (value < 1) return `$${value.toFixed(4)}`;
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const handleSell100 = async (h: TokenHolding) => {
    const m = metadata[h.mint];
    const symbol = m?.symbol || "???";

    try {
      setSellingMint(h.mint);
      await executeTurboSwap(
        {
          id: "",
          mint_address: h.mint,
          name: m?.name || "",
          ticker: symbol,
          description: null,
          image_url: m?.image || null,
          website_url: null,
          twitter_url: null,
          telegram_url: null,
          discord_url: null,
          creator_wallet: "",
          creator_id: null,
          dbc_pool_address: null,
          damm_pool_address: null,
          virtual_sol_reserves: 0,
          virtual_token_reserves: 0,
          real_sol_reserves: 0,
          real_token_reserves: 0,
          total_supply: 0,
          bonding_curve_progress: 0,
          graduation_threshold_sol: 0,
          price_sol: 0,
          market_cap_sol: 0,
          volume_24h_sol: 0,
          status: "graduated",
          migration_status: "",
          holder_count: 0,
          created_at: "",
          updated_at: "",
          graduated_at: null,
        },
        h.balance,
        false, // isBuy = false (sell)
        500,
      );
      toast({ title: "Sold!", description: `Sold 100% of ${symbol}` });
      // Refresh holdings
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["wallet-holdings", walletAddress] });
      }, 1500);
    } catch (err: any) {
      toast({ title: "Sell failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSellingMint(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tokens…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-card border-border/50"
        />
      </div>

      {/* SOL row */}
      {solBalance !== null && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            SOL
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Solana</p>
            <p className="text-[11px] text-muted-foreground font-mono">SOL</p>
          </div>
          <div className="text-right mr-2">
            <p className="text-sm font-semibold text-foreground font-mono">{solBalance.toFixed(4)}</p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {formatUsd(solBalance * solPrice)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
            onClick={() => navigate("/swap")}
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            Trade
          </Button>
        </div>
      )}

      {/* Token rows */}
      {filtered.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-6">No tokens found</p>
      )}

      {filtered.map((h) => {
        const m: TokenMetadata | undefined = metadata[h.mint];
        const priceUsd = prices[h.mint] ?? 0;
        const usdValue = priceUsd * h.balance;
        const isSelling = sellingMint === h.mint;

        return (
          <div key={h.mint} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
            {/* Icon */}
            {m?.image ? (
              <img src={m.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-muted" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                {(m?.symbol || "?").slice(0, 3)}
              </div>
            )}

            {/* Name + symbol */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{m?.name || h.mint.slice(0, 8)}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{m?.symbol || "???"}</p>
            </div>

            {/* Balance + USD */}
            <div className="text-right mr-1 shrink-0">
              <p className="text-sm font-semibold text-foreground font-mono">
                {h.balance < 0.0001 ? h.balance.toExponential(2) : h.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
              {priceUsd > 0 && (
                <p className="text-[10px] text-muted-foreground font-mono">{formatUsd(usdValue)}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                onClick={() => navigate(`/token/${h.mint}`)}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Trade
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                disabled={isSelling}
                onClick={() => handleSell100(h)}
              >
                {isSelling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    Sell 100%
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
