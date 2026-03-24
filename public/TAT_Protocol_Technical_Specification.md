# TAT Protocol — Graduated Rune Architecture
## Full Technical Specification for External Review
**Version**: 1.0 | **Date**: March 2026 | **Author**: Saturn Terminal Engineering

---

## 1. Executive Summary

TAT (Transaction-Attributed Tokens) implements a **hybrid lifecycle model** where tokens are born as platform-managed assets with Bitcoin-grade provenance, then graduate to native Bitcoin Runes upon reaching bonding curve completion. This creates a two-phase token lifecycle:

- **Phase 1 (Pre-Graduation)**: Virtual bonding curve on Saturn's execution layer, with Bitcoin OP_RETURN genesis proof
- **Phase 2 (Post-Graduation)**: Native Rune etched on Bitcoin L1, visible in all compatible wallets (UniSat, Xverse, Leather, OKX)

This is architecturally analogous to pump.fun → Raydium graduation, but for Bitcoin-native assets.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAT TOKEN LIFECYCLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: BONDING CURVE (Saturn-Managed)                       │
│  ┌───────────┐    ┌──────────────┐    ┌───────────────────┐    │
│  │ Bitcoin    │    │ Saturn       │    │ Saturn L2         │    │
│  │ OP_RETURN  │───▶│ Execution    │───▶│ Proof Receipts    │    │
│  │ Genesis    │    │ Layer        │    │ (OP_RETURN)       │    │
│  └───────────┘    └──────┬───────┘    └───────────────────┘    │
│                          │                                      │
│                    Bonding Curve                                │
│                    Progress: 0% → 100%                         │
│                          │                                      │
│  ════════════════════════╪══════════════════════════════════    │
│                          ▼                                      │
│  PHASE 2: GRADUATION (Bitcoin-Native Rune)                     │
│  ┌───────────┐    ┌──────────────┐    ┌───────────────────┐    │
│  │ Rune      │    │ DEX Liquidity│    │ Wallet            │    │
│  │ Etching   │───▶│ Pool (Saturn │───▶│ Visibility        │    │
│  │ on Bitcoin│    │  as DEX)     │    │ (UniSat/Xverse)   │    │
│  └───────────┘    └──────────────┘    └───────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Pre-Graduation (Bonding Curve)

### 3.1 Token Genesis (Bitcoin Layer 1)

Every TAT token's existence is permanently recorded on Bitcoin Mainnet via an `OP_RETURN` transaction at creation time.

**Genesis Transaction Structure:**
```
OP_RETURN <protocol_prefix> <version> <token_id> <ticker> <supply> <creator_pubkey_hash> <timestamp>
```

**Field Definitions:**
| Field | Bytes | Description |
|-------|-------|-------------|
| `protocol_prefix` | 4 | `TAT\x01` (hex: `54415401`) |
| `version` | 1 | Protocol version (currently `0x02`) |
| `token_id` | 16 | UUID v4 of the token (compressed) |
| `ticker` | 1-10 | UTF-8 ticker symbol |
| `supply` | 8 | Total supply as uint64 (default: 1,000,000,000) |
| `creator_pubkey_hash` | 20 | HASH160 of creator's Bitcoin public key |
| `timestamp` | 4 | Unix timestamp (uint32) |

**Maximum OP_RETURN payload**: 80 bytes (Bitcoin standard)
**Actual payload size**: ~63 bytes (within limits)

**Example raw transaction output:**
```
OP_RETURN 54415401 02 a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 534154 000000003B9ACA00 89abcdef0123456789abcdef01234567890abcde 67890123
```

### 3.2 Bonding Curve Mechanics

**Model**: Constant-Product Automated Market Maker (CPAMM)
```
x * y = k

where:
  x = virtual_btc_reserves (in satoshis)
  y = virtual_token_reserves
  k = invariant constant
```

**Default Parameters:**
| Parameter | Value | Description |
|-----------|-------|-------------|
| `total_supply` | 1,000,000,000 | Total token supply |
| `virtual_btc_reserves` | 30,000,000 sats (0.3 BTC) | Initial virtual BTC in pool |
| `virtual_token_reserves` | 1,073,000,000 | Virtual token reserves |
| `real_btc_reserves` | 0 | Actual BTC deposited by traders |
| `real_token_reserves` | 800,000,000 | Tokens available for purchase |
| `graduation_threshold` | 0.5 BTC (50,000,000 sats) | BTC needed to trigger graduation |
| `platform_fee_bps` | 100 (1%) | Platform trading fee |
| `creator_fee_bps` | 0-800 (0-8%) | Creator-configurable tax |

**Price Formula:**
```
price_per_token_in_btc = virtual_btc_reserves / virtual_token_reserves
```

