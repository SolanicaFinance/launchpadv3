import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Silence noisy (but harmless) Rollup warnings coming from some dependencies.
  // This keeps CI logs clean while preserving real warnings/errors.
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // e.g. "contains an annotation that Rollup cannot interpret" (/*#__PURE__*/)
        if (warning?.code === "INVALID_ANNOTATION") return;
        warn(warning);
      },
      output: {
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI components
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-avatar',
            '@radix-ui/react-scroll-area',
          ],
          // Charts
          'vendor-charts': ['recharts'],
          // Solana/Web3
          'vendor-solana': ['@solana/web3.js', '@solana/spl-token'],
          // Date utilities
          'vendor-date': ['date-fns'],
          // Query/state management
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensure only a single copy of React is used (fixes "useEffect is null" errors)
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
}));
