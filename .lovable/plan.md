

## Plan: Fix PnL Accuracy + ProfitCard Branding & Token Icon

### Problems Identified

1. **Fake PnL data**: `ProfitCardModal.tsx` line 36 uses `Math.random()` as fallback when `pnlPercent` is undefined — this generates random fake percentages.
2. **Header shows "SATURN"** — needs to show "SATURN.TRADE" instead.
3. **QR/referral link** uses `window.location.origin` (lovable.app domain) — should use `saturn.trade/`.
4. **No token icon** on the PnL card — only shows a generic planet emoji.
5. **`tokenImageUrl` not passed** to `ProfitCardData` — the interface lacks it and `TradeSuccessPopup` doesn't forward it.

### Changes

**1. `ProfitCardModal.tsx` — Fix PnL + branding + token icon**

- **Remove `Math.random()` fallback** on line 36. If `pnlPercent` is undefined, show `0.00%` (accurate, not fake).
- **Add `tokenImageUrl?: string`** to `ProfitCardData` interface.
- **Header text**: Change from `{BRAND.name}` → `"SATURN.TRADE"` (hardcoded domain display).
- **QR link / referral**: Default to `https://saturn.trade/` instead of `window.location.origin`.
- **Token icon**: In the token info row, render `<img>` of `data.tokenImageUrl` (with fallback to ticker initials) next to the BUY/SELL badge and ticker.

**2. `TradeSuccessPopup.tsx` — Pass `tokenImageUrl` to ProfitCardData**

- Add `tokenImageUrl: data.tokenImageUrl` to the `profitCardData` object (line ~87).

**3. `branding.ts` — Update domain**

- Change `domain: "saturntrade.com"` → `domain: "saturn.trade"` so the brand config reflects the official domain.

