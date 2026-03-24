/**
 * Staff rows use `staff_id` in related tables (formerly `employee_id`).
 * Normalize reads so UI keeps working if a payload still has the legacy key.
 */
export function staffRecordIdFromRow(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const v = r.staff_id ?? r.employee_id;
  if (v == null || v === '') return null;
  return String(v);
}
