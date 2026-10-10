import { format } from 'date-fns';

/**
 * Default pay-schedule anchor when a business has not saved one.
 *
 * Pay periods are bucketed by the browser's local calendar day (see `getPayPeriodRangeForDate`,
 * which parses the anchor with `parseISO` => local midnight), so the default anchor must be
 * "today" in that same local calendar — not the UTC date, which in Puerto Rico (UTC-4) is
 * already tomorrow from 20:00 local.
 */
export function defaultPayScheduleAnchorISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** Saved anchor if present, otherwise today's local calendar date (YYYY-MM-DD). */
export function resolvePayScheduleAnchorISO(
  savedAnchorISO: string | null | undefined,
  now: Date = new Date(),
): string {
  return savedAnchorISO || defaultPayScheduleAnchorISO(now);
}
