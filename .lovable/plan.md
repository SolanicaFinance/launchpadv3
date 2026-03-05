

## Add Token Icon to Sell Input Field and Sell Button

Currently, the buy side shows the Solana logo next to "SOL" in the input field and on the "QUICK BUY" button, but the sell side only shows the token ticker text with no icon. The fix is to show the token's image next to the ticker in both places when selling.

### Changes Required

#### 1. `TradePanelWithSwap.tsx`
- The `Token` type already has `image_url`. Two spots need the token icon on sell:
  - **Input field** (line ~283-284): When `!isBuy`, show `token.image_url` as a small round image before `token.ticker`
  - **Sell button** (line ~330): Change `SELL ${token.ticker}` to include the token image, matching the buy button pattern

#### 2. `UniversalTradePanel.tsx`
- The `TokenInfo` interface needs a new optional `imageUrl?: string` field
- Same two spots:
  - **Input field** (line ~325-328): Show token image on sell side
  - **Sell button** (line ~372): Add token image to sell button text
- Update all call sites in `FunTokenDetailPage.tsx` to pass `imageUrl` when constructing the `TokenInfo` object (lines ~206, ~239, ~256, ~500):
  - External tokens: pass `token.imageUrl`
  - Fun tokens: pass `token.image_url`

