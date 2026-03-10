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
          // React MUST be in its own chunk so it's available before all others
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor-react';
          // Split heavy vendor deps into separate chunks to reduce peak memory
          if (id.includes('node_modules/@solana')) return 'vendor-solana';
          if (id.includes('node_modules/viem')) return 'vendor-viem';
          if (id.includes('node_modules/wagmi') || id.includes('node_modules/@rainbow-me')) return 'vendor-evm';
          if (id.includes('node_modules/@meteora-ag')) return 'vendor-meteora';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts';
          if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';
          if (id.includes('node_modules/lightweight-charts')) return 'vendor-lwcharts';
          if (id.includes('node_modules/@privy-io')) return 'vendor-privy';
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          if (id.includes('node_modules/@tanstack')) return 'vendor-tanstack';
          if (id.includes('node_modules/bn.js') || id.includes('node_modules/buffer') || id.includes('node_modules/bs58')) return 'vendor-crypto-utils';
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
