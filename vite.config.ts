import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          lottie: ["lottie-react"],
          framer: ["framer-motion"],
          charts: ["lightweight-charts"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
