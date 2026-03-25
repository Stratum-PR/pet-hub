import type { Language } from '@/lib/translations';

export const EMPLOYEE_DOB_MIN_YEAR = 1940;
export const EMPLOYEE_DOB_MAX_YEAR = 2010;

const MIN_YEAR = EMPLOYEE_DOB_MIN_YEAR;
const MAX_YEAR = EMPLOYEE_DOB_MAX_YEAR;

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
  // Use UTC so month names match values 1–12 in every viewer timezone (local parsing of UTC midnight shifts the civil date behind UTC).
  const fmt = new Intl.DateTimeFormat(loc, { month: 'long', timeZone: 'UTC' });
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

/** `YYYY-MM-DD` for `<input type="date" />` min/max attributes. */
export function employeeDobInputBounds(): { min: string; max: string } {
  return { min: `${MIN_YEAR}-01-01`, max: `${MAX_YEAR}-12-31` };
}

/** Parse HTML date input value into calendar parts. */
export function parseEmployeeDobDateInput(
  ymd: string
): { day: number; month: number; year: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

/** Build `YYYY-MM-DD` from DB parts for a date input; empty string if incomplete or invalid. */
export function employeeBirthPartsToDateInput(
  month: number | null | undefined,
  day: number | null | undefined,
  year: number | null | undefined
): string {
  if (month == null || day == null || year == null) return '';
  if (!isValidEmployeeDob(day, month, year)) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
