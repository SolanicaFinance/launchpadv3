

## Differences Found (Current vs Reference)

### 1. BUY/SELL Tabs
- **Current**: Green background tint with green bottom border
- **Reference**: No background tint, just text + yellow/green underline. More subdued.

### 2. INSTA BUY Toggle Position
- **Current**: Label on left, Switch on right
- **Reference**: Toggle circle on LEFT, "INSTA BUY" text on RIGHT

### 3. Preset Buttons Color
- **Current**: `green-500` borders (bright neon green)
- **Reference**: Olive/army green borders (`~#4a5a2a`), much darker and more muted. Active button has filled olive-green background.

### 4. Input Field
- **Current**: "Amount to buy in SOL" label + green MAX button
- **Reference**: Has ≡ icon prefix in the placeholder. MAX button is more gold/yellow toned (`#c8b400`-ish).

### 5. Price Line
- **Current**: Centered
- **Reference**: Left-aligned

### 6. ADVANCED SETTINGS Text
- **Current**: Left-aligned, gray/muted, tiny text
- **Reference**: Centered, green/yellow color, bold, prominent

### 7. Safety Checks Layout (biggest difference)
- **Current**: Vertical list with tiny check/X icons on the right of each row
- **Reference**: 4 columns in a horizontal row, each with a LARGE green circle ✓ or red circle ✗ icon ABOVE the label text (centered below icon)

### 8. Missing: "Share your P&L" Section
- **Reference** has: "Share your P&L" text + "TWEET ↗" button + "+200" badge

### 9. Missing: Chat/Twitter Tabs
- **Reference** has: CHAT | TWITTER toggle tabs at the bottom with view count, emoji reactions (🔥51, 😀12, 💰9, etc.)

## Plan

### File: `src/components/launchpad/UniversalTradePanel.tsx`
### File: `src/components/launchpad/TradePanelWithSwap.tsx`

Both files get the same changes:

1. **BUY/SELL tabs**: Remove `bg-green-500/15`, just use transparent bg with a bottom border underline in chartreuse/yellow-green (`border-[#c8ff00]`). SELL uses same transparent bg with red underline when active.

2. **INSTA BUY**: Flip layout — Switch on LEFT, label text on RIGHT.

3. **Preset buttons**: Change border color from `green-500` to olive `border-[#3a4a1a]`. Active state uses `bg-[#3a4a1a]` fill with `text-[#c8ff00]` text. Keep ◎ icon.

4. **MAX button**: Change from green to gold/yellow: `bg-[#2a2a1a] text-[#c8b400] border-[#4a4a2a]`.

5. **Price line**: Left-align instead of center.

6. **ADVANCED SETTINGS trigger**: Center text, color it `text-[#c8ff00]`, make it bolder and slightly larger.

7. **Safety checks**: Change from vertical list to horizontal 4-column grid. Each column: large circle icon (green `CheckCircle2` or red `XCircle`) on top, label text centered below in small mono text.

8. **Add "Share your P&L" section**: Below advanced settings — left text "Share your P&L", right side has "TWEET ↗" button and "+200" badge.

9. **Do NOT add Chat/Twitter tabs** — those exist elsewhere on the page already (comments section). Keeping scope to the trade panel only.

### Approach
Apply identical style changes to both files. After editing, take a screenshot and compare again to verify 1:1 match.

