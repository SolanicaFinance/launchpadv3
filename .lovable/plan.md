

## Plan: Copy Trading Info Box, Alerts Toggle with Sound, Realtime Notifications, Tab Persistence

### Issues Found
1. **Copy Trading switch** has no `onCheckedChange` — clicking does nothing
2. **Alerts bell** has no click handler — just decorative icons
3. **No realtime subscription** for wallet trades in the tracker page — no live notifications or sounds
4. **Tab resets to "All"** on every re-render because `activeTab` state resets when `wallets` data refreshes (the `fetchTrades` useEffect depends on `wallets` which changes reference on each fetch)
5. **`useWalletTracker` hook** doesn't expose `toggleNotifications` or `toggleCopyTrading` functions

### Changes

**1. `src/hooks/useWalletTracker.ts` — Add toggle functions**
- Add `toggleNotifications(walletId, enabled)` and `toggleCopyTrading(walletId, enabled)` that call the edge function with `action: "update"`
- Optimistically update local `wallets` state so UI reflects immediately

**2. `src/pages/WalletTrackerPage.tsx` — Four fixes**

a) **Copy Trading info box**: When Copy Trading switch is toggled ON, show an info dialog/banner: "Copy Trading and many other options are available to Holders only." Switch stays off. Use a simple state-driven info box that appears inline or as a small modal.

b) **Alerts bell click handler**: Wire `toggleNotifications` from the hook. When alerts are ON: wallet receives realtime trade notifications with toast + sound. When OFF: no notifications for that wallet.

c) **Realtime subscription**: Add a `useEffect` that subscribes to `postgres_changes` on `wallet_trades` table (INSERT events). When a new trade arrives for a tracked wallet with `notifications_enabled`:
   - Show a toast notification with wallet label, trade type, token, and SOL amount
   - Play buy/sell sound using `useTradeSounds` hook
   - This gives sub-second notification latency since Helius webhook → `wallet_trades` insert → Supabase Realtime → client

d) **Tab persistence**: Prevent tab reset by stabilizing the `wallets` dependency in the `fetchTrades` useEffect. Use a ref or memoize the addresses array so the effect doesn't re-trigger on every wallet fetch.

**3. `src/components/layout/WalletTrackerPanel.tsx` — Same fixes for panel**
- Wire alerts toggle with the hook's `toggleNotifications`
- Copy trade switch shows the same "Holders only" info box
- Add the same realtime subscription for notifications + sounds

**4. Sound integration**
- Import and use `useTradeSounds` in both the page and panel
- On realtime trade INSERT: call `playBuy()` or `playSell()` based on `trade_type`
- The bell toggle per-wallet controls whether that wallet's trades trigger notifications/sounds

### Technical Details
- The realtime channel subscription filters on `wallet_trades` table INSERT events
- On each event, check if `payload.new.wallet_address` matches a tracked wallet with `notifications_enabled === true`
- If yes, show toast + play sound
- Tab state is preserved by removing `wallets` from the `fetchTrades` useEffect dependency (use a ref for addresses instead)

