

# Replace All Connect Wallet Flows with Saturn Panel Redirect Popup

## Overview
Replace every "Connect Wallet" / `login()` call for unauthenticated visitors with a unified popup redirecting to `https://saturn-panel.com`. Ensure full mobile responsiveness.

## Steps

### 1. Redesign `NotLoggedInModal` component
**File:** `src/components/launchpad/NotLoggedInModal.tsx`

- Remove `useAuth` / `login()` — no Privy trigger
- New content:
  - Saturn logo icon
  - "Welcome to Saturn Terminal"
  - "You need to create an account to start leverage trading or creating tokens."
  - Feature list: Leverage Trading, Token Creation, Portfolio Tracking, Copy Trading
  - CTA: "Get Started" → `window.open("https://saturn-panel.com", "_blank")`
- Mobile-first responsive: `w-[calc(100vw-2rem)] max-w-[420px]`, proper padding/text sizes
- Use existing Dialog component (already mobile-friendly with centering)

### 2. Replace `login()` calls in components (10 files)
Add `showLoginModal` state + render `<NotLoggedInModal />` instead of calling `login()`:

- `src/components/launchpad/TradePanel.tsx` — connect button
- `src/components/launchpad/UniversalTradePanel.tsx` — connect button
- `src/components/launchpad/TradePanelWithSwap.tsx` — connect button
- `src/components/launchpad/BnbTradePanel.tsx` — handleSwap
- `src/components/launchpad/QuickTradeButtons.tsx` — handleQuickBuy/handleQuickSell
- `src/components/launchpad/MobileTradePanelV2.tsx` — connect button
- `src/components/launchpad/LaunchpadTokenCreator.tsx` — connect button
- `src/components/launchpad/LaunchTokenForm.tsx` — connect button
- `src/components/launchpad/CopyTrading.tsx` — connect button
- `src/components/layout/WalletTrackerPanel.tsx` — connect button

### 3. Replace `login()` calls in pages (5 files)
Same pattern — add modal state + render:

- `src/pages/PortfolioPage.tsx`
- `src/pages/EarningsPage.tsx`
- `src/pages/RewardsPage.tsx`
- `src/pages/PanelPage.tsx`
- `src/pages/LaunchpadTemplatePage.tsx` (2 instances)

### 4. Mobile considerations
- The `DialogContent` already uses `w-[calc(100vw-2rem)]` which works on mobile
- Feature list items use small text (`text-[10px]`-`text-[11px]`) fitting mobile screens
- CTA button is full-width with proper touch targets (`py-3`, `active:scale-[0.98]`)
- No horizontal overflow issues — all content is vertically stacked

**Note:** Admin pages (`DexListPage`, `TreasuryAdminPage`, etc.) use `handleLogin()` for password-based admin auth — these are unrelated and will NOT be changed.

