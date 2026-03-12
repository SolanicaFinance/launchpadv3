

# Plan: Replace OpenOcean with Direct PancakeSwap V2 Router

## Problem
OpenOcean returns generic `{code: 500, error: "swap error"}` for many BNB tokens — especially newly graduated Four.meme tokens that have just migrated to PancakeSwap. OpenOcean's indexer is slow to pick up new pairs.

## Root Cause
OpenOcean is an aggregator that relies on its own indexer to discover token pairs. Newly graduated tokens aren't indexed yet, so it returns 500. This is not fixable on our side.

## Solution
Replace OpenOcean with **direct PancakeSwap V2 Router** calls. This is the most reliable approach because:
- **All** Four.meme graduated tokens migrate to PancakeSwap V2 — it's hardcoded in their contracts
- PancakeSwap V2 holds ~80% of BSC DEX liquidity
- No API key needed — it's a direct on-chain smart contract call
- No indexer delay — works the instant liquidity is added
- Supports fee-on-transfer tokens (common in BSC memecoins)

## Changes (single file: `supabase/functions/bnb-swap/index.ts`)

### 1. Add PancakeSwap V2 Router constants
- Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- ABI for `swapExactETHForTokensSupportingFeeOnTransferTokens` (buy) and `swapExactTokensForETHSupportingFeeOnTransferTokens` (sell)

### 2. Replace `executeOpenOceanSwap` with `executePancakeSwap`
- **Buy**: Call `swapExactETHForTokensSupportingFeeOnTransferTokens` with path `[WBNB, tokenAddress]`, `amountOutMin` based on slippage (use `getAmountsOut` to get quote first), deadline 5 min
- **Sell**: Approve router → call `swapExactTokensForETHSupportingFeeOnTransferTokens` with path `[tokenAddress, WBNB]`
- Uses the `SupportingFeeOnTransferTokens` variant to handle tokens with transfer taxes

### 3. Update route resolver
- Change route type from `"openocean"` to `"pancakeswap"` for graduated tokens
- Keep `"portal"` and `"fourmeme"` routes unchanged

### 4. Update fallback chain
- Four.meme revert → fallback to PancakeSwap (instead of OpenOcean)
- PancakeSwap revert on `openocean` route → fallback to Four.meme (same logic, different executor)

### 5. Keep OpenOcean as optional last-resort fallback
- If PancakeSwap also fails (e.g., token is on a different DEX), try OpenOcean as a final attempt
- This covers edge cases where liquidity is on other BSC DEXes

## Execution Flow After Fix

```text
User clicks BUY →
  1. resolveTokenRoute() → portal / fourmeme / pancakeswap
  2. If "pancakeswap":
     a. getAmountsOut() for quote
     b. swapExactETHForTokensSupportingFeeOnTransferTokens()
     c. On revert → try Four.meme fallback
     d. On revert → try OpenOcean last resort
  3. If "fourmeme":
     a. buyTokenAMAP()
     b. On revert → try PancakeSwap fallback
```

## Why This Fixes Everything
- Four.meme graduated tokens → PancakeSwap V2 has them **immediately** (liquidity is added by the migration contract)
- Regular BSC tokens → PancakeSwap V2 has them (dominant DEX)
- No API dependency, no indexer delay, no 500 errors from third-party services

