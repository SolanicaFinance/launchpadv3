

## Plan: Disable Agent Posting + Bulk SOL Recovery from Trading Agents

### What We're Doing

1. **Disable all agent posting systems** — The three edge functions that auto-post (`agent-hourly-post`, `agent-auto-engage`, `claw-agent-engage`) will return early with a "disabled" response, preventing any further forum posts from agents.

2. **Create a bulk SOL recovery edge function** — A new `trading-agent-reclaim-all` edge function that:
   - Fetches ALL trading agents (both `trading_agents` and `claw_trading_agents` tables)
   - For each agent with an encrypted wallet key and SOL balance > dust threshold
   - Force-sells all token positions via Jupiter (reusing the `force-sell` pattern)
   - Transfers remaining SOL to the treasury wallet (`HSVmkUnmkjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx`)
   - Marks agents as `disabled` in the database
   - Returns a summary of recovered SOL

3. **Add a one-click admin button** — In `TreasuryAdminPage.tsx`, add a "Reclaim All Agent SOL" button that invokes this edge function and shows progress/results.

### Files

| File | Action |
|------|--------|
| `supabase/functions/agent-hourly-post/index.ts` | Edit — return disabled immediately |
| `supabase/functions/agent-auto-engage/index.ts` | Edit — return disabled immediately |
| `supabase/functions/claw-agent-engage/index.ts` | Edit — return disabled immediately |
| `supabase/functions/trading-agent-reclaim-all/index.ts` | Create — bulk sell + SOL transfer to treasury |
| `src/pages/TreasuryAdminPage.tsx` | Edit — add "Reclaim All Agent SOL" button + results panel |

### Edge Function: `trading-agent-reclaim-all`

- Protected by `TWITTER_BOT_ADMIN_SECRET` (same pattern as `trading-agent-force-sell`)
- Queries both `trading_agents` and `claw_trading_agents` for all agents with `wallet_private_key_encrypted`
- For each agent:
  1. Decrypt wallet using dual-key approach (API_ENCRYPTION_KEY / WALLET_ENCRYPTION_KEY)
  2. Check SOL balance on-chain
  3. Scan for token holdings, sell via Jupiter with escalating slippage (15% → 25% → 50%)
  4. Close empty token accounts to reclaim rent
  5. Transfer all remaining SOL (minus tx fee) to treasury
  6. Update agent status to `disabled`, set `trading_capital_sol` to 0
- Returns per-agent results: wallet, SOL recovered, tokens sold, errors

### Admin UI Button

Added to the Treasury Admin page as a new card/section:
- "Reclaim All Agent SOL" button (red, destructive styling)
- Confirmation dialog before execution
- Shows live progress and final summary (total SOL recovered, agents processed, failures)

