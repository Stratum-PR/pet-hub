// Smoke E2E (P1-07): the real app against the LOCAL test stack, with data seeded per run (e2e/global-setup.ts).
// Run with `npm run test:e2e` (after `npm run test:env:up`); it reads the stack's URL and keys from
// `supabase status` and refuses to run against anything that isn't the local test stack.
import { defineConfig, devices } from '@playwright/test';

const PORT = 55440;
const apiUrl = process.env.TEST_API_URL ?? '';
const anonKey = process.env.TEST_ANON_KEY ?? '';
// Dual-frontend gate (P1-13, scripts/test-env-dual.mjs): serve another ref's built frontend instead of this
// branch's dev server, and also write a JSON report it can read. Unset (the default), nothing changes.
const webCommand = process.env.E2E_WEB_COMMAND;
const jsonReport = process.env.E2E_JSON_REPORT;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Flows share one seeded business and run in order; a fresh business is seeded each run.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'reports/e2e' }],
    ...(jsonReport ? [['json', { outputFile: jsonReport }] as const] : []),
  ],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-PR',
    timezoneId: 'America/Puerto_Rico',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: webCommand ?? `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Values already in the environment win over .env files, so the app talks to the local stack.
    env: { VITE_SUPABASE_URL: apiUrl, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey },
  },
});
