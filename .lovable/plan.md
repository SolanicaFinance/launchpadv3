

## Fix: BNB trades showing SOL in PnL Card

### Problem
The `ProfitCardModal` is hardcoded to display "SOL" as the currency unit and uses `solanaAddress` for the wallet. When a BNB trade triggers the PnL card, it incorrectly shows "SOL" instead of "BNB" and displays the Solana wallet address.

### Changes

**1. Add `chain` field to `ProfitCardData` (src/components/launchpad/ProfitCardModal.tsx)**
- Add `chain?: 'solana' | 'bnb' | 'btc'` to the `ProfitCardData` interface
- Replace all hardcoded `"SOL"` text with a chain-aware currency label (defaults to "SOL", shows "BNB" when chain is "bnb")
- Show the BNB icon (from CoinGecko URL used elsewhere) next to the currency when chain is "bnb"
- Use the EVM wallet address (from `useAuth`) when chain is "bnb" instead of `solanaAddress`
- Update the `handleShareX` tweet text to use the correct currency

**2. Pass `chain` through to ProfitCardData (src/components/TradeSuccessPopup.tsx)**
- When constructing `profitCardData` from the trade success store data, include `chain: data.chain`

**3. Ensure BNB trade callers set `chain: 'bnb'`**
- Verify `BnbTradePanel.tsx` already passes `chain: 'bnb'` in `showTradeSuccess` calls (it records to `alpha_trades` with `chain: "bnb"` but may not set it on the popup store)
- If missing, add `chain: 'bnb'` to the `showTradeSuccess` call in BnbTradePanel

### Technical Details

Files modified:
- `src/components/launchpad/ProfitCardModal.tsx` — Add chain awareness, BNB icon, dynamic currency label
- `src/components/TradeSuccessPopup.tsx` — Forward chain from store to ProfitCardData
- `src/components/launchpad/BnbTradePanel.tsx` — Ensure chain is set on success popup (if not already)

Currency display logic:
```
const currencyLabel = data.chain === 'bnb' ? 'BNB' : data.chain === 'btc' ? 'BTC' : 'SOL'
```

BNB icon: `https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png` (already used in BnbTradePanel)

