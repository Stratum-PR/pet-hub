import { startOfDay } from 'date-fns';
import type { Employee, TimeEntry } from '@/types';
import { isVoidedTimeEntry, timeEntryCountsTowardPayroll } from '@/lib/timeEntryStatus';

/** Staff who have at least one time entry in the pay period matching the summary view rules (same as merged blocks). */
export function staffIdsWithActivityInPayPeriod(
  timeEntries: TimeEntry[],
  employees: Employee[],
  payPeriodStart: Date,
  payPeriodEnd: Date,
  view: 'payable' | 'voided'
): string[] {
  const p0 = startOfDay(payPeriodStart).getTime();
  const p1 = startOfDay(payPeriodEnd).getTime();
  const ids = new Set<string>();
  for (const entry of timeEntries) {
    const entryDate = startOfDay(new Date(entry.clock_in)).getTime();
    if (entryDate < p0 || entryDate > p1) continue;
    const matches =
      view === 'voided' ? isVoidedTimeEntry(entry) : timeEntryCountsTowardPayroll(entry);
    if (!matches) continue;
    ids.add(entry.staff_id);
  }
  const idList = [...ids];
  idList.sort((a, b) => {
    const na = employees.find((e) => e.id === a)?.name ?? '';
    const nb = employees.find((e) => e.id === b)?.name ?? '';
    return na.localeCompare(nb, undefined, { sensitivity: 'base' });
  });
  return idList;
}