**Buy Calculation:**
```python
def calculate_buy(btc_in, virtual_btc, virtual_token, real_token):
    fee = btc_in * fee_bps / 10000
    btc_after_fee = btc_in - fee
    
    k = virtual_btc * virtual_token
    new_virtual_btc = virtual_btc + btc_after_fee
    new_virtual_token = k / new_virtual_btc
    tokens_out = virtual_token - new_virtual_token
    
    # Ensure we don't exceed real reserves
    tokens_out = min(tokens_out, real_token)
    
    return tokens_out, fee
```

**Sell Calculation:**
```python
def calculate_sell(tokens_in, virtual_btc, virtual_token, real_btc):
    k = virtual_btc * virtual_token
    new_virtual_token = virtual_token + tokens_in
    new_virtual_btc = k / new_virtual_token
    btc_out = virtual_btc - new_virtual_btc
    
    fee = btc_out * fee_bps / 10000
    btc_after_fee = btc_out - fee
    
    # Ensure we don't exceed real reserves
    btc_after_fee = min(btc_after_fee, real_btc)
    
    return btc_after_fee, fee
```

**Bonding Progress:**
```
progress = (real_btc_reserves / graduation_threshold) * 100
```

### 3.3 Balance Management

Balances are tracked in the `btc_meme_balances` database table:

```sql
CREATE TABLE btc_meme_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID REFERENCES btc_meme_tokens(id),
    wallet_address TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    total_bought NUMERIC DEFAULT 0,
    total_sold NUMERIC DEFAULT 0,
    avg_buy_price_btc NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(token_id, wallet_address)
);
```

### 3.4 Trade Recording

Every trade is recorded with full audit trail:

```sql
CREATE TABLE btc_meme_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID REFERENCES btc_meme_tokens(id),
    wallet_address TEXT NOT NULL,
    trade_type TEXT NOT NULL,          -- 'buy' or 'sell'
    btc_amount NUMERIC NOT NULL,       -- BTC spent/received (in BTC, not sats)
    token_amount NUMERIC NOT NULL,     -- Tokens bought/sold
    price_btc NUMERIC NOT NULL,        -- Price at execution
    price_usd NUMERIC,                 -- USD equivalent at time of trade
    fee_btc NUMERIC DEFAULT 0,         -- Fee charged
    bonding_progress NUMERIC,          -- Progress at time of trade
    market_cap_btc NUMERIC,            -- Market cap at time of trade
    pool_virtual_btc NUMERIC,          -- Pool state snapshot
    pool_virtual_tokens NUMERIC,
    pool_real_btc NUMERIC,
    solana_proof_signature TEXT,        -- Layer 2 proof receipt
    solana_proof_memo TEXT,            -- Proof memo content
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Layer 2 Proof Receipts (Execution Verification)

Each trade generates a verifiable proof on the execution layer.

**Option A — Solana SPL Memo (V1 Hybrid):**
```
Memo format: "TAT|<trade_id>|<token_id>|<type>|<btc_amount>|<token_amount>|<price>|<timestamp>"
```
- Recorded as a Solana SPL Memo transaction
- Provides sub-second finality (~400ms)
- Costs ~0.000005 SOL per proof

**Option B — Saturn Execution Layer (V2 Pure Bitcoin):**
```
OP_RETURN TAT_TRADE <trade_id> <token_id> <type> <amounts_hash>
```
- Recorded on the Saturn Execution Layer
- 100% Bitcoin-native execution
- Uses native UTXO model

### 3.6 Merkle Anchor (Layer 3 Solvency Proof)

Periodically (every epoch, configurable), the entire protocol state is anchored to Bitcoin Mainnet:

```sql
CREATE TABLE btc_merkle_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merkle_root TEXT NOT NULL,         -- SHA-256 Merkle root of all balances
    anchor_txid TEXT NOT NULL,         -- Bitcoin transaction ID
    block_height INTEGER,             -- Bitcoin block height
    total_tokens INTEGER DEFAULT 0,   -- Number of tokens in snapshot
    total_accounts INTEGER DEFAULT 0, -- Number of balance entries
    balances_snapshot JSONB,          -- Full state at anchor time
    fee_sats INTEGER,                 -- Transaction fee paid
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Merkle Tree Construction:**
```python
def build_merkle_tree(balances):
    """
    balances: list of (token_id, wallet_address, balance) tuples
    sorted lexicographically by (token_id, wallet_address)
    """
    leaves = []
    for token_id, wallet, balance in sorted(balances):
        leaf = sha256(f"{token_id}:{wallet}:{balance}".encode())
        leaves.append(leaf)
    
    while len(leaves) > 1:
        next_level = []
        for i in range(0, len(leaves), 2):
            left = leaves[i]
            right = leaves[i + 1] if i + 1 < len(leaves) else left
            parent = sha256(left + right)
            next_level.append(parent)
        leaves = next_level
    
    return leaves[0]  # Merkle root
```

