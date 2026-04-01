import type { TimeEntry } from '@/types';

/** Voided records are kept for audit but must not affect hours, pay, or exports. */
export function isVoidedTimeEntry(entry: Pick<TimeEntry, 'status'>): boolean {
  return entry.status === 'voided';
}

export function timeEntryCountsTowardPayroll(entry: Pick<TimeEntry, 'status'>): boolean {
  return !isVoidedTimeEntry(entry);
}
