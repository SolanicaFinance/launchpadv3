

## Professional Responsive Terminal Grid Redesign

The current layout has two issues:
1. **Mobile/tablet**: Simple tab switcher with basic styling -- not adaptive or professional
2. **Desktop columns**: Functional but lack polish (no height management, basic headers, no visual hierarchy)

### Plan

**1. Responsive breakpoints (AxiomTerminalGrid.tsx)**
- **Mobile (<640px)**: Swipeable single-column with premium tab bar (sticky, with active indicator animation)
- **Tablet (640px-1279px)**: Two-column split -- "New Pairs" on left, togglable "Final Stretch / Migrated" on right via segmented control
- **Desktop (1280px+)**: Three equal columns (keep current `xl:grid grid-cols-3`)

**2. Upgraded column headers (AxiomTerminalGrid.tsx)**
- Replace basic `PulseColumnHeader` with a premium version:
  - Column icon with subtle gradient background pill
  - Live count badge with pulse animation dot
  - Remove P1/P2/P3 placeholder buttons (unused)
  - Add subtle bottom highlight line matching column theme color (green for New, orange for Final Stretch, blue for Migrated)

**3. Professional mobile tab bar (AxiomTerminalGrid.tsx)**
- Sticky top position
- Animated sliding underline indicator (not just border-b color swap)
- Each tab gets a themed dot color indicator
- Count badge redesigned as a small rounded pill with mono font

**4. Tablet two-column layout (AxiomTerminalGrid.tsx)**
- New breakpoint class: `hidden sm:grid sm:grid-cols-2 xl:hidden`
- Left column always shows "New Pairs"
- Right column has an inline segmented toggle between "Final Stretch" and "Migrated"

**5. Column scroll improvements (index.css)**
- Add `scroll-behavior: smooth`
- Add fade-out gradient at bottom of each column to indicate scrollability
- Improve scrollbar styling with rounded thumb

**6. Card spacing and density (index.css)**
- Reduce card gap from `gap-3` to `gap-2` on mobile for density
- Keep `gap-3` on tablet/desktop
- Add a subtle left border accent to cards based on column (green/orange/blue)

**7. Empty state upgrade (AxiomTerminalGrid.tsx)**
- Replace emoji with a styled icon
- Add subtle pulsing animation to indicate "waiting for data"

### Files to modify
- `src/components/launchpad/AxiomTerminalGrid.tsx` -- layout logic, breakpoints, headers, tabs
- `src/index.css` -- new responsive styles, scroll improvements, animations

