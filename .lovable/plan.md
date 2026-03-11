

## Fix: Privy User Count Returns 1 Instead of 500+

### Root Cause
The Privy REST API (`GET /api/v1/users`) does **not** return a `total` field. The response only contains `data` (array) and `next_cursor`. The current code does `data.total ?? data.data?.length ?? 0`, which falls back to `data.data.length` = 1 (since we set `limit=1`).

### Solution
Paginate through all users to get an accurate count. The Privy API returns up to 100 users per page with cursor-based pagination. For ~500 users, this means ~5 API calls (fast, server-side).

### Changes

**File: `supabase/functions/privy-user-count/index.ts`**

Replace the single `fetch` call with a pagination loop:

```typescript
let totalCount = 0;
let cursor: string | undefined;

do {
  const url = new URL("https://auth.privy.io/api/v1/users");
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${auth}`,
      "privy-app-id": appId,
    },
  });

  if (!res.ok) { /* handle error */ }

  const page = await res.json();
  totalCount += page.data?.length ?? 0;
  cursor = page.next_cursor || undefined;
} while (cursor);
```

- Keep the existing 5-minute cache so this loop only runs once every 5 minutes
- Cache stays in-memory on the edge function instance
- ~500 users = ~5 requests, completes in under 2 seconds

