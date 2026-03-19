import { addDays, endOfDay, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';

export interface PayScheduleConfig {
  /** Date-only ISO string (YYYY-MM-DD) that anchors the pay period cadence. */
  anchorDateISO: string;
  /** Cadence in whole weeks (e.g. 1, 2, 3, 4...). */
  cadenceWeeks: number;
}

function toValidCadenceWeeks(input: number): number {
  const n = Number.isFinite(input) ? input : 2;
  return Math.max(1, Math.floor(n));
}

function toAnchorDate(anchorDateISO: string): Date {
  // parseISO('YYYY-MM-DD') => midnight in local time, which is what we want for day-based bucketing.
  const parsed = parseISO(anchorDateISO);
  return startOfDay(parsed);
}

export function getPayPeriodRangeForDate(date: Date, config: PayScheduleConfig): { periodStart: Date; periodEnd: Date } {
  const cadenceWeeks = toValidCadenceWeeks(config.cadenceWeeks);
  const periodLengthDays = cadenceWeeks * 7;

  const anchor = toAnchorDate(config.anchorDateISO);
  const target = startOfDay(date);

  // differenceInCalendarDays is DST-safe for day-based bucketing.
  const diffDays = differenceInCalendarDays(target, anchor);
  const periodIndex = Math.floor(diffDays / periodLengthDays);

  const periodStart = addDays(anchor, periodIndex * periodLengthDays);
  const periodEnd = endOfDay(addDays(periodStart, periodLengthDays - 1));

  return { periodStart, periodEnd };
}

export function getPayPeriodStartForDate(date: Date, config: PayScheduleConfig): Date {
  return getPayPeriodRangeForDate(date, config).periodStart;
}

export function getPayPeriodEndForDate(date: Date, config: PayScheduleConfig): Date {
  return getPayPeriodRangeForDate(date, config).periodEnd;
}

export function addPayPeriods(periodStart: Date, delta: number, cadenceWeeks: number): Date {
  const weeks = toValidCadenceWeeks(cadenceWeeks);
  return addDays(periodStart, delta * weeks * 7);
}

