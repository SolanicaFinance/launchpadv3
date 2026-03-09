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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning?.code === "INVALID_ANNOTATION") return;
        warn(warning);
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
