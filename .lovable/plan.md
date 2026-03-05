
I hear you. The chart is fat/centered because the current viewport logic is forcing too few visible bars (`max(..., 14)` + clamping `from` to `0`), which makes each candle wide and visually centered.

Plan (single file): `src/components/launchpad/CodexChart.tsx`

1) Replace sparse/dense split with one strict right-anchored viewport
- Remove the current `isSparseData` branch and the `Math.max(0, ...)` clamp.
- Use one fixed logical window so candles stay thin even with very few bars:
  - `TARGET_VISIBLE_BARS = 260` (or similar high value)
  - `RIGHT_PADDING_BARS = 4`
  - `from = bars.length - TARGET_VISIBLE_BARS` (allow negative)
  - `to = bars.length + RIGHT_PADDING_BARS`
- This guarantees candles render near the right edge and do not sit in the middle.

2) Force thin candles by restoring low spacing values
- Set spacing back to truly thin values:
  - `NORMAL_BAR_SPACING = 0.8`
  - `NORMAL_MIN_BAR_SPACING = 0.2`
- Apply these consistently in chart creation and initial range setup (no separate “sparse fat” spacing).

3) Stop re-centering on each refresh
- Add a dedicated `initialViewportSet` ref.
- First load/resolution change: set the fixed right-anchored logical range once.
- Subsequent 5s updates: do not reapply range; only call realtime follow when user is already near right edge (so manual pan is preserved).

4) Snapshot-driven verification loop (as requested)
- Capture baseline screenshot on `/trade/9LTqPQigw8QZnvssqJcp6jHsSN75L2R2BjrcpQH2pNCH`.
- Apply the above changes.
- Capture post-change screenshot at same route/resolution.
- If candles are still not thin/right-anchored, increment `TARGET_VISIBLE_BARS` (e.g., 260 → 320) and re-snapshot until:
  - candle bodies are visually thin (line-like),
  - latest candles are pinned to the right side with small right padding.

Technical detail:
````text
Current problem:
- Sparse logic: visibleBars = max(bars.length, 14)
- Range: from = max(0, bars.length - visibleBars), to = bars.length + 3
=> Too few bars visible + clamp to zero => wide candles + centered look

Target behavior:
- Fixed large window regardless of bars count
- Range: from = bars.length - 260, to = bars.length + 4
=> Thin candles + strict right anchoring, even with 3–10 candles
````
