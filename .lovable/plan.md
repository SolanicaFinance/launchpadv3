

## Replace `≡` symbol with colorful Solana logo in Holders table

The SOL Balance column in `HoldersTable.tsx` currently uses the text character `≡` before the balance value. Replace it with the same Solana logo image used in the buy section.

### Change

**File: `src/components/launchpad/HoldersTable.tsx`** (line 221)

Replace:
```
≡ {formatSol(holder.solBalance)}
```

With:
```
<img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" className="w-3.5 h-3.5 rounded-full inline-block mr-1" />
{formatSol(holder.solBalance)}
```

This uses the same Solana logo URL already used in `TradePanelWithSwap.tsx` and `UniversalTradePanel.tsx` for the buy buttons.

