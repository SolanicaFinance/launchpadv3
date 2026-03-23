

## Problem Analysis

UniSat wallet extension injects `window.unisat` but **does not inject into iframes**. The Lovable preview runs inside an iframe, which is why Phantom is detected (it injects everywhere) but UniSat is not. This is a known limitation documented in UniSat's own developer docs and reported by other developers (e.g., itch.io embeds).

The published URL (`saturntrade.lovable.app`) runs at top-level and **should** detect UniSat correctly. The repeated failures are because testing happens in the Lovable preview iframe.

## Plan

### 1. Add diagnostic logging to wallet detection
Add `console.log` statements that dump `window.unisat`, `window.self !== window.top` (iframe check), and all detected wallet keys. This will confirm the root cause definitively on next run.

### 2. Make UniSat always clickable (never just an install link)
Even when `window.unisat` is undefined (iframe context), show UniSat as a primary clickable button — not an external "install" link. When clicked in an iframe:
- Attempt direct access to `window.unisat` first (in case it loaded late)
- If still missing, open the **published app URL** in a new tab with a toast message explaining "UniSat can't connect in preview mode — opening in a new tab"

### 3. Deprioritize other wallets
- Move Phantom, Xverse, Leather, OKX into a collapsed "Other wallets" section
- UniSat always appears first and prominently, regardless of detection status
- Show a subtle "Recommended" badge on UniSat

### 4. Improve iframe-aware UX in the modal
- If running in iframe, show a small banner: "For best wallet detection, open in a new tab" with a button
- UniSat row shows "Click to connect" instead of external link icon when in iframe

### Files to modify
- **`src/hooks/useBtcWallet.ts`** — Add console.log diagnostics, make UniSat always report as "available" (clickable), handle iframe connect gracefully
- **`src/components/bitcoin/BtcConnectWalletModal.tsx`** — Reorder UI to show UniSat first and prominently, add iframe banner, collapse other wallets