**Anchor Transaction:**
```
OP_RETURN TAT_ANCHOR <merkle_root_32bytes> <epoch_number_4bytes> <token_count_4bytes> <account_count_4bytes>
```

---

## 4. Phase 2: Graduation (Rune Etching)

### 4.1 Graduation Trigger

Graduation occurs when:
```
real_btc_reserves >= graduation_threshold_btc
```

**Default threshold**: 0.5 BTC (50,000,000 satoshis)

### 4.2 Graduation Process

```
Step 1: Lock Trading
  - Set token status to 'graduating'
  - Reject all new buy/sell requests
  - Record final pool state snapshot

Step 2: Snapshot Balances
  - Query all entries from btc_meme_balances where balance > 0
  - Generate Merkle root of final state
  - Anchor final state to Bitcoin Mainnet

Step 3: Etch Rune on Bitcoin
  - Construct Runestone with token parameters
  - Broadcast etching transaction
  - Wait for confirmation (1-6 blocks)

Step 4: Distribute Runes
  - For each holder in snapshot:
    - Calculate proportional Rune allocation
    - Queue distribution transaction
  - Batch distributions into efficient PSBTs

Step 5: Seed Liquidity (Rune DEX Pool)
  - Deduct graduation overhead from real_btc_reserves (~0.44%)
  - Remaining BTC (~0.498 BTC) is permanently locked as LP in a Rune trading pool
  - Pool pairs: RUNE/BTC on Saturn's Rune DEX
  - Initial price = final bonding curve price (ensures no price gap)
  - LP tokens are burned (no one can withdraw the liquidity — locked forever)
  - This is analogous to Meteora DAMM LP lock on Solana graduation

Step 6: Activate Post-Graduation Trading
  - Update token status to 'graduated'
  - Enable Rune-native trading against the seeded LP
  - Token now visible in all Rune-compatible wallets
  - Trading continues with 0.5% DEX fee (60% to LP yield, 40% to Saturn treasury)
```

> **Where does the money go?** See Section 5.2 for the complete fund flow diagram.

### 4.3 Rune Etching Specification

**Runestone Structure (per Runes Protocol v1):**
```rust
struct Etching {
    divisibility: u8,    // Decimal places (default: 8, matching BTC)
    premine: u128,       // Amount premined to creator (0 for TAT)
    rune: Rune,          // The rune name
    spacers: u32,        // Spacer dots in name
    symbol: char,        // Display symbol (e.g., '⚡')
    terms: Option<Terms>, // Mint terms (None for TAT — no open minting)
}

// TAT tokens use premine = total_supply with no open mint terms
// This means all tokens are pre-allocated to holders from the bonding curve
```

**Rune Name Requirements:**
- 1-26 characters (A-Z only)
- Names unlock over time per the Runes protocol schedule
- Short names (< 13 chars) may require commitment transactions

**Etching Transaction:**
```
Input: Platform UTXO (funding)
Output 0: OP_RETURN Runestone(Etching)  — Rune protocol data
Output 1: Premine output → Platform address (holds all tokens for distribution)
Output 2: Change output → Platform address
```

### 4.4 Rune Distribution to Holders

After etching, each bonding curve holder receives their proportional Rune balance:

```python
def calculate_distributions(holders, total_rune_supply):
    """
    holders: list of (wallet_address, token_balance) from btc_meme_balances
    total_rune_supply: total supply etched as Rune
    """
    total_held = sum(balance for _, balance in holders)
    
    distributions = []
    for wallet, balance in holders:
        rune_amount = (balance / total_held) * total_rune_supply
        distributions.append((wallet, int(rune_amount)))
    
    return distributions
```

**Distribution Batching:**
- Max ~250 outputs per Bitcoin transaction
- Large holder bases split into multiple batches
- Each batch is a PSBT signed by the platform wallet
- Estimated cost: ~10,000 sats per batch (at 10 sat/vB)

### 4.5 Post-Graduation: Wallet Visibility

Once the Rune is etched and distributed:

| Wallet | Support | How It Appears |
|--------|---------|---------------|
| UniSat | ✅ Full | Runes tab → Balance, Transfer, History |
| Xverse | ✅ Full | Runes section → Balance, Send |
| Leather | ✅ Full | Collectibles → Runes → Balance |
| OKX Wallet | ✅ Full | Bitcoin → Runes tab |
| Magic Eden | ✅ Trading | Listed for buy/sell |
| Saturn | ✅ Trading | Continued DEX trading |

