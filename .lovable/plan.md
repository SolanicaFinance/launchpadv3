

# Optimistic Quick Buy Toast with Progress Bar

## Problem
Currently, the quick buy toast only appears **after** the swap completes. Users have no immediate feedback that their trade was submitted.

## Solution
Use Sonner's toast ID pattern to show an **instant optimistic toast** on click, with a loading indicator, then **update the same toast** with the TX link once confirmed.

### Flow
1. **On click** → Immediately show toast: `"⚡ Trade Executing..."` with a spinning loader and the token name/amount
2. **On success** → Update same toast to `"✅ Trade Executed"` with TX link and latency
3. **On error** → Update same toast to `"❌ Trade Failed"` with error message

### Implementation

**File: `src/components/launchpad/PulseQuickBuyButton.tsx`**

In all three trade handlers (`handleTriggerClick`, `handleBuy`, `handleSell100`):

1. Generate a unique toast ID before calling `executeFastSwap`
2. Immediately call `toast.loading("⚡ Trade Executing...", { id, description: "0.5 SOL of $TOKEN" })`
3. On `.then(success)` → `toast.success("Trade Executed!", { id, description: "TX: abc123... · 340ms", action: { label: "View TX", onClick: open solscan } })`
4. On `.catch(error)` → `toast.error("Trade Failed", { id, description: error.message })`

This uses Sonner's built-in toast update-by-ID — no new components needed. The loading toast has a built-in animated progress indicator.

### Scope
- Single file edit: `PulseQuickBuyButton.tsx`
- ~3 code sections updated (the 3 swap call sites)
- No new dependencies

