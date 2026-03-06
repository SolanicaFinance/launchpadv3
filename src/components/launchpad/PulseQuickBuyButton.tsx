import { memo, useState, useCallback } from "react";
import { Zap, Loader2, ArrowDownToLine } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFastSwap } from "@/hooks/useFastSwap";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { toast } from "sonner";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import type { Token } from "@/hooks/useLaunchpad";
import type { FunToken } from "@/hooks/useFunTokensPaginated";
import type { CodexPairToken } from "@/hooks/useCodexNewPairs";

const PRESET_AMOUNTS = [0.1, 0.5, 1, 2];

interface PulseQuickBuyButtonProps {
  /** Pass either a FunToken or CodexPairToken - will be bridged to Token internally */
  funToken?: FunToken;
  codexToken?: CodexPairToken;
  /** When provided, clicking Buy executes immediately with this amount */
  quickBuyAmount?: number;
  /** Compact style for table/list views */
  isCompact?: boolean;
}

function bridgeFunToken(t: FunToken): Token {
  return {
    id: t.id,
    mint_address: t.mint_address ?? "",
    name: t.name,
    ticker: t.ticker,
    description: t.description,
    image_url: t.image_url,
    website_url: t.website_url ?? null,
    twitter_url: t.twitter_url ?? null,
    telegram_url: null,
    discord_url: null,
    creator_wallet: t.creator_wallet,
    creator_id: null,
    dbc_pool_address: t.dbc_pool_address ?? null,
    damm_pool_address: null,
    virtual_sol_reserves: 0,
    virtual_token_reserves: 0,
    real_sol_reserves: 0,
    real_token_reserves: 0,
    total_supply: 0,
    bonding_curve_progress: t.bonding_progress ?? 0,
    graduation_threshold_sol: 0,
    price_sol: t.price_sol ?? 0,
    market_cap_sol: t.market_cap_sol ?? 0,
    volume_24h_sol: t.volume_24h_sol ?? 0,
    status: (t.status === "graduated" ? "graduated" : "bonding") as Token["status"],
    migration_status: "",
    holder_count: t.holder_count ?? 0,
    created_at: t.created_at,
    updated_at: t.created_at,
    graduated_at: null,
  };
}

function bridgeCodexToken(t: CodexPairToken): Token {
  return {
    id: t.address ?? "",
    mint_address: t.address ?? "",
    name: t.name,
    ticker: t.symbol,
    description: null,
    image_url: t.imageUrl,
    website_url: t.websiteUrl ?? null,
    twitter_url: t.twitterUrl ?? null,
    telegram_url: t.telegramUrl ?? null,
    discord_url: t.discordUrl ?? null,
    creator_wallet: "",
    creator_id: null,
    dbc_pool_address: t.poolAddress ?? null,
    damm_pool_address: null,
    virtual_sol_reserves: 0,
    virtual_token_reserves: 0,
    real_sol_reserves: 0,
    real_token_reserves: 0,
    total_supply: 0,
    bonding_curve_progress: t.graduationPercent ?? 0,
    graduation_threshold_sol: 0,
    price_sol: 0,
    market_cap_sol: 0,
    volume_24h_sol: 0,
    status: (t.migrated ? "graduated" : "bonding") as Token["status"],
    migration_status: "",
    holder_count: t.holders ?? 0,
    created_at: "",
    updated_at: "",
    graduated_at: null,
  };
}

