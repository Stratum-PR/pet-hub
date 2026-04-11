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
  plugins: [
    react({
      /** Align dev SWC output with production (defaults to es2020 and skips Vite esbuild). */
      devTarget: "es2018",
    }),
  ].filter(Boolean),
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
    /**
     * Force downleveling across the full graph (deps included). Plain "es2018" has left
     * `??` / `?.` in vendor chunks before, which breaks older WebKit at parse time.
     */
    target: ["es2018", "safari12", "ios12"],
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
