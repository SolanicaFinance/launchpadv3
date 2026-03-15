

## Use Saturn Logo as Default Trader Avatar

**File:** `src/pages/AlphaTrackerPage.tsx` (lines 207-212)

**Change:** Replace the text-initial fallback with the Saturn logo (`/saturn-logo.png`) as a default avatar image for traders who haven't set a profile picture.

```tsx
// Before (text initial):
{trade.trader_avatar_url ? (
  <img src={trade.trader_avatar_url} ... />
) : (
  <span className="text-[7px] ...">X</span>
)}

// After (logo fallback):
<img src={trade.trader_avatar_url || "/saturn-logo.png"} alt="" className="h-full w-full object-cover" />
```

Same change in `src/components/home/AlphaSection.tsx` if it has a similar trader avatar block.

One-line change per file. Every trader row will show either their profile image or the Saturn logo.

