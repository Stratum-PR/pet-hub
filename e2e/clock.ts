import type { Page } from '@playwright/test';
import { seedData } from './fixtures';

/** Puerto Rico has no daylight saving time. */
const PR_OFFSET = '-04:00';

/**
 * The business's "today" as the seed saw it (YYYY-MM-DD in America/Puerto_Rico). Flows compare against seeded rows,
 * so they use the seed's day, not the wall clock: a run that crosses Puerto Rico midnight (20:00 PR = 00:00 UTC) after
 * global-setup would otherwise look at a different day than the rows were written for.
 */
export function seedToday(): string {
  return seedData().appointments.checkout.date;
}

/**
 * Pins the browser clock to `hh:mm` Puerto Rico time on the seed's day (timers keep running).
 *
 * auth-js keeps the server's `expires_at` (real time) and calls a session expired once
 * `expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS` (90 s). With the browser clock pinned more than ~58 min ahead of
 * real time (the local JWT lives 1 h), every `getSession()` refreshed the token first: 20-27 refreshes per flow.
 * So the token responses' `expires_at` moves by the same offset as the clock, and the browser sees the session's real
 * remaining lifetime. Only that client-side bookkeeping changes; the JWT the server checks is untouched.
 */
export async function pinBrowserClock(page: Page, hhmm: string) {
  const pinned = new Date(`${seedToday()}T${hhmm}:00${PR_OFFSET}`);
  const skewSeconds = Math.round((pinned.getTime() - Date.now()) / 1000);
  // TEMP U31 instrumentation (removed before the final head): count token refreshes per test.
  const started = Date.now();
  let refreshes = 0;
  let tokenCalls = 0;
  page.on('request', (r) => {
    if (!r.url().includes('/auth/v1/token') || r.method() !== 'POST') return;
    tokenCalls++;
    if (r.url().includes('grant_type=refresh_token')) refreshes++;
  });
  page.on('close', () => console.log(`[U31] pin ${hhmm} (fixed): token calls=${tokenCalls} refreshes=${refreshes} skew=${Math.round(skewSeconds / 60)}min page-life=${Date.now() - started}ms`));
  await page.route('**/auth/v1/token?*', async (route) => {
    const response = await route.fetch();
    const body = response.ok() ? await response.json().catch(() => null) : null;
    if (typeof body?.expires_at !== 'number') return route.fulfill({ response });
    return route.fulfill({ response, json: { ...body, expires_at: body.expires_at + skewSeconds } });
  });
  await page.clock.setFixedTime(pinned);
}
