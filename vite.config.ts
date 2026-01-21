import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
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
});