**Indexer Compatibility:**
- Ord indexer (ordinals.com) — ✅ Indexed automatically
- Rune Alpha indexer — ✅ Compatible
- Best in Slot API — ✅ Queryable
- Magic Eden API — ✅ Tradeable

---

## 5. Economic Model

### 5.1 Fee Structure

**Pre-Graduation (Bonding Curve):**
```
Total Fee = Platform Fee + Creator Fee
Platform Fee = trade_amount * 100bps (1%)
Creator Fee  = trade_amount * creator_fee_bps (0-8%, set at creation)
```

**Post-Graduation (Rune Trading on Saturn):**
```
DEX Fee = trade_amount * 50bps (0.5%)
  → 60% to liquidity providers
  → 40% to platform treasury
```

### 5.2 Complete Fund Flow — Where All the Money Goes

**There are TWO separate money flows during a TAT's lifecycle:**

```
FLOW 1: TRADING FEES (extracted per-trade, never enter the bonding pool)
═══════════════════════════════════════════════════════════════════════
Every buy/sell on the bonding curve deducts fees BEFORE adding BTC to the pool.

Example: User buys with 0.01 BTC, creator fee = 2%:
  Total fee = 1% platform + 2% creator = 3%
  Fee deducted: 0.0003 BTC
  BTC entering pool: 0.0097 BTC

Fee destination (immediate, per-trade):
├── Platform fee (1%)  → Saturn platform wallet (BTC_PLATFORM_ADDRESS)
├── Creator fee (0-8%) → Creator's wallet (stored in btc_meme_tokens.creator_wallet)
└── These fees are GONE from the system — they never touch real_btc_reserves

Accumulated over the token's lifetime:
  If 0.5 BTC enters the pool, total trading volume was ~0.515 BTC (at 3% avg fee)
  Platform earned: ~0.00515 BTC in platform fees
  Creator earned:  ~0.0103 BTC in creator fees


FLOW 2: BONDING POOL (real_btc_reserves) — the graduation pot
═══════════════════════════════════════════════════════════════
This is the BTC that REMAINS after fees are deducted.
It grows with buys, shrinks with sells.
It is the ONLY pool of BTC at graduation time.

                    ┌──────────────────────────────────────┐
                    │     real_btc_reserves = 0.5 BTC      │
                    │     (graduation threshold reached)    │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │     GRADUATION DEDUCTIONS             │
                    │                                       │
                    │  - Rune etching tx:     ~3,000 sats  │
                    │  - Distribution txs:  ~220,000 sats  │
                    │  - Total overhead:    ~223,000 sats   │
                    │    (0.44% of pool)                    │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │   REMAINING: ~49,777,000 sats        │
                    │   (~0.498 BTC)                        │
                    │                                       │
                    │   100% LOCKED AS LIQUIDITY POOL       │
                    │   ┌─────────────────────────────┐    │
                    │   │  RUNE/BTC LP on Saturn DEX  │    │
                    │   │  LP tokens BURNED            │    │
                    │   │  Liquidity locked FOREVER     │    │
                    │   │  Initial price = final curve  │    │
                    │   │  price (no gap for arb)       │    │
                    │   └─────────────────────────────┘    │
                    │                                       │
                    │   Nobody withdraws this BTC.          │
                    │   It stays as permanent liquidity     │
                    │   for Rune trading.                   │
                    └──────────────────────────────────────┘
```

**Summary: Where every satoshi goes**

| Source | Amount (approx) | Destination | When |
|--------|----------------|-------------|------|
| Platform fees (1%) | ~0.005 BTC | Saturn treasury wallet | Per-trade (immediate) |
| Creator fees (0-8%) | ~0.005-0.04 BTC | Creator's BTC wallet | Per-trade (immediate) |
| Etching + distribution | ~0.002 BTC | Bitcoin miners | At graduation |
| Name commitment | ~0.00003 BTC | Bitcoin miners | At token genesis (paid by platform treasury) |
| Remaining pool (~99.5%) | ~0.498 BTC | Locked LP (burned, permanent) | At graduation |

**Key insight**: Nobody "gets" the bonding pool BTC. It becomes permanent, unwithdrawable liquidity for the graduated Rune — exactly like how pump.fun tokens lock LP on Raydium graduation, or how Saturn's Solana tokens lock LP on Meteora DAMM.

### 5.3 Post-Graduation Revenue

```
Post-Graduation DEX Trading:
├── DEX Fee: 0.5% per trade
│   ├── 60% → LP yield (accrues to locked pool — effectively burned/compounded)
│   └── 40% → Saturn platform treasury
└── Token generates ongoing volume and platform revenue
```

### 5.3 Platform Value Flywheel

