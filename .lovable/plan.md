

# Complete Mobile Trading Terminal Redesign — Binance-Killer

## Overview
A ground-up rewrite of `MobileTradePanelV2` and `AdvancedSettingsSheet`, plus restructuring the mobile layout in `FunTokenDetailPage.tsx`, to achieve a compact, high-density, professional mobile trading experience inspired by Binance's precision but with premium polish.

## Current Problems
- BUY/SELL buttons are `h-14` (56px), inputs `h-16` (64px), chips `h-12` (48px) — all oversized
- `rounded-2xl` everywhere (16px radius) looks bubbly/childish
- Neon glows (`shadow-[0_0_20px...]`, `shadow-[0_0_24px...]`) feel cheap
- Too much vertical space consumed → requires scrolling to see full trade form
- `AdvancedSettingsSheet` uses `rounded-2xl`, `h-12` buttons, `h-14` rows — bloated
- Font sizes (text-2xl for input, text-base for labels) are too large for a pro terminal

## Design Targets

```text
┌─────────────────────────┐
│ ← BREAD $BREAD    LIVE  │ 44px header
│ $0.00000002  -0.1%      │ 48px price row
├─────────────────────────┤
│ MCAP│VOL24│HOLD│BOND 0.9│ 36px stats strip
├─────────────────────────┤
│ [BUY] [SELL]        ⚙   │ 36px segmented
│ You pay    0.905 SOL avl│ 
│ ┌───────────────── MAX┐ │ 40px input
│ │ 0.00                │ │
│ └─────────────────────┘ │
│ 0.1  0.5  1  5  SOL     │ 32px chips
│ ≈123,456 BREAD          │ 
│ Impact 0.2% · Fee 0.003 │ compact preview
│ ◉MEV ◉Anti-SW    1% slp│ inline toggles
├─────────────────────────┤
│ [■■■ BUY 0.5 SOL ■■■]  │ 44px action
└─────────────────────────┘
```

## Files to Modify

### 1. `src/components/launchpad/MobileTradePanelV2.tsx` — Full Rewrite
**Key dimension changes:**
- BUY/SELL toggle: `h-14` → `h-9` (36px), segmented pill control, `rounded-lg`, no glow
- Amount input: `h-16 text-2xl` → `h-10 text-base`, `rounded-lg`
- Quick chips: `h-12 rounded-2xl` → `h-8 rounded-md` (32px), 4 chips + MAX inline
- Preview block: `p-4 rounded-2xl` → `p-2.5 rounded-lg`, `text-sm` → `text-xs`
- Action button: `h-14 rounded-2xl` → `h-11 rounded-lg`, no neon glow shadows
- Labels: `text-sm` → `text-[11px]`, `text-lg` → `text-sm`
- Gaps: `gap-4` → `gap-2.5`, padding `p-4` → `p-2.5`
- Remove all `shadow-[0_0_*]` neon glows
- Add inline slippage display + MEV/Anti-Sandwich micro indicators
- Move settings gear icon inline (top-right of trade panel) instead of separate 48x48 button
- Colors: muted green `bg-emerald-500/12` not `bg-green-500/15`, muted red `bg-red-500/12`

**New layout structure:**
```tsx
<div className="flex flex-col gap-2.5">
  {/* Segmented BUY/SELL — 36px */}
  <div className="flex h-9 rounded-lg bg-muted/30 border border-border/40 p-0.5 relative">
    {/* Sliding indicator + BUY/SELL buttons */}
  </div>
  
  {/* Amount section */}
  <div className="space-y-1.5">
    <div className="flex justify-between text-[11px]">...</div>
    <div className="relative">
      <input className="h-10 text-base rounded-lg" />
      <button className="MAX">...</button>
    </div>
  </div>
  
  {/* Compact chips — 32px */}
  <div className="flex gap-1.5">
    {chips.map(...)} {/* h-8 rounded-md */}
  </div>
  
  {/* Preview — compact */}
  {amount > 0 && <div className="p-2.5 rounded-lg text-xs">...</div>}
  
  {/* Inline indicators */}
  <div className="flex items-center justify-between text-[10px]">
    <span>◉ MEV · ◉ Anti-SW</span>
    <span>Slippage {slippage}%</span>
  </div>
  
  {/* Action button — 44px */}
  <button className="h-11 rounded-lg font-semibold text-sm">
    BUY 0.5 SOL
  </button>
</div>
```

### 2. `src/components/launchpad/AdvancedSettingsSheet.tsx` — Compact Rewrite
- Trigger: `h-12 w-12 rounded-2xl` → `h-8 w-8 rounded-lg` gear icon
- Sheet: `rounded-t-3xl` → `rounded-t-xl`, `max-h-[85vh]` → `max-h-[70vh]`
- Slippage chips: `h-12 min-w-[56px] rounded-2xl` → `h-8 min-w-[44px] rounded-md text-xs`
- Custom input: `h-12 rounded-2xl` → `h-9 rounded-lg`
- Toggle rows: `h-14 rounded-2xl` → `h-10 rounded-lg text-xs`
- Section titles: `text-sm` → `text-[10px]`
- PNL button: `h-14 rounded-2xl` → `h-10 rounded-lg`

### 3. `src/pages/FunTokenDetailPage.tsx` — Mobile Layout Refinements
- Phone stats grid: `trade-stat-card` inner padding reduced
- Tab switcher: `min-h-[48px]` → `min-h-[36px]`, `py-3` → `py-2`
- Bonding bar section: `px-4 py-3` → `px-3 py-2`
- Tighten gap between sections: `gap-2.5` → `gap-1.5` for phone layout

### 4. `src/index.css` — Trade Theme Refinements
- Reduce `trade-stat-card` padding and border-radius
- Tone down hover animations (remove `translateY(-2px) scale(1.02)`)
- Add new `.trade-input-compact` class for the petite input style
- Add `.trade-chip` class for uniform 32px preset chips

## Technical Notes
- **No framework changes** — this is purely React + Tailwind, no React Native/Expo (project is a web app)
- All existing logic (swap execution, balance fetching, Jupiter quotes, RugCheck safety) stays unchanged — only the UI shell is rewritten
- `AdvancedSettingsSheet` keeps same props interface, just visual redesign
- Mobile detection via existing `useIsMobile` hook — desktop layout untouched
- Maintains all accessibility (touch targets ≥ 44px CSS px with padding, focus states)

