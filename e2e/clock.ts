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
  await page.clock.setFixedTime(new Date(`${seedToday()}T${hhmm}:00${PR_OFFSET}`));
}
