

## Two Issues to Fix

### 1. Trade Success Toast -- Use the Same Radix Toast Style as Announcements

The trade success toast (line 133 in `TradePanelWithSwap.tsx`) already uses the Radix `useToast` system which renders through the styled `toast.tsx` component. The announcements, however, use **Sonner** (`toast()` from `sonner`), which has a completely different, simpler appearance.

**Plan:** Migrate the announcement toasts in `useAnnouncements.ts` to use the Radix `useToast` system (from `@/hooks/use-toast`) so both announcements and trade success notifications share the same professional dark glass style. Since `useAnnouncements` is a hook, it can import the `toast` function from `use-toast.ts` directly.

Alternatively (and more practically): the trade success toast already looks professional. The user likely wants both to look the same. The simplest approach is to ensure the trade toasts use the `variant: "success"` for the green styled variant already defined in `toast.tsx`.

**Changes:**
- `src/components/launchpad/TradePanelWithSwap.tsx`: Add `variant: "success"` to the trade success toast call (line 133).

### 2. Alpha Tracker Shows No Trades from the Platform

The `alpha_trades` table is never populated by any code path. The `launchpad-swap` edge function records trades into `launchpad_transactions` but never inserts into `alpha_trades`. The Alpha Tracker feed reads exclusively from `alpha_trades`.

**Plan:** Add an insert into `alpha_trades` inside the `launchpad-swap` edge function after every successful trade recording (both in "record" mode and in the standard swap flow). This will populate the Alpha Tracker with platform trades in real-time.

**Changes:**
- `supabase/functions/launchpad-swap/index.ts`: After recording a transaction in `launchpad_transactions`, also insert a row into `alpha_trades` with the relevant fields (wallet_address, token_mint, token_name, token_ticker, trade_type, amount_sol, amount_tokens, price_usd, tx_hash, trader_display_name, trader_avatar_url). This needs to happen in both the "record" mode block (~line 161) and the standard swap block.

### Technical Details

**alpha_trades schema** (from types.ts):
- `wallet_address`, `token_mint`, `token_name`, `token_ticker`, `trade_type`, `amount_sol`, `amount_tokens`, `price_usd`, `tx_hash`, `created_at`, `trader_display_name`, `trader_avatar_url`

**Data available in launchpad-swap:**
- `userWallet` -> `wallet_address`
- `token.mint_address` -> `token_mint`  
- `token.name` -> `token_name`
- `token.ticker` -> `token_ticker`
- `isBuy ? "buy" : "sell"` -> `trade_type`
- `solAmount` -> `amount_sol`
- `tokenAmount` -> `amount_tokens`
- `newPrice` -> can derive `price_usd` (if SOL price available, otherwise null)
- `clientSignature` / generated signature -> `tx_hash`
- Profile lookup for display name/avatar

**Files to modify:**
1. `src/components/launchpad/TradePanelWithSwap.tsx` -- add `variant: "success"` to trade success toast
2. `supabase/functions/launchpad-swap/index.ts` -- insert into `alpha_trades` after each successful trade

