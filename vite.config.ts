/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: true, // Fail if port 8080 is in use instead of trying another port
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    /** Downlevel ??, ?., etc. so older Safari/WebKit can parse the bundle. */
    target: "es2018",
  },
  build: {
    /** Rollup output baseline (keep in sync with esbuild.target). */
    target: "es2018",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
}));
