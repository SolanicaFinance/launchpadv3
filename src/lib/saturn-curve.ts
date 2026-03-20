/**
 * Saturn Curve — Client-side SDK
 * Bonding curve math helpers for the lab testing environment.
 */

export interface LabPool {
  id: string;
  name: string;
  ticker: string;
  image_url?: string | null;
  mint_address?: string | null;
  pool_address?: string | null;
  creator_wallet: string;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  graduation_threshold_sol: number;
  bonding_progress: number;
  price_sol: number;
  market_cap_sol: number;
  volume_total_sol: number;
  holder_count: number;
  status: string;
  graduated_at?: string | null;
  damm_pool_address?: string | null;
  lp_locked?: boolean | null;
  lp_lock_tx?: string | null;
  fee_bps: number;
  created_at: string;
}

export interface LabTrade {
  id: string;
  pool_id: string;
  wallet_address: string;
  is_buy: boolean;
  sol_amount: number;
  token_amount: number;
  price_at_trade: number;
  created_at: string;
}

const TOTAL_SUPPLY = 1_000_000_000; // 1B tokens

/**
 * Calculate swap output using constant product formula.
 * x * y = k where x = virtual_sol + real_sol, y = virtual_tokens
 */
export function getQuote(
  pool: Pick<LabPool, "virtual_sol_reserves" | "virtual_token_reserves" | "real_sol_reserves" | "real_token_reserves" | "fee_bps">,
  amountIn: number,
  isBuy: boolean
): { amountOut: number; priceImpact: number; fee: number; newPrice: number } {
  const totalFeeBps = pool.fee_bps;
  const vsr = pool.virtual_sol_reserves + pool.real_sol_reserves;
  const vtr = pool.virtual_token_reserves;

  if (isBuy) {
    const fee = (amountIn * totalFeeBps) / 10_000;
    const solAfterFee = amountIn - fee;
    const tokensOut = (vtr * solAfterFee) / (vsr + solAfterFee);
    const newVsr = vsr + solAfterFee;
    const newVtr = vtr - tokensOut;
    const newPrice = newVsr / newVtr;
    const oldPrice = vsr / vtr;
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;
    return { amountOut: tokensOut, priceImpact, fee, newPrice };
  } else {
    const solOutGross = (vsr * amountIn) / (vtr + amountIn);
    const fee = (solOutGross * totalFeeBps) / 10_000;
    const solOut = solOutGross - fee;
    const newVsr = vsr - solOutGross;
    const newVtr = vtr + amountIn;
    const newPrice = newVsr / newVtr;
    const oldPrice = vsr / vtr;
    const priceImpact = ((oldPrice - newPrice) / oldPrice) * 100;
    return { amountOut: solOut, priceImpact, fee, newPrice };
  }
}

/** Bonding progress as percentage (0-100) */
export function getProgress(pool: Pick<LabPool, "real_sol_reserves" | "graduation_threshold_sol">): number {
  if (pool.graduation_threshold_sol <= 0) return 100;
  return Math.min((pool.real_sol_reserves / pool.graduation_threshold_sol) * 100, 100);
}

/** Current price in SOL per token */
export function getCurrentPrice(pool: Pick<LabPool, "virtual_sol_reserves" | "virtual_token_reserves" | "real_sol_reserves">): number {
  const totalSol = pool.virtual_sol_reserves + pool.real_sol_reserves;
  const totalTokens = pool.virtual_token_reserves;
  return totalTokens > 0 ? totalSol / totalTokens : 0;
}

/** Market cap in SOL */
export function getMarketCap(pool: Pick<LabPool, "virtual_sol_reserves" | "virtual_token_reserves" | "real_sol_reserves">): number {
  return getCurrentPrice(pool) * TOTAL_SUPPLY;
}

/** Check if pool has reached "King of the Hill" status (>50% progress) */
export function isKingOfTheHill(pool: Pick<LabPool, "real_sol_reserves" | "graduation_threshold_sol">): boolean {
  return getProgress(pool) >= 50;
}

/** Format pool metrics for display */
export function formatPoolMetrics(pool: LabPool, solUsdPrice: number = 150) {
  const price = getCurrentPrice(pool);
  const mcapSol = getMarketCap(pool);
  const progress = getProgress(pool);
  const koth = isKingOfTheHill(pool);

  return {
    priceSol: price,
    priceUsd: price * solUsdPrice,
    marketCapSol: mcapSol,
    marketCapUsd: mcapSol * solUsdPrice,
    progress,
    isKingOfTheHill: koth,
    isGraduated: pool.status === "graduated",
    lpLocked: pool.lp_locked ?? false,
    age: getTimeAgo(pool.created_at),
    volumeSol: pool.volume_total_sol,
    volumeUsd: pool.volume_total_sol * solUsdPrice,
    holderCount: pool.holder_count,
  };
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