export const PulseQuickBuyButton = memo(function PulseQuickBuyButton({
  funToken,
  codexToken,
  quickBuyAmount,
  isCompact,
}: PulseQuickBuyButtonProps) {
  const { executeFastSwap, isLoading, lastLatencyMs, walletAddress } = useFastSwap();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [buyingAmount, setBuyingAmount] = useState<number | null>(null);
  const [isSelling, setIsSelling] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const mintAddress = funToken?.mint_address ?? codexToken?.address ?? null;

  // Fetch on-chain token balance for sell button
  const { data: tokenBalance } = useQuery({
    queryKey: ["quick-sell-balance", walletAddress, mintAddress],
    queryFn: async () => {
      if (!walletAddress || !mintAddress) return 0;
      try {
        const connection = new Connection(getRpcUrl().url, "confirmed");
        const owner = new PublicKey(walletAddress);
        const mint = new PublicKey(mintAddress);
        const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
        const account = resp.value[0];
        return account?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
      } catch {
        return 0;
      }
    },
    enabled: !!isAuthenticated && !!walletAddress && !!mintAddress,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const handleTriggerClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }
      if (quickBuyAmount && quickBuyAmount > 0) {
        const token = funToken ? bridgeFunToken(funToken) : codexToken ? bridgeCodexToken(codexToken) : null;
        if (!token || !token.mint_address) {
          toast.error("Token address not available");
          return;
        }
        setBuyingAmount(quickBuyAmount);
        executeFastSwap(token, quickBuyAmount, true, 500)
          .then((result) => {
            if (result.success) {
              toast.success(`Bought with ${quickBuyAmount} SOL`, {
                description: result.signature ? `TX: ${result.signature.slice(0, 8)}... · ${lastLatencyMs || ''}ms` : undefined,
                action: result.signature
                  ? { label: "View", onClick: () => window.open(`https://solscan.io/tx/${result.signature}`, "_blank") }
                  : undefined,
              });
              queryClient.invalidateQueries({ queryKey: ["quick-sell-balance", walletAddress, mintAddress] });
            }
          })
          .catch((err: any) => {
            console.error("[PulseQuickBuy] swap failed:", err);
            toast.error("Swap failed", { description: err?.message?.slice(0, 80) || "Unknown error" });
          })
          .finally(() => setBuyingAmount(null));
        return;
      }
      setOpen((prev) => !prev);
    },
    [isAuthenticated, quickBuyAmount, funToken, codexToken, executeFastSwap, walletAddress, mintAddress, queryClient],
  );

  const handleBuy = useCallback(
    async (amount: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const token = funToken ? bridgeFunToken(funToken) : codexToken ? bridgeCodexToken(codexToken) : null;
      if (!token || !token.mint_address) {
        toast.error("Token address not available");
        return;
      }

      setBuyingAmount(amount);

      try {
        const result = await executeFastSwap(token, amount, true, 500);
        if (result.success) {
          toast.success(`Bought with ${amount} SOL`, {
            description: result.signature
              ? `TX: ${result.signature.slice(0, 8)}... · ${lastLatencyMs || ''}ms`
              : undefined,
            action: result.signature
              ? {
                  label: "View",
                  onClick: () => window.open(`https://solscan.io/tx/${result.signature}`, "_blank"),
                }
              : undefined,
          });
          queryClient.invalidateQueries({ queryKey: ["quick-sell-balance", walletAddress, mintAddress] });
        }
      } catch (err: any) {
        console.error("[PulseQuickBuy] swap failed:", err);
        toast.error("Swap failed", {
          description: err?.message?.slice(0, 80) || "Unknown error",
        });
      } finally {
        setBuyingAmount(null);
        setOpen(false);
      }
    },
    [funToken, codexToken, executeFastSwap, walletAddress, mintAddress, queryClient],
  );

  const handleSell100 = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isAuthenticated) {
        setShowLoginModal(true);
        return;
      }

      const token = funToken ? bridgeFunToken(funToken) : codexToken ? bridgeCodexToken(codexToken) : null;
      if (!token || !token.mint_address) {
        toast.error("Token address not available");
        return;
      }

      if (!tokenBalance || tokenBalance <= 0) {
        toast.error("No tokens to sell");
        return;
      }

      setIsSelling(true);
      try {
        const result = await executeFastSwap(token, tokenBalance, false, 500);
        if (result.success) {
          const ticker = funToken?.ticker ?? codexToken?.symbol ?? 'tokens';
          const name = funToken?.name ?? codexToken?.name ?? '';
          const imageUrl = funToken?.image_url ?? codexToken?.imageUrl ?? '';
          toast.success(`Sold 100% of $${ticker}`, {
            description: `${name}${result.signature ? ` · TX: ${result.signature.slice(0, 8)}...` : ''}${lastLatencyMs ? ` · ${lastLatencyMs}ms` : ''}`,
            icon: imageUrl ? undefined : undefined,
            action: result.signature
              ? { label: "View", onClick: () => window.open(`https://solscan.io/tx/${result.signature}`, "_blank") }
              : undefined,
          });
          queryClient.invalidateQueries({ queryKey: ["quick-sell-balance", walletAddress, mintAddress] });
        }
      } catch (err: any) {
        console.error("[PulseQuickSell] sell failed:", err);
        toast.error("Sell failed", { description: err?.message?.slice(0, 80) || "Unknown error" });
      } finally {
        setIsSelling(false);
      }
    },
    [isAuthenticated, funToken, codexToken, tokenBalance, executeFastSwap, walletAddress, mintAddress, queryClient],
  );

  const isBusy = isLoading || buyingAmount !== null || isSelling;
  const hasBalance = (tokenBalance ?? 0) > 0;

  return (
    <>
      <NotLoggedInModal open={showLoginModal} onOpenChange={setShowLoginModal} />

      {hasBalance ? (
        /* Sell 100% — replaces Buy when user holds tokens */
        <button
          type="button"
          onClick={handleSell100}
          disabled={isBusy}
          className={isCompact
            ? "discover-quick-buy-btn pulse-sell-btn bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/20 hover:border-red-500/40"
            : "pulse-sol-btn pulse-sell-btn"
          }
        >
          {isSelling ? (
            <Loader2 className={isCompact ? "h-3 w-3 animate-spin" : "h-2.5 w-2.5 animate-spin"} />
          ) : (
            <ArrowDownToLine className={isCompact ? "h-3 w-3" : "h-2.5 w-2.5"} />
          )}
          <span>{isSelling ? "Selling..." : "Sell 100%"}</span>
        </button>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={handleTriggerClick}
              className={isCompact ? "discover-quick-buy-btn" : "pulse-sol-btn"}
              disabled={isBusy}
            >
              {(isLoading || buyingAmount !== null) ? (
                <Loader2 className={isCompact ? "h-3 w-3 animate-spin" : "h-2.5 w-2.5 animate-spin"} />
              ) : (
                <Zap className={isCompact ? "h-3 w-3" : "h-2.5 w-2.5"} />
              )}
              <span>{(isLoading || buyingAmount !== null) ? "Buying..." : quickBuyAmount ? `${quickBuyAmount} SOL` : "Buy"}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-2 bg-card border-border"
            side="top"
            align="end"
            sideOffset={6}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex items-center gap-1.5">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => handleBuy(amt, e)}
                  className="px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {buyingAmount === amt ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    `${amt} SOL`
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
});
