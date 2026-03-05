

## Analysis

The current trade panels (`UniversalTradePanel` and `TradePanelWithSwap`) already follow the terminal aesthetic fairly well but are missing several features from the screenshot. Both panels need to be updated to match the pump.fun style more closely.

## Missing Features & Style Fixes (from screenshot)

### 1. Add "INSTA BUY" toggle
- A toggle switch at the top of the buy panel with "INSTA BUY" label in green
- When enabled, skips confirmation and executes immediately (this is already the behavior, but the visual toggle is missing)

### 2. Price display line
- Show `1 {TOKEN_NAME} = {PRICE} SOL` between the input and the action button
- Currently missing — screenshot shows this prominently

### 3. Rename action button to "QUICK BUY" with SOL icon
- Instead of "Buy {TICKER}", use "QUICK BUY ≡ {amount}" format matching the screenshot
- Below it: "Once you click on Quick Buy, your transaction is sent immediately" warning text

### 4. Add MAX button to input field
- The input field should have a "MAX" button (green/gold) on the right side
- Currently only shows the currency label (SOL/ticker)

### 5. Add "ADVANCED SETTINGS" collapsible section
- Move slippage controls into a collapsible "ADVANCED SETTINGS" section
- Add rug-check safety indicators:
  - "ff Launched" (graduated status) — green check / red cross
  - "Authority revoked" — green check / red cross  
  - "Liquidity locked" — green check / red cross
  - "No creator allocation" — green check / red cross
- These can be derived from existing token metadata where available

### 6. Style refinements
- Quick amount preset buttons: use chartreuse/green border with SOL icon (≡), active one highlighted with filled background
- Input field label: "Amount to buy in SOL" instead of "You Pay"
- Remove the arrow-down divider between input/output — screenshot doesn't have it
- Make the main CTA button a solid green block (not transparent/bordered)

## Files to modify

- **`src/components/launchpad/UniversalTradePanel.tsx`** — Major restyle: add INSTA BUY toggle, price line, MAX button, QUICK BUY button text, ADVANCED SETTINGS collapsible with rug checks, style all elements to match screenshot
- **`src/components/launchpad/TradePanelWithSwap.tsx`** — Same changes for bonding curve tokens (mirror the UniversalTradePanel changes)

## Implementation approach

Both panels share ~90% identical UI structure. I will update both files with:
1. INSTA BUY switch toggle at top using the existing Switch component
2. Preset buttons with ≡ SOL icon and chartreuse active state
3. Input with MAX button
4. Price display line: `1 {name} = {price} SOL`
5. Solid green "QUICK BUY ≡ {amount}" button
6. Warning text below button
7. Collapsible "ADVANCED SETTINGS" with slippage + safety indicators
8. Remove arrow divider, remove "You Receive" output section (screenshot doesn't show it prominently — keep it minimal)

