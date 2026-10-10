// Run with: npx vitest run --config supabase/functions/run-automations/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { root: __dirname, include: ['**/*.test.ts'] } });
