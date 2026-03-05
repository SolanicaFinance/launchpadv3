

## Issues to Fix

### 1. Sell tab styling mismatch
When SELL is active, the preset buttons use red/destructive colors but the overall layout is correct. The issue is that the sell tab should show the same structure as buy but with red-tinted elements. Currently missing: the sell tab doesn't show an "INSTA SELL" toggle equivalent, and the label says "Amount to sell" without specifying the token ticker clearly.

### 2. EmbeddedWalletCard shows redundant balance
The card displays a large balance section (3xl font, centered) that duplicates the header balance. Need to remove the balance display and keep only: Deposit, Export Key, Copy Address, and Solscan link. Restyle the entire card to match the trade panel's terminal aesthetic.

### 3. Token Details and Contract boxes use `terminal-panel-flush` but don't match the trade panel style
These boxes below the trade panel use a generic card style. They need the same dark background, border color, font sizes, and density as the trade panel.

## Plan

### File: `src/components/launchpad/EmbeddedWalletCard.tsx`
- Remove the entire balance section (the large "0.0000 SOL" centered block)
- Remove the address row (already shown in header dropdown)
- Restyle as a compact terminal-style card matching the trade panel: `bg-[hsl(var(--card))]`, `border border-border/40 rounded-lg`
- Keep 4 action buttons in a 2x2 grid: **Deposit**, **Export Key**, **Copy Address**, **Solscan**
- Use small mono text, olive/chartreuse accents to match the trade panel aesthetic
- Remove the "Powered by Privy" subtitle, replace header with minimal "Wallet" label

### File: `src/pages/FunTokenDetailPage.tsx`
- Update `TokenDetailsSection` and `ContractSection` to use `border border-border/40 rounded-lg bg-[hsl(var(--card))]` instead of `terminal-panel-flush`
- Match text sizes and spacing to the trade panel density

### Files: `TradePanelWithSwap.tsx` and `UniversalTradePanel.tsx`
- Sell tab: change preset buttons from `destructive` red to a muted red-olive style matching the buy tab's olive-green pattern (red-tinted borders `#5a2a2a`, active fill `#4a1a1a`, text `#ff6666`)
- Ensure sell mode input label says `Amount of ${token.ticker} to sell`

