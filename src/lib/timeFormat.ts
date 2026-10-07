import { format } from 'date-fns';

/**
 * Simplified 12-hour clock used everywhere in the app: "1 PM", "1:30 PM".
 * Minutes are shown only when they aren't :00.
 */
export function clock12(hours24: number, minutes = 0): string {
  const h = ((Math.floor(hours24) % 24) + 24) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return minutes ? `${h12}:${String(minutes).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

/** "13:00" / "13:30:00" → "1 PM" / "1:30 PM". Returns the input when it can't be parsed. */
export function clock12FromHHmm(raw: string | null | undefined): string {
  if (!raw) return '';
  const [hs, ms] = String(raw).split(':');
  const h = Number(hs);
  const m = Number(ms ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return String(raw);
  return clock12(h, m);
}

/**
 * date-fns `format` that drops ":00" on the hour for patterns with `h:mm`
 * ("MMM d, h:mm a" → "Oct 7, 1 PM" at 1:00, "Oct 7, 1:30 PM" at 1:30).
 */
export function formatT(date: Date | number, pattern: string, options?: Parameters<typeof format>[2]): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const p = d.getMinutes() === 0 ? pattern.replace(/h:mm/g, 'h') : pattern;
  return format(d, p, options);
}
