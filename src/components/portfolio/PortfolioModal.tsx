import { useState, useCallback } from "react";
import { X, Briefcase, Loader2, Check, AlertCircle, TrendingDown } from "lucide-react";
import { useLaunchpad, type Token, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";
import { useTurboSwap } from "@/hooks/useTurboSwap";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { useToast } from "@/hooks/use-toast";

type SellStatus = "idle" | "pending" | "success" | "error";

interface HoldingWithToken {
  id: string;
  token_id: string;
  wallet_address: string;
  balance: number;
  tokens: {
    id: string;
    mint_address: string;
    name: string;
    ticker: string;
    image_url: string | null;
    price_sol: number;
    status: string;
    dbc_pool_address: string | null;
    virtual_sol_reserves: number;
    virtual_token_reserves: number;
    real_sol_reserves: number;
    real_token_reserves: number;
    total_supply: number;
    graduation_threshold_sol: number;
    market_cap_sol: number;
    volume_24h_sol: number;
    holder_count: number;
    bonding_curve_progress: number;
  } | null;
}

function holdingToToken(h: HoldingWithToken): Token | null {
  if (!h.tokens) return null;
  return {
    id: h.tokens.id,
    mint_address: h.tokens.mint_address,
    name: h.tokens.name,
    ticker: h.tokens.ticker,
    description: null,
    image_url: h.tokens.image_url,
    website_url: null,
    twitter_url: null,
    telegram_url: null,
    discord_url: null,
    creator_wallet: "",
    creator_id: null,
    dbc_pool_address: h.tokens.dbc_pool_address,
    damm_pool_address: null,
    virtual_sol_reserves: h.tokens.virtual_sol_reserves,
    virtual_token_reserves: h.tokens.virtual_token_reserves,
    real_sol_reserves: h.tokens.real_sol_reserves,
    real_token_reserves: h.tokens.real_token_reserves,
    total_supply: h.tokens.total_supply,
    bonding_curve_progress: h.tokens.bonding_curve_progress,
    graduation_threshold_sol: h.tokens.graduation_threshold_sol,
    price_sol: h.tokens.price_sol,
    market_cap_sol: h.tokens.market_cap_sol,
    volume_24h_sol: h.tokens.volume_24h_sol,
    status: h.tokens.status as Token["status"],
    migration_status: "",
    holder_count: h.tokens.holder_count,
    created_at: "",
    updated_at: "",
    graduated_at: null,
  };
}

interface PortfolioModalProps {
  open: boolean;
  onClose: () => void;
}

export function PortfolioModal({ open, onClose }: PortfolioModalProps) {
  const { walletAddress, getTokenBalance, getTokenBalanceRaw } = useSolanaWalletWithPrivy();
  const { useUserHoldings } = useLaunchpad();
  const { executeTurboSwap: executeFastSwap } = useTurboSwap();
  const { toast } = useToast();

  const { data: holdings = [], isLoading: loadingHoldings } = useUserHoldings(walletAddress);
  const typedHoldings = holdings as HoldingWithToken[];
  const activeHoldings = typedHoldings.filter((h) => h.tokens && h.balance > 0);

  const [sellStatuses, setSellStatuses] = useState<Record<string, SellStatus>>({});
  const [batchSelling, setBatchSelling] = useState(false);

  const sellOne = useCallback(
    async (holding: HoldingWithToken) => {
      const token = holdingToToken(holding);
      if (!token) return;

      setSellStatuses((s) => ({ ...s, [holding.id]: "pending" }));
      try {
        // Fetch real on-chain balance with exact raw precision
        let sellAmount = holding.balance;
        if (token.mint_address) {
          try {
            const { balance } = await getTokenBalanceRaw(token.mint_address);
            console.log(`[Portfolio] DB: ${holding.balance}, On-chain raw: ${balance}`);
            if (balance > 0) sellAmount = balance;
          } catch (e) {
            console.warn("[Portfolio] On-chain balance fetch failed:", e);
          }
        }

        await executeFastSwap(token, sellAmount, false, 1000);
        setSellStatuses((s) => ({ ...s, [holding.id]: "success" }));
        toast({ title: `Sold ${token.ticker}`, description: `${formatTokenAmount(sellAmount)} tokens sold` });
      } catch (e: any) {
        console.error("[Portfolio] Sell failed:", e);
        setSellStatuses((s) => ({ ...s, [holding.id]: "error" }));
        toast({ title: `Failed to sell ${token.ticker}`, description: e?.message?.slice(0, 80) || "Unknown error", variant: "destructive" });
      }
    },
    [executeFastSwap, toast, getTokenBalanceRaw],
  );

  const sellAll = useCallback(async () => {
    setBatchSelling(true);
    for (const holding of activeHoldings) {
      if (sellStatuses[holding.id] === "success") continue;
      await sellOne(holding);
    }
    setBatchSelling(false);
  }, [activeHoldings, sellStatuses, sellOne]);

  if (!open) return null;

  const totalValueSol = activeHoldings.reduce((sum, h) => {
    if (!h.tokens) return sum;
    return sum + h.balance * h.tokens.price_sol;
  }, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh] flex flex-col rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Portfolio</h2>
            {activeHoldings.length > 0 && (
              <span className="text-xs text-muted-foreground font-mono">
                ≈ {formatSolAmount(totalValueSol)} SOL
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Sell All */}
        {activeHoldings.length > 1 && (
          <div className="px-5 py-3 border-b border-border/40">
            <button
              onClick={sellAll}
              disabled={batchSelling}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive font-bold text-[13px] hover:bg-destructive/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {batchSelling ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Selling all positions…</>
              ) : (
                <><TrendingDown className="h-4 w-4" /> Sell All Positions ({activeHoldings.length})</>
              )}
            </button>
          </div>
        )}

        {/* Holdings list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loadingHoldings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeHoldings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No active holdings
            </div>
          ) : (
            activeHoldings.map((h) => {
              const t = h.tokens!;
              const valueSol = h.balance * t.price_sol;
              const status = sellStatuses[h.id] || "idle";

              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors"
                >
                  {/* Token image */}
                  <div className="h-9 w-9 rounded-full bg-muted border border-border overflow-hidden flex-shrink-0">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                        {t.ticker.slice(0, 2)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-foreground truncate">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground">${t.ticker}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatTokenAmount(h.balance)} · ≈ {formatSolAmount(valueSol)} SOL
                    </div>
                  </div>

                  {/* Sell button */}
                  <button
                    onClick={() => sellOne(h)}
                    disabled={status === "pending" || status === "success"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer flex-shrink-0 ${
                      status === "success"
                        ? "bg-green-500/10 text-green-500"
                        : status === "error"
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          : status === "pending"
                            ? "bg-muted text-muted-foreground"
                            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    }`}
                  >
                    {status === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {status === "success" && <Check className="h-3 w-3" />}
                    {status === "error" && <AlertCircle className="h-3 w-3" />}
                    {status === "success" ? "Sold" : status === "error" ? "Retry" : "Sell 100%"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
