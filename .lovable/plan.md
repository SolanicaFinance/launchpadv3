

## Problem

Three issues to fix:

1. **Notifications only work when the Tracker panel is open** — The realtime subscription for `wallet_trades` inserts lives inside `WalletTrackerPanel.tsx`, which unmounts when the panel closes. No notifications fire when browsing normally.

2. **No shake animation on the Tracker icon** — When a tracked wallet trades, the Tracker button in the footer should visually shake to draw attention.

3. **Toast appears on left (default)** — Should appear on the right side of the screen per your request.

## Changes

### 1. Create a global notification hook (`src/hooks/useWalletTradeNotifications.ts`)

- Extracts the realtime subscription logic from `WalletTrackerPanel` into a standalone hook
- Fetches the user's tracked wallets (with `notifications_enabled`) on mount
- Subscribes to `wallet_trades` INSERT events globally
- On match: plays buy/sell sound, shows toast, and calls an `onTrade` callback (for the shake)
- This hook runs regardless of whether the panel is open

### 2. Mount the hook in `StickyStatsFooter.tsx`

- Call `useWalletTradeNotifications({ onTrade })` at the footer level (always mounted)
- The `onTrade` callback triggers a shake state on the Tracker button
- Add a CSS shake animation (keyframes) to the Tracker button icon when `shaking` is true
- Auto-clear the shake after ~1 second

### 3. Move toast position to right side

- Update the `Toaster` component's `position` prop to `"top-right"` (or `"bottom-right"`) so notifications appear on the right

### 4. Clean up duplicate subscription in `WalletTrackerPanel`

- Remove the realtime notification logic from `WalletTrackerPanel.tsx` since the global hook now handles it (keep only the trades-list refresh subscription if needed)

### Files to edit
- **New**: `src/hooks/useWalletTradeNotifications.ts` — global hook
- **Edit**: `src/components/layout/StickyStatsFooter.tsx` — mount hook, add shake animation to Tracker button
- **Edit**: `src/components/layout/WalletTrackerPanel.tsx` — remove duplicate notification subscription
- **Edit**: Toast/Toaster component — set position to right side

