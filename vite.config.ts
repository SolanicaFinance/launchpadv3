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
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    commonjsOptions: {
      ignoreTryCatch: 'remove',
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning?.code === "INVALID_ANNOTATION") return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          // ONLY split libraries that have ZERO React dependency chain.
          // wagmi, rainbow, Privy, TanStack, Radix all transitively import React
          // and MUST stay in the main chunk to avoid "createContext is undefined" errors.
          if (id.includes('node_modules/@solana')) return 'vendor-solana';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts';
          if (id.includes('node_modules/lightweight-charts')) return 'vendor-lwcharts';
          if (id.includes('node_modules/bn.js') || id.includes('node_modules/buffer') || id.includes('node_modules/bs58')) return 'vendor-crypto-utils';
          // @phosphor-icons kept in main bundle — used across 37+ files
          // viem + wagmi share circular deps — MUST stay in same chunk
          if (id.includes('node_modules/viem') || id.includes('node_modules/wagmi')) return 'vendor-evm';
        },
      },
    },
  },
  define: {
    // Ensure global is defined for libraries that expect Node.js globals
    global: 'globalThis',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensure only a single copy of React is used (fixes "useEffect is null" errors)
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
}));
