

## V2 Bitcoin Mode — Pure Bitcoin Edition at `/v2btc`

### Overview
Create a parallel set of routes at `/v2btc` that mirror the existing `/btc` mode but with the **Pure Bitcoin narrative** — Fractal Bitcoin as Layer 2 instead of Solana. Same database tables, same wallet connections, same backend — just rebranded UI and explainer content. This lets you test the new narrative live without touching the existing `/btc` mode.

### What Gets Built

**1. V2 Bitcoin Home Page** (`src/pages/V2BitcoinModePage.tsx`)
- Clone of `BitcoinModePage.tsx` with updated copy:
  - Hero: "Pure Bitcoin Meme Tokens" — "Born on Mainnet, Trades on Fractal, Audited on Mainnet"
  - Badge: "First-ever Pure Bitcoin Settlement Protocol"
  - Footer stats: "OP_RETURN Genesis · ~30s Fractal Blocks · Merkle Anchoring"
- Same token feed, network stats, wallet connection — all functional
- Links to `/v2btc/meme/launch` and `/v2btc/meme/:id`

**2. V2 Protocol Explainer** (`src/components/bitcoin/V2SaturnProtocolExplainer.tsx`)
- Step 1: OP_RETURN Genesis (unchanged)
- Step 2: Instant Bonding Curve AMM (unchanged)
- Step 3: **Fractal Bitcoin Settlement** — replaces Solana Memo Receipts. "Every trade settles as a native UTXO transfer on Fractal Bitcoin (~30s blocks, merge-mined security). Fully verifiable via Fractal explorer, compatible with Unisat/Xverse."
- Step 4: Merkle Anchoring (unchanged)
- Footer: "30s blocks · 1% platform fee · Unisat native"

**3. V2 Launch Page** (`src/pages/V2BtcMemeLaunchPage.tsx`)
- Clone of `BtcMemeLaunchPage.tsx` — same form, same image upload, same `btc-meme-create` edge function call
- Updated copy: references Fractal Bitcoin instead of Solana
- Navigates to `/v2btc/meme/:id` on success

**4. V2 Token Detail Page** (`src/pages/V2BtcMemeDetailPage.tsx`)
- Clone of `BtcMemeDetailPage.tsx` — same trading, holders, charts
- Updated proof labels: "Fractal Settlement" instead of "Solana Memo"
- Back button goes to `/v2btc`

**5. Routes** (in `App.tsx`)
- `/v2btc` → V2BitcoinModePage
- `/v2btc/meme/launch` → V2BtcMemeLaunchPage
- `/v2btc/meme/:id` → V2BtcMemeDetailPage

### What Does NOT Change
- No new database tables — uses same `btc_meme_tokens`, `btc_meme_trades`, `btc_meme_balances`
- No new edge functions — uses same `btc-meme-create`, `btc-meme-swap`
- No wallet changes — same Unisat/Xverse integration
- Existing `/btc` routes remain untouched

### Technical Details
- 4 new page files + 1 new component file
- 3 new route entries in `App.tsx`
- Sidebar entry added for "V2 BTC" (optional, or access via direct URL)
- All V2 pages share the same hooks: `useBtcWallet`, `useBtcMemeTokens`, `useBtcMemeHolders`

