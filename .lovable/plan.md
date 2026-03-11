

## Plan: Replace Create Token Popup with Phantom Launcher

### Current State
- The "+" button (in sidebar and header) links to `/?create=1`, which opens `CreateTokenModal`
- `CreateTokenModal` currently just shows instructions to tweet at @saturntrade on X — no actual launch capability
- The Phantom launch flow already exists in `TokenLauncher` component (mode="phantom"), used in `PanelPhantomTab`

### What Changes

**1. Rewrite `CreateTokenModal` to embed the Phantom launcher**

Replace the current "tweet instructions" content in `src/components/launchpad/CreateTokenModal.tsx` with:
- Import and render `<TokenLauncher bare defaultMode="phantom" />` inside the modal
- Keep the modal shell (backdrop, close button, mobile drag handle) but replace the body content
- Add success result display (mint address, trade link) similar to `PanelPhantomTab`
- On successful launch, show the result inline and allow "Launch Another" or close
- The modal already has responsive mobile/desktop styling — keep that

**2. Update modal sizing**

The current modal is `max-w-[540px]`. The Phantom launcher UI needs slightly more room for:
- Phantom connect button
- Sub-mode tabs (Random / Describe / Realistic / Custom)
- Token preview with image, name, ticker fields
- Trading fee slider
- Dev buy input
- Launch button

Increase to `max-w-[600px]` and ensure `max-h-[90vh]` with overflow scroll works for the launcher content.

**3. No backend changes needed**

The Phantom launch flow already works end-to-end via:
- `usePhantomWallet` hook (connect, sign, send)
- `fun-phantom-create` edge function (builds unsigned transactions)
- Token is signed by Phantom and sent to chain

### Files to Edit
- `src/components/launchpad/CreateTokenModal.tsx` — full rewrite to embed `TokenLauncher` with `defaultMode="phantom"`

