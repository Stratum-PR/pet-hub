/**
 * Scheduling / aggregated UI: "Jane D." (first name + last initial + period).
 */
export function formatStaffNameAggregated(fullName: string | null | undefined): string {
  const s = (fullName ?? '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}
