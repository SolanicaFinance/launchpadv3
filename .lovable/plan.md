

## Problem
The Holders tab in `TokenDataTabs` currently displays a static count passed as a prop. It doesn't fetch real on-chain holder data, doesn't auto-refresh, and doesn't refetch when switching tabs.

## Plan

### 1. Create `useTokenHolders` hook (new file: `src/hooks/useTokenHolders.ts`)
- Calls the existing `fetch-token-holders` edge function (uses Helius API) with the mint address
- Returns `{ holders: string[], count: number, isLoading, refetch }`
- Accepts an `enabled` boolean so we only fetch when the holders tab is active
- Uses `refetchInterval: 5000` to auto-poll every 5 seconds while the tab is active

### 2. Update `TokenDataTabs` component
- Add state tracking for active tab (already exists)
- Call the new `useTokenHolders` hook with `enabled: activeTab === "holders"`
- When user clicks the Holders tab, React Query will automatically trigger a fresh fetch (since `enabled` flips to true)
- The 5-second polling keeps data fresh while viewing
- Show a loading spinner while fetching
- Display the accurate holder count from the edge function response (not the stale prop)
- Update the tab badge count to use live data when available

### 3. Holders tab content
- Replace the static number display with: live count + loading indicator + last-updated timestamp
- Show a small "LIVE" pulse indicator to signal auto-refresh is active

### Files to modify
- **New**: `src/hooks/useTokenHolders.ts`
- **Edit**: `src/components/launchpad/TokenDataTabs.tsx`

