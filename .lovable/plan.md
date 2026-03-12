

## Plan: Remove Logo from Home Hero Section

Remove the MoonDexo logo image block (lines 380-389) from the hero content in `src/pages/HomePage.tsx`. Also remove the unused `saturnLogo` import on line 16 if no other usage exists in the file.

### File: `src/pages/HomePage.tsx`
1. Delete line 16: `import saturnLogo from "@/assets/moondexo-logo.png";`
2. Delete lines 380-389: The logo container div with the glow effect and `<img>` tag

No other files affected.

