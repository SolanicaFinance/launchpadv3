

## Plan: Replace Default Profile Avatar with Saturn Trade Logo

**What**: Replace the current default profile avatar image with the uploaded Saturn Trade pixel-art logo, so every user sees it as their profile picture until they upload a custom one.

**Changes**:

1. **Copy uploaded image** to `src/assets/default-avatar.png` (overwrite the existing file)
   - The uploaded Saturn Trade logo (`user-uploads://image-603.png`) will replace the current default avatar

2. **No code changes needed** — `UserProfilePage.tsx` already imports and uses `default-avatar.png` as the fallback when `avatar_url` is null. The same image will also be used in any other place referencing this asset.

3. **Ensure consistent fallback everywhere** — Check `HeaderWalletBalance.tsx` and `EditProfileModal.tsx` which currently show a generic `User` icon or empty state when no avatar is set. Update these to also use the Saturn Trade logo as the default fallback instead of showing a blank icon.

**Files to modify**:
- `src/assets/default-avatar.png` — overwrite with uploaded image
- `src/components/layout/HeaderWalletBalance.tsx` — import and use `defaultAvatar` instead of `User` icon when no `avatar_url`
- `src/components/profile/EditProfileModal.tsx` — use `defaultAvatar` as preview default

