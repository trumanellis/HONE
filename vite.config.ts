import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: Number(process.env.HONE_DEV_PORT) || 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Disable source maps in production
    sourcemap: false,
  },
  define: {
    // Polyfill Buffer for gray-matter
    global: "globalThis",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
