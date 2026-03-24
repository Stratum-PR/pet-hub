import type { Language } from '@/lib/translations';

const MIN_YEAR = 1940;
const MAX_YEAR = 2010;

export function yearOptions(): number[] {
  const out: number[] = [];
  for (let y = MAX_YEAR; y >= MIN_YEAR; y--) out.push(y);
  return out;
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12 || !Number.isFinite(year)) return 31;
  return new Date(year, month, 0).getDate();
}

export function dayOptions(month: number, year: number): number[] {
  const dim = daysInMonth(year, month);
  return Array.from({ length: dim }, (_, i) => i + 1);
}

export function monthOptions(lang: Language): { value: number; label: string }[] {
  const loc = lang === 'es' ? 'es' : 'en';
  const fmt = new Intl.DateTimeFormat(loc, { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: fmt.format(new Date(Date.UTC(2000, i, 1))),
  }));
}

/** True if Y-M-D is a real calendar date within employee DOB range. */
export function isValidEmployeeDob(day: number, month: number, year: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return false;
  return true;
}
