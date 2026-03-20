# Saturn Curve — Deployment Guide

Complete A-Z guide for building, deploying, and integrating the Saturn bonding curve program.

---

## Prerequisites

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup component add rustfmt clippy
```

### 2. Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify
solana --version
```

### 3. Install Anchor CLI
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.30.1
avm use 0.30.1

# Verify
anchor --version
```

### 4. Create Deploy Wallet
```bash
# For devnet testing
solana-keygen new --outfile ~/.config/solana/saturn-deployer.json

# Fund on devnet
solana config set --url devnet
solana airdrop 5 --keypair ~/.config/solana/saturn-deployer.json

# For mainnet: transfer 5+ SOL to the deployer address
solana address --keypair ~/.config/solana/saturn-deployer.json
```

---

## Build

### 1. Navigate to program directory
```bash
cd programs/saturn-curve
```

### 2. First build (generates program ID)
```bash
anchor build
```

### 3. Get the generated program ID
```bash
solana address -k target/deploy/saturn_curve-keypair.json
```

### 4. Update program ID everywhere
Replace `SatCurve1111111111111111111111111111111111111` with your actual program ID:

```bash
# In src/lib.rs
declare_id!("YOUR_ACTUAL_PROGRAM_ID");

# In Anchor.toml
[programs.devnet]
saturn_curve = "YOUR_ACTUAL_PROGRAM_ID"

[programs.mainnet]
saturn_curve = "YOUR_ACTUAL_PROGRAM_ID"
```

### 5. Rebuild with correct ID
```bash
anchor build
```

---

## Deploy to Devnet

```bash
# Set cluster
solana config set --url devnet

# Deploy
anchor deploy \
  --provider.cluster devnet \
  --provider.wallet ~/.config/solana/saturn-deployer.json

# Verify deployment
solana program show YOUR_ACTUAL_PROGRAM_ID
```

**Expected output:**
```
Program Id: YOUR_ACTUAL_PROGRAM_ID
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: ...
Authority: <your deployer address>
Last Deployed In Slot: ...
Data Length: ...
```

---

## Deploy to Mainnet

> ⚠️ **Cost**: Deploying costs ~3-5 SOL depending on program size. Make sure deployer has enough SOL.

```bash
# Set cluster
solana config set --url mainnet-beta

# Deploy
anchor deploy \
  --provider.cluster mainnet-beta \
  --provider.wallet ~/.config/solana/saturn-deployer.json

# Verify
solana program show YOUR_ACTUAL_PROGRAM_ID --url mainnet-beta
```

---

## Post-Deploy Configuration

### 1. Initialize Global Config

Run this once after deploying to set up the platform config:

```typescript
import { Program, AnchorProvider, web3 } from "@coral-xyz/anchor";
import { SaturnCurve } from "./target/types/saturn_curve";

const provider = AnchorProvider.env();
const program = new Program<SaturnCurve>(IDL, PROGRAM_ID, provider);

// For testing: 1 SOL graduation threshold
const DEVNET_THRESHOLD = 1_000_000_000; // 1 SOL in lamports

// For production: 85 SOL graduation threshold
const MAINNET_THRESHOLD = 85_000_000_000; // 85 SOL in lamports

await program.methods
  .initialize(
    PLATFORM_FEE_WALLET,          // Pubkey - where fees go
    new BN(DEVNET_THRESHOLD),     // graduation threshold
    100,                          // platform fee: 1% (100 bps)
    50,                           // creator fee: 0.5% (50 bps)
  )
  .accounts({
    config: configPDA,
    admin: provider.wallet.publicKey,
    systemProgram: web3.SystemProgram.programId,
  })
  .rpc();
```

### 2. Update Application Config

Add the program ID to your app config:

```typescript
// src/lib/config.ts
export const SATURN_CURVE_PROGRAM_ID = "YOUR_ACTUAL_PROGRAM_ID";
```

### 3. Add Program ID to Edge Function Secrets

```bash
# Using Lovable secrets management
SATURN_CURVE_PROGRAM_ID = "YOUR_ACTUAL_PROGRAM_ID"
```

---

## Program Architecture

### Accounts

| Account | Seeds | Description |
|---------|-------|-------------|
| `GlobalConfig` | `["config"]` | Platform-wide settings (admin, fees, threshold) |
| `Pool` | `["pool", mint]` | Per-token bonding curve state |
| `TokenVault` | `["token_vault", mint]` | PDA holding pool's token balance |
| `SolVault` | `["sol_vault", mint]` | PDA holding pool's SOL balance |

### Instructions

| Instruction | Who Can Call | Description |
|-------------|-------------|-------------|
| `initialize` | Deployer (once) | Set global config |
| `create_pool` | Anyone | Launch a new token with bonding curve |
| `swap` | Anyone | Buy/sell tokens on the curve |
| `graduate` | Anyone (if threshold met) | Mark pool as graduated |
| `update_config` | Admin only | Change fees/threshold |

### Fee Structure

- **Platform fee**: Configurable (default 1% / 100 bps)
- **Creator fee**: Configurable (default 0.5% / 50 bps)
- **Total fee**: Deducted from input on buys, from output on sells
- **Max fee cap**: 10% (1000 bps) enforced on-chain

### Bonding Curve Math

```
Constant Product: (virtual_sol + real_sol) × virtual_tokens = k

