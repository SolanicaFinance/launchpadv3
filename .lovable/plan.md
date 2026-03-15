
## Privy-Powered 1-Click Token Launcher 🚀 PLANNED

### Problem
TokenLauncher (3078 lines) uses `usePhantomWallet` — requires Phantom browser extension. 
Rest of the platform already uses Privy embedded wallet. Users shouldn't need Phantom to launch tokens.

### Architecture
1. **Replace `usePhantomWallet` with `useSolanaWalletPrivy`** in TokenLauncher
   - Privy embedded wallet handles all on-chain signing (same as trading)
   - Users logged in via Privy can launch directly — no Phantom popup
   - Logged-out users can still generate memes, prompted to login on Launch

2. **Simplify the "phantom" mode → "launch" mode**
   - Remove Phantom-specific naming (`phantomWallet`, `isPhantomLaunching`, etc.)
   - Rename to generic wallet references since Privy handles everything
   - Keep all sub-modes (random, describe, realistic, custom)

3. **On-chain flow change:**
   ```
   Before: Phantom popup → user signs → broadcast
   After:  Privy embedded wallet → auto-sign (1-click) → broadcast
   ```

4. **Auth gate on launch:**
   - Check `useAuth()` / `usePrivy()` for logged-in state
   - If not logged in → trigger Privy login modal
   - If logged in → use embedded wallet address, sign tx via `useSolanaWalletPrivy`

### Files to modify:
- `src/components/launchpad/TokenLauncher.tsx` — swap wallet hook, remove Phantom refs
- `src/components/panel/PanelPhantomTab.tsx` — rename, use Privy
- `src/pages/CreateTokenPage.tsx` — remove `defaultMode="phantom"` refs
- `src/components/launchpad/CreateTokenModal.tsx` — same
- `src/pages/FunLauncherPage.tsx` — same

### Dependencies:
- `src/hooks/useSolanaWalletPrivy.ts` (already exists, used by trading)
- `src/hooks/useAuth.ts` (already exists)
- Can potentially remove `src/hooks/usePhantomWallet.ts` entirely after migration

---

## Turbo Trade — Server-Side Execution Pipeline ✅ IMPLEMENTED

### What was built:
1. **`supabase/functions/turbo-trade/index.ts`** — Server-side swap pipeline:
   - Resolves wallet from DB cache (skips Privy API when `privy_wallet_id` cached)
   - Builds swap tx via Jupiter Quote + Swap API (works for all tokens)
   - Signs via Privy `signTransaction` (sign-only, ~300ms vs ~1000ms for signAndSend)
   - Broadcasts signed tx in parallel to all 5 Jito regions + Helius RPC
   - Records trade in DB + alpha_trades (non-blocking)
   - Returns signature immediately with timing breakdown

2. **`src/hooks/useTurboSwap.ts`** — Minimal client hook:
   - Single `supabase.functions.invoke('turbo-trade')` call
   - No client-side tx building or signing
   - Background query invalidation after 500ms
   - Logs client roundtrip vs server execution time

3. **Wired into trade components:**
   - `PulseQuickBuyButton.tsx` — uses `useTurboSwap` 
   - `PortfolioModal.tsx` — uses `useTurboSwap`

### Expected latency:
```
Before: Client build (~200ms) + Privy sign (~1000ms) + Privy send (~400ms) = ~1600ms
After:  Edge invoke (~100ms) + Jupiter quote+build (~150ms) + Privy sign-only (~300ms) + broadcast (~1ms) = ~550ms
```

---

## 6-Phase Axiom Feature Integration Plan (SAVED)

### Phase 1: Copy Trade Execution
- New `copy-trade-execute` edge function
- Wire into `wallet-trade-webhook` when `is_copy_trading_enabled = true`
- Add `max_copy_amount_sol`, `copy_slippage_bps`, `cooldown_seconds` to tracked_wallets
- New `copy_trade_log` table

### Phase 2: Limit Orders (SL/TP)
- Jupiter limit order program integration
- `limit-order-create` edge function
- `limit_orders` DB table
- Limit order tab in trade panel

### Phase 3: Real-Time WebSocket Token Feed
- Helius WebSocket for sub-1s new pair detection
- Replace Codex polling (~30s) 
- Edge function → Supabase Realtime channel

### Phase 4: DCA (Dollar Cost Averaging)
- `dca_orders` DB table
- `dca-execute` cron edge function
- DCA tab in trade panel

### Phase 5: Enhanced Token Safety
- LP lock status, mint authority, honeypot detection
- Safety score badge on Pulse cards

### Phase 6: Wallet PnL Analytics
- `wallet-pnl-calculate` edge function
- Per-wallet realized/unrealized PnL
- Rank tracked wallets by performance
