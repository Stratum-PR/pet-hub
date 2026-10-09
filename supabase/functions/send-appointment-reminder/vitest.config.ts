// Runs this function's pure-module tests under Node with Vitest (Deno is not installed in CI or locally):
//   npx vitest run -c supabase/functions/send-appointment-reminder/vitest.config.ts
// Not deployed: the Edge Function bundle only contains what index.ts imports.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "send-appointment-reminder",
    root: import.meta.dirname,
    environment: "node",
    include: ["*.test.ts"],
  },
});