Buy:  tokens_out = virtual_tokens × sol_in / (virtual_sol + real_sol + sol_in)
Sell: sol_out = (virtual_sol + real_sol) × tokens_in / (virtual_tokens + tokens_in)
```

### Graduation Flow

1. User buys push `real_sol_reserves` to ≥ `graduation_threshold`
2. Anyone calls `graduate` instruction
3. Program marks pool `is_graduated = true`
4. Server detects graduation event
5. Server migrates liquidity to Meteora DAMM V2:
   - Creates token metadata
   - Creates Meteora locker
   - Migrates SOL + remaining tokens to DAMM V2 pool
   - Locks 100% of LP tokens forever
6. Trading continues on Meteora

---

## Token Economics

| Parameter | Value |
|-----------|-------|
| Total Supply | 1,000,000,000 (1B tokens, 6 decimals) |
| Curve Allocation | 800,000,000 (80%) — available for trading |
| LP Reserve | 200,000,000 (20%) — locked for Meteora migration |
| Initial Virtual SOL | 30 SOL (~$6k initial mcap) |
| Initial Virtual Tokens | 800,000,000 |
| Graduation Threshold | 85 SOL (mainnet) / 1 SOL (devnet) |

---

## Events for Indexers

The program emits three events for DexScreener / Birdeye / Jupiter indexing:

### PoolCreated
```
pool, mint, creator, virtual_sol_reserves, virtual_token_reserves, graduation_threshold, timestamp
```

### SwapExecuted
```
pool, mint, user, is_buy, sol_amount, token_amount, price_lamports_per_token,
virtual_sol_reserves, virtual_token_reserves, real_sol_reserves, bonding_progress_bps, timestamp
```

### PoolGraduated
```
pool, mint, final_sol_reserves, final_price, final_market_cap, timestamp
```

---

## Testing Checklist

### Devnet Testing (1 SOL graduation)

- [ ] Deploy program to devnet
- [ ] Initialize config with 1 SOL threshold
- [ ] Create a test pool (verify PoolCreated event)
- [ ] Buy tokens with 0.1 SOL (verify SwapExecuted event)
- [ ] Sell tokens back (verify reserves update correctly)
- [ ] Buy enough to reach 1 SOL threshold
- [ ] Call graduate (verify PoolGraduated event)
- [ ] Verify pool state shows `is_graduated = true`
- [ ] Trigger server-side Meteora migration
- [ ] Verify DAMM V2 pool created
- [ ] Verify LP tokens locked (100%)
- [ ] Test trading on Meteora pool post-graduation

### Mainnet Verification

- [ ] Deploy program to mainnet
- [ ] Initialize config with 85 SOL threshold
- [ ] Create first pool
- [ ] Verify DexScreener picks up events
- [ ] Monitor graduation at 85 SOL
- [ ] Verify LP lock on Meteora

---

## Upgrade Path

The program is deployed as upgradeable by default. To upgrade:

```bash
# Build new version
anchor build

# Deploy upgrade
anchor upgrade target/deploy/saturn_curve.so \
  --program-id YOUR_ACTUAL_PROGRAM_ID \
  --provider.cluster mainnet-beta \
  --provider.wallet ~/.config/solana/saturn-deployer.json
```

To make the program immutable (after thorough testing):
```bash
solana program set-upgrade-authority YOUR_ACTUAL_PROGRAM_ID --final
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Program deployment failed` | Ensure deployer has enough SOL (5+ SOL) |
| `Instruction too large` | Split into multiple transactions |
| `Account not found` | Ensure PDAs are derived correctly with seeds |
| `Custom program error 0x0` | Check error codes in `SaturnError` enum |
| `Transaction simulation failed` | Check all accounts are passed correctly |
| `Insufficient funds in vault` | Real reserves depleted — check math |
