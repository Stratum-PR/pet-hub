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

/** Pins the browser clock to `hh:mm` Puerto Rico time on the seed's day (timers keep running). */
export async function pinBrowserClock(page: Page, hhmm: string) {
  // TEMP U31 instrumentation (removed before the final head): count token refreshes per test.
  const started = Date.now();
  let refreshes = 0;
  let tokenCalls = 0;
  page.on('request', (r) => {
    if (!r.url().includes('/auth/v1/token')) return;
    tokenCalls++;
    if (r.url().includes('grant_type=refresh_token')) refreshes++;
  });
  page.on('close', () => console.log(`[U31] pin ${hhmm}: token calls=${tokenCalls} refreshes=${refreshes} skew=${Math.round((new Date(`${seedToday()}T${hhmm}:00${PR_OFFSET}`).getTime() - started) / 60000)}min page-life=${Date.now() - started}ms`));
  await page.clock.setFixedTime(new Date(`${seedToday()}T${hhmm}:00${PR_OFFSET}`));
}
