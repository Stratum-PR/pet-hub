import { isBefore, setHours, setMinutes, startOfDay } from 'date-fns';

/** Calendar day strictly before today (local). */
export function isPastCalendarDay(day: Date): boolean {
  return isBefore(startOfDay(day), startOfDay(new Date()));
}

/**
 * Start of slot `hhmm` on the given calendar day (local) is before now.
 * Uses startOfDay(selectedDate) so the day portion matches the picker.
 */
export function isSlotStartInPast(selectedDate: Date, hhmm: string): boolean {
  const parts = hhmm.split(':').map((x) => parseInt(x, 10));
  const h = parts[0];
  const m = parts[1];
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const slotStart = setMinutes(setHours(startOfDay(selectedDate), h), m);
  return slotStart.getTime() < Date.now();
}
