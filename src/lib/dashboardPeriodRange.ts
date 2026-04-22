import { addDays, startOfDay } from 'date-fns';

export type DashboardPeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export const DASHBOARD_PERIOD_KEY = 'pet-hub-dashboard-period';
export const DASHBOARD_CUSTOM_RANGE_KEY = 'pet-hub-dashboard-custom-range';

export function loadSavedPeriod(): DashboardPeriodType {
  if (typeof window === 'undefined') return 'monthly';
  try {
    const saved = localStorage.getItem(DASHBOARD_PERIOD_KEY);
    if (
      saved === 'weekly' ||
      saved === 'monthly' ||
      saved === 'quarterly' ||
      saved === 'yearly' ||
      saved === 'custom'
    )
      return saved;
  } catch {
    /* ignore */
  }
  return 'monthly';
}

export function loadSavedCustomRange(): { start: Date; end: Date } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DASHBOARD_CUSTOM_RANGE_KEY);
    if (!raw) return null;
    const { start, end } = JSON.parse(raw) as { start?: string; end?: string };
    if (start && end) return { start: new Date(start), end: new Date(end) };
  } catch {
    /* ignore */
  }
  return null;
}

export function persistCustomRange(start: Date, end: Date): void {
  try {
    localStorage.setItem(
      DASHBOARD_CUSTOM_RANGE_KEY,
      JSON.stringify({ start: start.toISOString(), end: end.toISOString() })
    );
  } catch {
    /* ignore */
  }
}

export function sumSaleCentsInInclusiveDayRange(
  sales: { created_at: string; total: number }[],
  rangeStart: Date,
  rangeEnd: Date
): number {
  const startTs = startOfDay(rangeStart).getTime();
  const endExclusive = addDays(startOfDay(rangeEnd), 1).getTime();
  let sum = 0;
  for (const t of sales) {
    const ct = new Date(t.created_at).getTime();
    if (ct >= startTs && ct < endExclusive) sum += t.total;
  }
  return sum;
}
