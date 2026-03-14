

## Plan: Mobile-First Trade Screen Redesign

### Problem
The current mobile trade view (`/trade/:mint`) crams too many elements into a small screen: tiny 8-10px fonts, slippage presets always visible, MEV/safety indicators cluttering the main flow, advanced settings open by default, and small touch targets. This makes trading slow and confusing on mobile.

### Approach
Create a new `MobileTradePanelV2` component used exclusively on mobile (< 768px), keeping the existing desktop/tablet panels untouched. Redesign the mobile layout in `FunTokenDetailPage` to follow a clean vertical flow with large touch targets.

### Architecture

**New file: `src/components/launchpad/MobileTradePanelV2.tsx`**
A mobile-optimized trade panel that wraps the existing swap logic (reuses `useRealSwap`, `useJupiterSwap`, `usePumpFunSwap`) with a completely new UI:

- **Large segmented BUY/SELL toggle** (min 48px tall, full-width, green/red tint backgrounds)
- **Amount input** with big 24px font, clear balance display (16px), prominent MAX button
- **Large preset chips** (0.1 / 0.5 / 1 / 5 SOL) — 48px tall rounded pills with SOL icon, evenly spaced
- **Live preview card** below input: "You get ≈ X,XXX EGG" + price impact + fee — always visible when amount > 0
- **Hidden advanced settings**: slippage (default 1%), MEV protection (default ON), safety checks — all behind a small gear icon that opens a bottom sheet (`Sheet` component)
- **Giant action button** at bottom: full-width, 56px tall, BUY or SELL with token icon

**Modified file: `src/pages/FunTokenDetailPage.tsx`** (mobile section only)
Restructure the `md:hidden` mobile layout:

1. **Sticky header** — token avatar + name + ticker + live price + 24h change badge (compact, one line)
2. **Stats row** — 3 compact cards (MCAP / VOL / HOLDERS) in a horizontal grid, 14px values
3. **Bonding curve bar** — full-width gradient bar with percentage, smooth animation
4. **Swipeable tabs**: Trade | Chart (larger 48px touch targets)
5. **Trade tab** → renders `MobileTradePanelV2`
6. **Chart tab** → full-height CodexChart
7. **Fixed bottom bar** — price + BUY/SELL buttons (kept but enlarged to 48px min-height)

**New file: `src/components/launchpad/AdvancedSettingsSheet.tsx`**
A `Sheet` (bottom drawer) containing:
- Slippage presets (0.5 / 1 / 2 / 5 / 10 / custom)
- Jito MEV Protection toggle (default ON)
- Anti-sandwich toggle (default ON)
- Safety checks grid (RugCheck data)
- Share PNL button

### Key Design Specs
- Font sizes: headers 20-24px, body 16px, labels 12-13px (no sub-10px text on mobile)
- Touch targets: all buttons min 48×48px
- Colors: buy = `#84cc16` (lime), sell = `#ef4444` (red), background cosmic dark
- Border radius: 16px cards, 12px buttons, 24px pills
- Spacing: 16-20px gaps between sections
- Typography: `font-mono` for prices/numbers, `font-sans` for labels

### Files Changed
1. **New**: `src/components/launchpad/MobileTradePanelV2.tsx` — mobile-optimized trade panel
2. **New**: `src/components/launchpad/AdvancedSettingsSheet.tsx` — bottom sheet for settings
3. **Modified**: `src/pages/FunTokenDetailPage.tsx` — swap mobile section to use new components
4. **Modified**: `src/pages/TokenDetailPage.tsx` — same mobile treatment for bonding tokens

### What Stays the Same
- All swap/trade logic (hooks, RPC calls, balance fetching)
- Desktop and tablet layouts
- `TradePanelWithSwap` and `UniversalTradePanel` remain for desktop/tablet
- All existing functionality (PNL cards, safety checks, etc.)

