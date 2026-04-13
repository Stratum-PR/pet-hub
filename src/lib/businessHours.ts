/**
 * Shared business hours parsing and time-range helpers.
 * Used by BusinessSettingsPage and the schedule calendar.
 */

import { addDays, startOfDay } from 'date-fns';

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type DayKey = (typeof DAYS_OF_WEEK)[number];

export interface DayHours {
  closed?: boolean;
  open: string;
  close: string;
}

export const DEFAULT_DAY_HOURS: DayHours = { open: '09:00', close: '18:00' };

/** Normalize DB/UI variants: true, "true", 1, "yes", etc. */
export function coerceDayClosedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  }
  return false;
}

function dayEntryFromParsed(parsed: Record<string, unknown>, day: DayKey): unknown {
  if (Object.prototype.hasOwnProperty.call(parsed, day)) return parsed[day];
  const match = Object.keys(parsed).find((k) => k.toLowerCase() === day);
  return match !== undefined ? parsed[match] : undefined;
}

/** Parse "HH:mm" to minutes since midnight (0-1439). */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9 * 60; // 09:00 default
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

/**
 * Parse business_hours JSON string to per-day open/close.
 */
export function parseBusinessHours(value: string | undefined): Record<DayKey, DayHours> {
  if (!value || typeof value !== 'string') {
    return DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: { ...DEFAULT_DAY_HOURS } }), {} as Record<DayKey, DayHours>);
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return DAYS_OF_WEEK.reduce((acc, day) => {
        const raw = dayEntryFromParsed(parsed, day);
        let closed = false;
        let open = DEFAULT_DAY_HOURS.open;
        let close = DEFAULT_DAY_HOURS.close;
        if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
          const o = raw as Record<string, unknown>;
          closed = coerceDayClosedFlag(o.closed);
          if (typeof o.open === 'string' && o.open.trim() !== '') open = o.open.trim();
          if (typeof o.close === 'string' && o.close.trim() !== '') close = o.close.trim();
        }
        return { ...acc, [day]: { closed, open, close } };
      }, {} as Record<DayKey, DayHours>);
    } catch {
      return DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: { ...DEFAULT_DAY_HOURS } }), {} as Record<DayKey, DayHours>);
    }
  }
  return DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: { ...DEFAULT_DAY_HOURS } }), {} as Record<DayKey, DayHours>);
}

export interface WeekTimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  startMinutes: number;
  endMinutes: number;
}

export function serializeBusinessHours(hours: Record<DayKey, DayHours>): string {
  return JSON.stringify(hours);
}

/** Map a JS Date to our JSON day key (week starts Monday in settings object, keys are monday..sunday). */
export function dateToDayKey(date: Date): DayKey {
  const map: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()];
}

/**
 * 30-minute appointment start times (24h "HH:mm") from opening through the last slot
 * that begins at least 30 minutes before closing.
 */
export function appointmentTimeSlotsForDay(day: DayHours): string[] {
  if (!day || coerceDayClosedFlag(day.closed)) return [];
  const open = timeToMinutes(day.open ?? DEFAULT_DAY_HOURS.open);
  const close = timeToMinutes(day.close ?? DEFAULT_DAY_HOURS.close);
  const lastStart = close - 30;
  if (lastStart < open) return [];
  const out: string[] = [];
  for (let m = open; m <= lastStart; m += 30) {
    out.push(minutesToHHmm(m));
  }
  return out;
}

/** True if the business has at least one bookable slot on this calendar date (respects closed flag and hours). */
export function isOpenBusinessDay(date: Date, hoursPerDay: Record<DayKey, DayHours>): boolean {
  const day = hoursPerDay[dateToDayKey(date)];
  if (!day || coerceDayClosedFlag(day.closed)) return false;
  return appointmentTimeSlotsForDay(day).length > 0;
}

/**
 * First calendar date in the week (Sunday → Saturday) with bookable hours, or null if the whole week is closed.
 * `weekStartsOnSunday` should be the Sunday at the start of the week (e.g. from `startOfWeek(..., { weekStartsOn: 0 })`).
 */
export function firstOpenDayInWeek(
  weekStartsOnSunday: Date,
  hoursPerDay: Record<DayKey, DayHours>,
): Date | null {
  const start = startOfDay(weekStartsOnSunday);
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (isOpenBusinessDay(d, hoursPerDay)) return d;
  }
  return null;
}

export function minutesToHHmm(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/** 30-minute grid start times where the whole booking of durationMin fits before close. */
export function appointmentStartSlotsForDuration(day: DayHours, durationMin: number): string[] {
  if (!day || coerceDayClosedFlag(day.closed) || durationMin <= 0) return [];
  const open = timeToMinutes(day.open ?? DEFAULT_DAY_HOURS.open);
  const close = timeToMinutes(day.close ?? DEFAULT_DAY_HOURS.close);
  const lastStart = close - durationMin;
  if (lastStart < open) return [];
  const out: string[] = [];
  for (let m = open; m <= lastStart; m += 30) {
    out.push(minutesToHHmm(m));
  }
  return out;
}

/**
 * Compute a single time range for the week: earliest open and latest close
 * across all days (ignoring closed days for min/max).
 */
export function getWeekTimeRange(hours: Record<DayKey, DayHours>): WeekTimeRange {
  let startMinutes = 24 * 60;
  let endMinutes = 0;
  DAYS_OF_WEEK.forEach((day) => {
    const d = hours[day];
    if (!d || coerceDayClosedFlag(d.closed)) return;
    const open = timeToMinutes(d?.open ?? '09:00');
    const close = timeToMinutes(d?.close ?? '18:00');
    if (open < startMinutes) startMinutes = open;
    if (close > endMinutes) endMinutes = close;
  });
  if (startMinutes >= endMinutes) {
    startMinutes = 9 * 60;
    endMinutes = 18 * 60;
  }
  return {
    startHour: Math.floor(startMinutes / 60),
    startMinute: startMinutes % 60,
    endHour: Math.floor(endMinutes / 60),
    endMinute: endMinutes % 60,
    startMinutes,
    endMinutes,
  };
}

/** True when business hours mark this local calendar day closed. */
export function isBusinessClosedOnDate(date: Date, hoursPerDay: Record<DayKey, DayHours>): boolean {
  const h = hoursPerDay[dateToDayKey(date)];
  return !h || coerceDayClosedFlag(h.closed) || appointmentTimeSlotsForDay(h).length === 0;
}

/**
 * First local day on or after `startInclusive` that is open and fits at least one
 * appointment start for `durationMin` (same rules as {@link appointmentStartSlotsForDuration}).
 */
export function findFirstOpenDayWithSlotsFrom(
  startInclusive: Date,
  hoursPerDay: Record<DayKey, DayHours>,
  durationMin: number,
  maxScanDays = 120,
): Date | null {
  let d = startOfDay(startInclusive);
  for (let i = 0; i < maxScanDays; i++) {
    const h = hoursPerDay[dateToDayKey(d)];
    if (h && !coerceDayClosedFlag(h.closed)) {
      const slots = appointmentStartSlotsForDuration(h, durationMin);
      if (slots.length > 0) return d;
    }
    d = addDays(d, 1);
  }
  return null;
}
