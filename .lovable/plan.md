

## Problem

The Rewards page (`RewardsPage.tsx`) directly imports `usePrivy` from `@privy-io/react-auth` (line 2), which **violates the bridge architecture**. This causes:
- Hook ordering crashes ("Rendered more hooks than during the previous render")
- `linkTwitter` being undefined or throwing before Privy is ready
- Broken login-to-rewards flow requiring multiple retries

The same issue exists in `PanelMyLaunchesTab.tsx` and `VerifyAccountModal.tsx`.

## Root Cause

The `PrivyBridgeData` interface does not expose `linkTwitter` (or `linkEmail`). Components that need these functions bypass the bridge and call `usePrivy()` directly, which is unsafe during Privy's initialization phase.

## Plan

### 1. Extend the Privy Bridge to expose `linkTwitter`

**File: `src/providers/PrivyProviderWrapper.tsx`**
- Add `linkTwitter: () => Promise<void>` to `PrivyBridgeData.privy`
- Set default to a noop in `DEFAULT_BRIDGE`
- In `InnerReadyGate`, pass `privyResult.linkTwitter` into `bridgeValue.privy`

### 2. Expose `linkTwitter` via `useAuth` hook

**File: `src/hooks/useAuth.ts`**
- Add `linkTwitter` to `UseAuthReturn` interface
- Pull it from `usePrivyBridge().privy.linkTwitter`
- Expose the Privy `user` object (with `linkedAccounts`) so the page can check Twitter link status without importing Privy directly

### 3. Rewrite RewardsPage to use only the bridge

**File: `src/pages/RewardsPage.tsx`**
- Remove `import { usePrivy } from "@privy-io/react-auth"`
- Use `useAuth()` for login, authentication status, user data, and `linkTwitter`
- Use `usePrivyBridge()` to access `privy.user.linkedAccounts` for Twitter status
- Add a proper loading state that waits for `privy.ready` before rendering auth-dependent UI
- Add guard: if `!ready`, show spinner (prevents flash of "login" screen before Privy initializes)

### 4. Fix the same pattern in other files

**Files: `src/components/panel/PanelMyLaunchesTab.tsx`, `src/components/launchpad/VerifyAccountModal.tsx`**
- Replace direct `usePrivy()` imports with `usePrivyBridge()` for `linkTwitter`

### Flow after fix

```text
User visits /rewards
  → Privy initializing? → Show spinner
  → Not authenticated? → Show "Login" button (calls bridge login)
  → Authenticated, no Twitter linked? → Show "Authorize X" (calls bridge linkTwitter)
  → Twitter linked, not joined? → Show "Join" button
  → Joined → Show dashboard
```

All steps use the bridge — no direct Privy hook calls, no hook ordering issues, single smooth flow.