```
1. Creator launches TAT on Saturn
   → Generates trading volume + fees during bonding

2. Token graduates to Rune
   → Visible in wallets → attracts external users

3. External users discover Saturn via graduated Runes
   → Come to Saturn to trade → discover new TATs

4. Network effect compounds
   → More launches → more graduates → more traders → more launches
```

---

## 6. Security Considerations

### 6.1 Pre-Graduation Risks

| Risk | Mitigation |
|------|-----------|
| Platform database compromise | Merkle anchors provide tamper-evident state |
| Double-spend (off-chain) | Atomic database transactions with serializable isolation |
| Fake genesis proofs | OP_RETURN verified on-chain via block explorer APIs |
| Rug pull by creator | Optional Miniscript timelocks on creator allocations |
| Front-running | FIFO order processing, no mempool exposure |

### 6.2 Graduation Risks

| Risk | Mitigation |
|------|-----------|
| Incomplete distribution | Pre-signed PSBT batches with retry logic |
| Rune name squatting | Name reservation via commitment tx (Runes protocol native) |
| Price manipulation at graduation | Trading locked during entire graduation process |
| Snapshot inconsistency | Final Merkle anchor before Rune etching |

### 6.3 Trust Assumptions

**What users must trust:**
1. Saturn's execution layer correctly tracks balances (mitigated by Merkle anchors)
2. Platform will execute graduation when threshold is met (enforceable via smart contract in future)
3. Distribution will include all holders (verifiable against published Merkle root)

**What is trustless:**
1. Token existence (OP_RETURN on Bitcoin — immutable)
2. State integrity (Merkle root on Bitcoin — tamper-evident)
3. Post-graduation balances (Rune on Bitcoin — fully on-chain)

---

## 7. Database Schema Summary

### Core Tables

```sql
-- Token metadata and bonding curve state
btc_meme_tokens (
    id, name, ticker, creator_wallet, status,
    virtual_btc_reserves, virtual_token_reserves,
    real_btc_reserves, real_token_reserves,
    total_supply, bonding_progress,
    graduation_threshold_btc, genesis_txid,
    graduated_at, price_btc, market_cap_btc,
    creator_fee_bps, platform_fee_bps,
    last_anchor_txid, last_anchor_at
)

-- User balance tracking
btc_meme_balances (
    id, token_id, wallet_address, balance,
    total_bought, total_sold, avg_buy_price_btc
)

-- Trade history with proof receipts
btc_meme_trades (
    id, token_id, wallet_address, trade_type,
    btc_amount, token_amount, price_btc, fee_btc,
    solana_proof_signature, solana_proof_memo,
    bonding_progress, market_cap_btc
)

-- Periodic solvency proofs
btc_merkle_anchors (
    id, merkle_root, anchor_txid, block_height,
    total_tokens, total_accounts, balances_snapshot
)

-- Bitcoin L1 Runes (post-graduation)
btc_tokens (
    id, rune_name, rune_symbol, rune_id,
    creator_wallet, supply, divisibility,
    etch_tx_hash, status
)
```

---

## 8. API Endpoints (Edge Functions)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `btc-meme-launch` | POST | Create new TAT (genesis OP_RETURN + DB record) |
| `btc-meme-swap` | POST | Execute buy/sell on bonding curve |
| `btc-market-data` | POST | Fetch network metrics + token data |
| `btc-anchor-state` | POST | Trigger Merkle anchor to Bitcoin |
| `btc-graduate-token` | POST | Initiate graduation pipeline |
| `btc-rune-etch` | POST | Etch Rune on Bitcoin (graduation step) |
| `btc-rune-distribute` | POST | Distribute Runes to holders |

---

## 9. Comparison with Existing Protocols

| Feature | TAT | BRC-20 | Runes | pump.fun |
|---------|-------------|--------|-------|----------|
| Genesis chain | Bitcoin L1 | Bitcoin L1 | Bitcoin L1 | Solana |
| Trading speed | Instant (off-chain) | ~10min (on-chain) | ~10min (on-chain) | Instant (on-chain) |
| Wallet visibility (pre-grad) | Platform only | Universal | Universal | Platform only |
| Wallet visibility (post-grad) | Universal (Rune) | Universal | Universal | Universal (Raydium) |
| State verifiability | Merkle anchors | Full on-chain | Full on-chain | Full on-chain |
| Trading fees | 1% + creator tax | Miner fees | Miner fees | 1% |
| Throughput | ~65,000 TPS | ~7 TPS | ~7 TPS | ~65,000 TPS |
| Settlement finality | Bitcoin epoch | Bitcoin block | Bitcoin block | Solana slot |

---

## 10. Known Limitations & Architectural Decisions

### 10.1 Rune Name Reservation Strategy

