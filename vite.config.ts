/// <reference types="vitest/config" />
import fs from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/** Dev-only: receive browser debug NDJSON (same-origin) when Cursor ingest on :7389 is unreachable. */
function agentDebugNDJSONIngest(): Plugin {
  const logPath = path.resolve(__dirname, ".cursor/debug-be8983.log");
  return {
    name: "agent-debug-ndjson-ingest",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/__agent-debug-be8983" || req.method !== "POST") {
          return next();
        }
        const chunks: Buffer[] = [];
        req.on("data", (ch) => chunks.push(ch as Buffer));
        req.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf8").trim();
            if (body) {
              fs.mkdirSync(path.dirname(logPath), { recursive: true });
              fs.appendFileSync(logPath, `${body}\n`, "utf8");
            }
          } catch {
            // ignore
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

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
    mode === "development" ? agentDebugNDJSONIngest() : null,
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
