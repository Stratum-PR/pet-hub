/**
 * HTML <input type="date"> values are YYYY-MM-DD in the user's local calendar.
 * Storing `new Date(ymd)` as ISO can shift the calendar day in non-UTC zones.
 * We normalize to UTC noon on that calendar day so hire/last dates round-trip reliably.
 */
export function localYmdToTimestamptzIso(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).toISOString();
}

/** Value for <input type="date"> from a timestamptz ISO string (local calendar day). */
export function timestamptzToDateInputValue(iso: string | undefined | null): string {
  if (!iso) return '';
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const mo = String(x.getMonth() + 1).padStart(2, '0');
  const d = String(x.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