**Problem**: The Bitcoin Runes protocol time-locks short names. As of 2026, names shorter than ~13 characters require either waiting for the unlock schedule or submitting a commitment transaction. Users launching TATs will expect their chosen ticker to become the Rune name upon graduation, but another party could front-run and etch that name while the token is still bonding.

**Current Implementation Gap**: The existing `btc-rune-launch` edge function checks Rune name availability via the Xverse API (`GET /v1/runes/{name}`) — but **only at etch preparation time** (when graduation triggers). There is no early check at token creation. This means a name could be taken by someone else during the entire bonding period (days/weeks).

**Solution: Two-Stage Name Protection**

```
STAGE 1: AVAILABILITY CHECK AT TOKEN GENESIS (new)
┌────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│ User creates   │────▶│ Query Xverse API:    │────▶│ Name available?     │
│ TAT "SATURN"   │     │ GET /v1/runes/SATURN │     │ YES → proceed       │
│                │     │                      │     │ NO  → reject launch │
└────────────────┘     └──────────────────────┘     └─────────────────────┘

STAGE 2: COMMITMENT TX AT GENESIS (parallel with OP_RETURN)
┌────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Name confirmed │────▶│ Platform submits  │────▶│ Name is reserved│
│ available      │     │ commitment tx     │     │ for 20 blocks   │
│                │     │ (pays ~2,000 sats)│     │ (renewable)     │
└────────────────┘     └──────────────────┘     └─────────────────┘
```

**Stage 1 — Early Name Validation (Edge Function Change Required)**

The `btc-meme-launch` edge function (TAT creation) must add a Rune name check **before** inserting the token record. This is the same Xverse API call already used in `btc-rune-launch`, moved earlier in the lifecycle:

```typescript
// At TAT creation time (btc-meme-launch), BEFORE inserting to btc_meme_tokens:
const runeClean = ticker.toUpperCase().replace(/[^A-Z]/g, "");
const runeRes = await fetch(`${XVERSE_API}/v1/runes/${encodeURIComponent(runeClean)}`);
if (runeRes.ok) {
  const runeData = await runeRes.json();
  if (runeData?.name) {
    return error(409, "Rune name already taken on Bitcoin. Choose a different name.");
  }
}
// Also check btc_meme_tokens table to prevent duplicate names within Saturn:
const { data: existing } = await supabase
  .from("btc_meme_tokens")
  .select("id")
  .ilike("ticker", runeClean)
  .neq("status", "dead")
  .limit(1);
if (existing?.length) {
  return error(409, "Name already in use on Saturn.");
}
```

**Stage 2 — Commitment Transaction at Genesis**

After the name passes validation, the platform submits a Bitcoin commitment transaction to reserve the name on-chain:

**Commitment Transaction Structure:**
```
Input: Platform UTXO (funding)
Output 0: Commitment data (Runes protocol native)
Output 1: Change → Platform wallet
Fee: ~1,500-3,000 sats (depending on fee rate)
```

The commitment TX hash is stored in a new column on `btc_meme_tokens`:
```sql
ALTER TABLE btc_meme_tokens ADD COLUMN rune_commitment_txid TEXT;
ALTER TABLE btc_meme_tokens ADD COLUMN rune_commitment_block INTEGER;
ALTER TABLE btc_meme_tokens ADD COLUMN rune_name_reserved TEXT; -- cleaned name reserved on Bitcoin
```

**Stage 3 — Re-Validation at Graduation**

The existing Xverse check in `btc-rune-launch` remains as a **final safety check** before etching. If the name was taken despite the commitment (edge case — commitment expired and someone else etched), the fallback naming logic activates.

**Name Length Handling Rules:**
| Name Length | Available Since | Strategy |
|-------------|----------------|----------|
| 13+ chars | Always available | Direct etch at graduation, no commitment needed |
| 10-12 chars | Unlocking 2024-2025 | Commitment tx at genesis, etch at graduation |
| 5-9 chars | Unlocking 2025-2026 | Commitment tx at genesis; if name not yet unlocked, append suffix (e.g., `SATURN` → `SATURNTAT`) |
| 1-4 chars | 2028+ (estimated) | Use long-form name with spacers (e.g., `S•A•T•U•R•N`) or append identifier |

**Commitment Renewal**: If a token takes longer than expected to graduate (commitment expires after ~20 blocks), the platform auto-renews the commitment. Renewal cost: ~1,500 sats per renewal, funded from accumulated platform fees.

**Fallback**: If the exact name is taken before graduation (e.g., someone etches it independently on Bitcoin), the platform appends a deterministic suffix: `{NAME}SAT` or `{NAME}SATURN`. Users are notified in the UI that a fallback name was used.

**Cost**: Commitment transactions cost **1,500-3,000 sats (~$1.50-$3.00 at $100K BTC)**. This is absorbed by the platform treasury as a cost of doing business — no additional fee to creators.

