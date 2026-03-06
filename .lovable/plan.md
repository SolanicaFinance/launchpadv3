

## Bug: Chart Not Rendering After Loading

### Root Cause

The `CodexChart` component has a race condition between its loading state and chart initialization:

1. On mount, `bars=[]` and `isLoading=true` → component renders the **loading skeleton** (a different DOM tree, no `containerRef` div)
2. The chart creation `useEffect` fires but `containerRef.current` is null (the container div isn't in the DOM during loading state)
3. Data arrives: `bars=[53 items]`, `isLoading=false` → component switches to the **main chart div** with `ref={containerRef}`
4. The data update `useEffect` fires, but `chartRef.current` is still null because the chart was never created
5. The chart creation `useEffect` does NOT re-run because its dependencies `[height, isFullscreen, showVolume, resolution]` haven't changed

The chart container only exists in the final return path (line 326-330), but during loading the component returns early with a skeleton (line 280-298). When data arrives and the real container mounts, no effect recreates the chart.

### Fix

**File: `src/components/launchpad/CodexChart.tsx`**

Change the component to always render the chart container div (even during loading/error/empty states), and overlay the loading/error/empty UI on top. This ensures `containerRef` is always mounted and the chart creation effect can find it.

Alternatively (simpler): Add `bars.length` to the chart creation effect's dependency array so it re-runs when bars first arrive. Specifically, use a derived boolean like `hasBars = bars.length > 0` to avoid recreating the chart on every poll refresh.

The simpler approach:
1. Add a `const hasBars = bars.length > 0` variable
2. Add `hasBars` to the chart creation `useEffect` dependency array (line 189)
3. This triggers chart creation exactly once when bars transition from empty to populated

This is the minimal fix — one line change to the dependency array plus one variable.

