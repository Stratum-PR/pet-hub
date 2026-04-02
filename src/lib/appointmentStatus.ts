/** Normalize status strings from DB / UI (hyphen vs underscore, casing). */
export function normalizeAppointmentStatus(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

const TERMINAL = new Set(['completed', 'cancelled', 'canceled', 'no-show']);

/** True when this appointment should not appear in "upcoming / pending" operational lists. */
export function isTerminalAppointmentStatus(status: string | null | undefined): boolean {
  const s = normalizeAppointmentStatus(status);
  return TERMINAL.has(s);
}

/** Eligible for "mark no-show" (still expected to show). */
export function canMarkAsNoShow(status: string | null | undefined): boolean {
  const s = normalizeAppointmentStatus(status);
  if (!s) return false;
  if (isTerminalAppointmentStatus(status)) return false;
  return ['scheduled', 'confirmed', 'in-progress'].includes(s);
}

/** Include in calendar day grid as an active booking (excludes no-show and cancellations). */
export function showOnActiveCalendar(status: string | null | undefined): boolean {
  const s = normalizeAppointmentStatus(status);
  if (s === 'no-show' || s === 'canceled' || s === 'cancelled') return false;
  return true;
}

export function isNoShowStatus(status: string | null | undefined): boolean {
  return normalizeAppointmentStatus(status) === 'no-show';
}

/** Exclude from "scheduled in period" client-type / funnel stats (not completed revenue). */
export function excludeFromPeriodClientStats(status: string | null | undefined): boolean {
  const s = normalizeAppointmentStatus(status);
  return s === 'no-show' || s === 'cancelled' || s === 'canceled';
}
