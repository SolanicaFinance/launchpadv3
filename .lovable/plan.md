

## Add Real On-Chain Rug-Check Data

### Current State
The safety indicators in `UniversalTradePanel.tsx` (lines 218-223) and `TradePanelWithSwap.tsx` (lines 174-178) are **hardcoded**:
- "Authority revoked" → always `true`
- "Liquidity locked" → always `true`
- "No creator allocation" → always `false`

These provide zero actual safety information.

### Best API: RugCheck.xyz

**RugCheck.xyz** (`https://api.rugcheck.xyz/v1/tokens/{mint}/report`) is the most accurate and widely-used Solana token safety API. It returns:
- **Mint authority status** (revoked or not)
- **Freeze authority status**
- **Liquidity lock/burn status** (LP burned percentage)
- **Top holder concentration**
- **Risk level** and **risk score**
- **Specific warnings** (honeypot, hidden mint, etc.)

It's free (5 req/min rate limit on public tier), no API key required for basic usage. We'll proxy through an edge function to avoid CORS and add caching.

### Plan

#### 1. Create edge function `supabase/functions/rugcheck-report/index.ts`
- Accepts `{ mintAddress: string }`
- Calls `https://api.rugcheck.xyz/v1/tokens/{mint}/report`
- Extracts and returns: `mintAuthorityRevoked`, `freezeAuthorityRevoked`, `liquidityLocked` (bool), `liquidityLockedPct` (number), `topHolderPct`, `riskLevel` (string), `riskScore` (number), `warnings` (string array)
- Caches results in memory (Map) for 60s to respect rate limits

#### 2. Create hook `src/hooks/useRugCheck.ts`
- Calls the edge function via `supabase.functions.invoke("rugcheck-report", { body: { mintAddress } })`
- Returns typed `RugCheckReport` with loading/error states
- `staleTime: 60_000`, `refetchInterval: 120_000` (light polling)
- Enabled only when `mintAddress` is provided

#### 3. Update `UniversalTradePanel.tsx` and `TradePanelWithSwap.tsx`
- Import and call `useRugCheck(token.mint_address)`
- Replace hardcoded `safetyChecks` array with real data:
  - **"ff Launched"** → keep existing logic (`token.graduated !== false`)
  - **"Authority revoked"** → `rugCheck?.mintAuthorityRevoked === true`
  - **"Liquidity locked"** → `rugCheck?.liquidityLocked === true`
  - **"Top 10 < 30%"** → `rugCheck?.topHolderPct < 30` (replaces "No creator allocation" with a more useful metric)
- Show a small loading spinner on each indicator while data loads
- If rugcheck fails, fall back to `null` (show a neutral "?" icon instead of green/red)

