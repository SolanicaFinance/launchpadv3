

## Static Landing Page (`public/lando.htm`) — Responsive

### What It Does
A single self-contained HTML file showing a compressed screenshot of the trade page as a dimmed background, with a pixel-perfect recreation of the "Connect to Trade" popup centered on top. All popup text is `contenteditable`. Fully responsive across mobile, tablet, and desktop.

### Steps

1. **Take screenshot** of `/trade` page via browser tool, compress to JPEG (~60-80KB), save as `public/images/trade-bg.jpg`

2. **Create `public/lando.htm`** — single file, zero dependencies:
   - **Background**: Full-viewport trade screenshot with `object-fit: cover` + dark overlay (`rgba(0,0,0,0.6)`)
   - **Popup**: Pixel-perfect clone of `NotLoggedInModal` with inline CSS:
     - Top gradient accent line, Link2/Zap/Shield as inline SVGs
     - All text nodes (`h3`, `p`, `span`, `button`) get `contenteditable="true"`
   - **Responsive**:
     - Desktop: `max-width: 380px` centered card
     - Mobile (<480px): `width: calc(100vw - 2rem)`, smaller padding (20px vs 24px), slightly smaller font sizes
     - Tablet (480-768px): Intermediate sizing
   - Colors: `#C8FF00` primary, `#121212` card, mono font stack
   - No JS required, pure HTML+CSS

### Files
- **Create**: `public/images/trade-bg.jpg` (screenshot)
- **Create**: `public/lando.htm`

