import type { Employee } from '@/types';

/** True if staff should appear in assignment list for the given service IDs (empty offered list = no filter). */
export function staffOffersSelectedServices(
  employee: Employee,
  selectedServiceIds: string[]
): boolean {
  if (employee.status !== 'active') return false;
  const offered = employee.offered_service_ids;
  if (!offered?.length) return true;
  if (!selectedServiceIds.length) return true;
  const set = new Set(offered);
  return selectedServiceIds.some((id) => set.has(id));
}
