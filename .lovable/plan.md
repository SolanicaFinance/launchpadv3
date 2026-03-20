

# Bonding Curve Lab — Full Implementation Plan

## Overview

Build an isolated `/lab/bonding-curve` page with the full custom bonding curve testing environment, plus a comprehensive deployment guide document so you can launch the Anchor program when ready.

## What Gets Built

### 1. Deployment Guide (`SATURN_CURVE_DEPLOY_GUIDE.md`)

Step-by-step instructions covering:

- **Prerequisites**: Install Rust, Solana CLI, Anchor CLI
- **Program structure**: Full Anchor program source for `saturn-curve` with 5 instructions: `initialize`, `create_pool`, `swap`, `graduate`, `update_config`
- **Local build**: `anchor build`, get program ID, update `declare_id!`
- **Devnet deploy**: `anchor deploy --provider.cluster devnet`
- **Mainnet deploy**: `anchor deploy --provider.cluster mainnet-beta` (costs ~3-5 SOL)
- **Post-deploy**: Copy program ID into `lib/config.ts` / edge function env vars
- **Testing checklist**: Create pool → buy to graduation → verify DAMM V2 migration → verify LP lock

### 2. Anchor Program Source (`programs/saturn-curve/`)

Full Rust source code ready to build locally:

**State accounts:**
- `GlobalConfig` — admin, platform fee wallet, graduation threshold (1 SOL test / 85 SOL prod)
- `Pool` — mint, creator, virtual/real reserves, fees, status (active/graduated), holder count

**Instructions:**
- `initialize` — set global config (admin-only)
- `create_pool` — mint token, create pool PDA + vaults, set virtual reserves (30 SOL / 1B tokens)
- `swap` — constant product AMM math with fee deduction, emit `SwapEvent`
- `graduate` — check threshold met, mark graduated, unlock vaults for server-side Meteora migration
- `update_config` — admin changes threshold/fees

**Events emitted** (for DexScreener/Birdeye indexing):
- `PoolCreated`, `SwapExecuted`, `PoolGraduated`

### 3. Lab Page (`src/pages/BondingCurveLabPage.tsx`)

Password-protected page with 5 tabs:

**Create Pool tab** — Name, ticker, image, graduation threshold slider (default 1 SOL), fee config, virtual reserves display

**Trade tab** — Pool selector, buy/sell with live price from `x*y=k`, price impact, slippage, trade history

**Pool State tab** — Real-time reserves, current price, market cap, bonding progress bar, holder count, dev holdings %, volume, King of the Hill badge (>50%)

**Graduation Monitor tab** — Status badge, progress to threshold, manual "Graduate" button, migration steps checklist (create metadata → create locker → migrate to DAMM V2 → lock LP 100%), post-graduation pool address and LP lock proof

**Config tab** — Toggle test/prod threshold, fee bps, platform wallet, deploy status

### 4. Database Tables

**`lab_pools`** — id, name, ticker, mint_address, pool_address, virtual_sol_reserves, virtual_token_reserves, real_sol_reserves, real_token_reserves, graduation_threshold_sol, bonding_progress, price_sol, market_cap_sol, volume_total_sol, holder_count, status (active/graduated), graduated_at, damm_pool_address, lp_locked, lp_lock_tx, created_at

**`lab_trades`** — id, pool_id (FK), wallet_address, is_buy, sol_amount, token_amount, price_at_trade, created_at

### 5. Edge Functions

- `saturn-curve-create` — Creates pool record, mints token (or simulates), initializes virtual reserves
- `saturn-curve-swap` — Calculates swap output via constant product math, updates reserves, records trade
- `saturn-curve-graduate` — Triggers Meteora DAMM V2 migration using existing `migratePool()` logic, locks 100% LP

### 6. TypeScript SDK (`src/lib/saturn-curve.ts`)

Client-side helpers:
- `getQuote(pool, solAmount, isBuy)` — price calculation from reserves
- `getProgress(pool)` — bonding progress percentage
- `formatPoolMetrics(pool)` — market cap, price, holder stats

### 7. Route & Navigation

- Add `/lab/bonding-curve` route to `App.tsx`
- Add "Lab" link with Flask icon to Sidebar (below Meteorite)

## Key Professional Features (bags.fm / pump.fun parity)

| Feature | Implementation |
|---|---|
| Bonding progress bar | `real_sol / graduation_threshold * 100` |
| Market cap | `price_sol × total_supply × SOL_USD` |
| King of the Hill | Badge when progress > 50% |
| Holder count | Count distinct wallets in lab_trades |
| Dev holdings % | Creator balance / total supply |
| LP Lock after graduation | 100% LP locked forever via Meteora locker |
| LP Lock proof | On-chain tx signature displayed |
| Token age | Human-readable time since creation |

## Files Created/Modified

| File | Action |
|---|---|
| `programs/saturn-curve/src/lib.rs` | Create — full Anchor program source |
| `programs/saturn-curve/Anchor.toml` | Create — Anchor config |
| `programs/saturn-curve/Cargo.toml` | Create — Rust dependencies |
| `SATURN_CURVE_DEPLOY_GUIDE.md` | Create — A-Z deployment instructions |
| `src/pages/BondingCurveLabPage.tsx` | Create — lab page |
| `src/components/lab/*.tsx` | Create — 5 tab components |
| `src/lib/saturn-curve.ts` | Create — client SDK |
| `src/App.tsx` | Modify — add route |
| `src/components/layout/Sidebar.tsx` | Modify — add Lab link |
| DB migration | Create `lab_pools` and `lab_trades` tables |
| 3 edge functions | Create saturn-curve-create/swap/graduate |

## Zero Production Impact

- No changes to `/launchpad`, `/launch`, `/trade` routes
- No changes to `useTokenLaunch`, `useMeteoraApi`, `useRealSwap`
- No changes to `api/pool/create.ts` or `api/swap/execute.ts`
- Lab uses its own tables, edge functions, and components

## Implementation Order

1. Database migration (lab_pools, lab_trades)
2. Anchor program source + deploy guide
3. Edge functions (create, swap, graduate)
4. Client SDK + lab page with all 5 tabs
5. Route and sidebar integration

