/**
 * Shared business hours parsing and time-range helpers.
 * Used by BusinessSettingsPage and the schedule calendar.
 */

export const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type DayKey = (typeof DAYS_OF_WEEK)[number];

export interface DayHours {
  closed?: boolean;
  open: string;
  close: string;
}

export const DEFAULT_DAY_HOURS: DayHours = { open: '09:00', close: '18:00' };

/** Parse "HH:mm" to minutes since midnight (0-1439). */
function timeToMinutes(time: string): number {
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
      const parsed = JSON.parse(trimmed) as Record<string, { closed?: boolean; open?: string; close?: string }>;
      return DAYS_OF_WEEK.reduce(
        (acc, day) => ({
          ...acc,
          [day]: {
            closed: parsed[day]?.closed ?? false,
            open: parsed[day]?.open ?? DEFAULT_DAY_HOURS.open,
            close: parsed[day]?.close ?? DEFAULT_DAY_HOURS.close,
          },
        }),
        {} as Record<DayKey, DayHours>
      );
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

/**
 * Compute a single time range for the week: earliest open and latest close
 * across all days (ignoring closed days for min/max).
 */
export function getWeekTimeRange(hours: Record<DayKey, DayHours>): WeekTimeRange {
  let startMinutes = 24 * 60;
  let endMinutes = 0;
  DAYS_OF_WEEK.forEach((day) => {
    const d = hours[day];
    if (d?.closed) return;
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
