

# Fix: X Bot Rules Enforcement and Footer

## Problems Found

1. **Footer not appearing**: The reply text stored in the database has no footer appended. The `buildReplyWithFooter` function exists in code but the **deployed edge function** appears to be a stale version without it. Need to ensure the footer logic is correctly wired and redeploy.

2. **Non-blue-check accounts getting replies**: The scan function (`x-bot-scan`) correctly checks `require_blue_verified`, but the reply function (`x-bot-reply`) does NOT re-validate queued items. Tweets queued before rule changes still get processed.

3. **Queue backlog with sub-1000 follower accounts**: Some queued items have follower counts below the 1000 minimum (e.g., `enjoywithouthey` at 2252 is fine, but `covfefe_is` at 1149 and `mork1e` at 1478 are below acceptable thresholds if you raise the minimum).

## Plan

### Step 1: Add re-validation in `x-bot-reply` (the critical fix)

In `supabase/functions/x-bot-reply/index.ts`, add a **pre-reply validation block** after fetching account rules (around line 360). Before generating or posting any reply, re-check:
- `is_verified` field on the queue item against `rules.require_blue_verified`
- `follower_count` on the queue item against `rules.min_follower_count`
- If either fails, mark item as `skipped` and continue

This ensures that even if a tweet was queued before rules were tightened, it gets filtered out at reply time.

### Step 2: Verify footer is correctly applied

The code at line 453 calls `buildReplyWithFooter(replyText)` and stores `finalReplyText` — this looks correct. But the DB shows replies without footers. The fix is to:
- Confirm the footer constant is correct (it is: line 10)
- Ensure the stored `reply_text` in the insert at line 478 uses `finalReplyText` (it does)
- **Redeploy** the edge function to ensure the live version matches the code

### Step 3: Fix the `x-bot-scan` missing `for` loop

There's a syntax issue in the scan function — lines 146-148 jump from variable declarations into `rulesMap.get(account.id)` without the `for (const account of accounts)` loop. This needs to be added back to prevent the scan from crashing or only processing one account.

### Step 4: Purge non-compliant queue items

Add a cleanup step at the start of `x-bot-reply` that purges any pending queue items where `is_verified = false` (when the account's rules require blue verification) or `follower_count < min_follower_count`.

### Files Changed
- `supabase/functions/x-bot-reply/index.ts` — Add re-validation, ensure footer, add rule-based purge
- `supabase/functions/x-bot-scan/index.ts` — Fix missing `for` loop