### 10.2 Rune Distribution Cost Analysis

**Problem**: After graduation, every holder needs to receive their Rune allocation via on-chain Bitcoin transactions. This has real miner fee costs.

**Detailed Cost Breakdown:**

A single Bitcoin transaction can include up to ~250 outputs. Each Rune transfer output adds approximately 43 vBytes to the transaction.

```
BASE TRANSACTION COST:
  Fixed overhead: ~10 vBytes (version, locktime)
  Input (1 P2WPKH):  ~68 vBytes
  Each output:        ~43 vBytes (P2WPKH + Runestone edict)
  Runestone overhead:  ~50 vBytes (once per tx)

TOTAL per batch = 128 + (43 × num_outputs) vBytes
```

**Cost Table at Various Fee Rates:**

| Holders | Batches Needed | Size (vBytes) | @ 5 sat/vB | @ 10 sat/vB | @ 25 sat/vB | @ 50 sat/vB |
|---------|---------------|---------------|------------|-------------|-------------|-------------|
| 50 | 1 | 2,278 | 11,390 sats ($11.39) | 22,780 sats ($22.78) | 56,950 sats ($56.95) | 113,900 sats ($113.90) |
| 250 | 1 | 10,878 | 54,390 sats ($54.39) | 108,780 sats ($108.78) | 271,950 sats ($271.95) | 543,900 sats ($543.90) |
| 500 | 2 | 21,756 | 108,780 sats ($108.78) | 217,560 sats ($217.56) | 543,900 sats ($543.90) | 1,087,800 sats ($1,087.80) |
| 1,000 | 4 | 43,512 | 217,560 sats ($217.56) | 435,120 sats ($435.12) | 1,087,800 sats ($1,087.80) | 2,175,600 sats ($2,175.60) |
| 5,000 | 20 | 217,560 | 1,087,800 sats ($1,087.80) | 2,175,600 sats ($2,175.60) | 5,439,000 sats ($5,439.00) | 10,878,000 sats ($10,878.00) |

*(USD estimates at BTC = $100,000)*

**Summary**: Distribution costs range from **~$11 (50 holders, low fees)** to **~$10,878 (5,000 holders, high fees)**. Typical graduation with 200-500 holders at normal fee rates: **$100-$500**.

**Who Pays — Decision: Deducted from Bonding Curve Reserves**

**Where is the BTC pool?** The `real_btc_reserves` column on the `btc_meme_tokens` table is the accumulated BTC from all buyers during the bonding curve phase. Every buy adds BTC (minus fees) to this pool; every sell withdraws BTC from it. When the pool reaches 0.5 BTC (50,000,000 sats), graduation triggers. This is the **only BTC pool that exists** — there is no separate treasury or graduation fund.

Distribution costs are deducted from `real_btc_reserves` at graduation time, before liquidity seeding:

```
GRADUATION ECONOMICS:
  real_btc_reserves at threshold:  0.5 BTC (50,000,000 sats)
  
  Deductions from pool:
  - Rune etching tx:              ~3,000 sats
  - Name commitment (already paid at genesis by platform treasury, NOT from pool)
  - Distribution txs (500 holders): ~217,560 sats
  - Total from pool:               ~220,560 sats (0.44% of reserves)
  
  Remaining for LP seed:           49,779,440 sats (~0.498 BTC)
```

**Why this makes sense:**
- The pool grows proportionally with demand — more holders = more BTC in pool = more to cover costs
- At 0.5 BTC threshold, even worst-case distribution (5,000 holders at 50 sat/vB = ~10.8M sats) is only 21.6% of the pool
- In practice, 200-500 holders at 10 sat/vB costs ~$100-$500 (0.2-1% of pool) — negligible
- No extra fee charged to creators or holders — it's invisible overhead

At 0.5 BTC graduation threshold, the overhead is negligible (<0.5%). The platform absorbs this from the bonding curve reserves — **no extra fee charged to creators or holders**.

**Fee Rate Optimization**: The platform monitors `mempool.space` fee estimates and schedules distribution during low-fee periods (typically weekends, early UTC). If fees exceed 40 sat/vB, graduation is delayed up to 24 hours for a cheaper window.

### 10.3 Atomic Graduation Trust Model

There's no on-chain guarantee that graduation *will* happen. This requires trust in the platform until a Bitcoin covenant/smart contract solution (e.g., OP_CTV, OP_CAT-based covenants) is viable. The Merkle anchor system provides cryptographic proof of all balances, enabling community auditing at any time.

### 10.4 Rune Transferability (Accepted Trade-off)

