import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { assertLocalStack, type Seed } from './seed';

/** Written by global-setup for this run; holds local-only test credentials, so it lives under ignored test-results/. */
export const SEED_FILE = join(process.cwd(), 'test-results', 'e2e-seed.json');

let cached: Seed | null = null;
export function seedData(): Seed {
  cached ??= JSON.parse(readFileSync(SEED_FILE, 'utf8')) as Seed;
  return cached;
}

/** Every flow gets a page whose cookie banner is dismissed ("Rechazar todas") whenever it shows up. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addLocatorHandler(page.getByRole('dialog', { name: 'Política de cookies' }), async (dialog) => {
      await dialog.getByRole('button', { name: 'Rechazar todas' }).click();
    });
    await provide(page);
  },
});
export { expect, type Page };

/** Signs in through the real login form. */
export async function login(page: Page, email: string, pass: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function loginAsManager(page: Page) {
  const s = seedData();
  await login(page, s.manager.email, s.manager.pass);
  await expect(page).toHaveURL(new RegExp(`/${s.slug}/`));
}

/** A date `daysAhead` from today, picked in a react-day-picker month grid (moves to next month when needed). */
export async function pickDay(page: Page, daysAhead: number) {
  const target = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  if (target.getMonth() !== new Date().getMonth()) {
    await page.getByRole('button', { name: 'Go to next month' }).first().click();
  }
  // Early days can also show as next month's trailing cells, late days as last month's leading cells.
  const cells = page.getByRole('gridcell', { name: String(target.getDate()), exact: true });
  await (target.getDate() <= 14 ? cells.first() : cells.last()).click();
  return target;
}

/** Selects the day `daysAhead` from today in the appointment dialog's week strip ("vie 9"). */
export async function pickWeekStripDay(scope: Locator, daysAhead: number) {
  const target = new Date(Date.now() + daysAhead * 24 * 3600 * 1000);
  const day = scope.getByRole('button', { name: new RegExp(`^\\S+ ${target.getDate()}$`) });
  if (!(await day.isVisible())) await scope.getByRole('button', { name: 'Semana siguiente' }).click();
  await day.click();
  return target;
}

/** Service-role client for the LOCAL stack, to check what a flow saved. */
export function adminDb() {
  const { TEST_API_URL, TEST_SERVICE_KEY } = process.env;
  if (!TEST_API_URL || !TEST_SERVICE_KEY) throw new Error('Missing TEST_API_URL / TEST_SERVICE_KEY. Use: npm run test:e2e');
  assertLocalStack(TEST_API_URL);
  return createClient(TEST_API_URL, TEST_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