Post-graduation, tokens are fully on-chain Runes. The platform loses control over features like creator tax enforcement. Trading on external platforms (Magic Eden, UniSat Marketplace) bypasses Saturn fees. This is an **accepted and intentional trade-off** — the value proposition is that Saturn is where tokens are *born and graduated*, not where they are permanently locked. The platform earns fees during the bonding curve phase and initial post-graduation DEX trading, then benefits from brand attribution as graduated Runes carry Saturn's provenance.

### 10.5 Indexer Lag & UI Graduation Progress

After Rune etching, it may take 1-6 blocks (~10-60 min) for wallet indexers to recognize the new Rune. The platform displays a **real-time graduation progress UI** so users always know the current state:

```
GRADUATION UI STAGES:
┌─────────────────────────────────────────────────────────────────┐
│  🔒 Step 1/6 — Trading Locked                    ✅ Complete   │
│  📸 Step 2/6 — Balance Snapshot & Merkle Anchor   ✅ Complete   │
│  ⛏️  Step 3/6 — Rune Etching (waiting for conf)   🔄 1/3 conf  │
│  📦 Step 4/6 — Distributing Runes (batch 2/4)     ⏳ Pending   │
│  💧 Step 5/6 — Seeding Liquidity Pool             ⏳ Pending   │
│  🎉 Step 6/6 — Rune Trading Active                ⏳ Pending   │
├─────────────────────────────────────────────────────────────────┤
│  ⏱️ Estimated time remaining: ~35 minutes                      │
│  📡 Etching TX: bc1...a4f2 (mempool.space link)                │
│  💰 Your allocation: 12,500,000 SATURN (1.25% of supply)      │
└─────────────────────────────────────────────────────────────────┘
```

Each stage updates in real-time via database polling. Users can leave and return — their allocation is guaranteed by the pre-graduation Merkle anchor.

### 10.6 Bonding Curve Lifecycle (No Forced Graduation)

**Critical Design Decision**: Graduation is **not guaranteed**. The bonding curve operates identically to pump.fun — if a token never reaches the 0.5 BTC graduation threshold, it simply continues trading on the bonding curve indefinitely. Users can buy and sell at any time. The token remains a TAT (platform-managed) and never becomes a Rune.

**This is by design:**
- Tokens that fail to attract enough demand will naturally decline in price as sellers exit
- The bonding curve ensures there is always liquidity — users can sell back into the curve at any time
- Trading fees (platform + creator) are earned on every trade regardless of graduation
- There is no "unsold supply" problem — the 800M tokens in the curve are virtual reserves, not minted tokens sitting in a wallet

```
BONDING CURVE STATES:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ACTIVE (0% - 99.9% progress)                               │
│  ├── Users buy → price increases, progress increases         │
│  ├── Users sell → price decreases, progress decreases        │
│  ├── Platform earns 1% fee on every trade                    │
│  ├── Creator earns 0-8% fee on every trade                   │
│  └── Token can pump to near-graduation or dump to zero       │
│                                                              │
│  GRADUATED (100% progress — 0.5 BTC reached)                 │
│  ├── Trading locks, Rune etching begins                      │
│  ├── All holders receive proportional Rune allocation        │
│  └── Token becomes native Bitcoin Rune                       │
│                                                              │
│  DEAD / ABANDONED (organic outcome)                          │
│  ├── All holders sold, real_btc_reserves ≈ 0                 │
│  ├── Token still exists (genesis OP_RETURN is permanent)     │
│  ├── Anyone can buy back in and restart momentum             │
│  └── Platform earned fees during all trading activity        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**The 200M "LP allocation" referenced in the original spec was incorrect.** In the TAT model, there is no separate LP allocation. The full 1B supply is represented by the virtual reserves:
- `virtual_token_reserves` (1,073,000,000) and `real_token_reserves` (800,000,000) define the curve
- As users buy, tokens flow from `real_token_reserves` to their balance
- As users sell, tokens flow back from their balance to the pool
- If graduation occurs, the *actual held balances* (spread across all holders) are what gets distributed as Runes
- The bonding curve BTC reserves seed the post-graduation liquidity pool

No tokens are burned, locked, or vested. The curve is the market. If nobody buys, the token is worthless. If everyone sells, the BTC flows back out. This is pure pump.fun economics on Bitcoin.

---

## 11. Prior Art & Proof of Existence

The TAT protocol whitepaper (v2.0, "Pure Bitcoin Edition") has an existing SHA-256 hash anchor on the Bitcoin blockchain:

```
Anchor ID: 36addb28...
Chain: Bitcoin Mainnet
Type: OP_RETURN
Purpose: Proof of existence for TAT protocol specification
```

This establishes a verifiable timestamp for the protocol's intellectual property and design.

---

**End of Technical Specification**

*This document is intended for technical review and validation of the TAT Protocol's graduated Rune architecture. All code examples are illustrative and may differ from production implementation.*
