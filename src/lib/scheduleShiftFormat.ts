import { format } from 'date-fns';
import type { EmployeeShift } from '@/types';
import { formatHours1Decimal, scheduledHoursBetween } from '@/lib/scheduleHours';

export function isShiftOnDay(shift: EmployeeShift, day: Date): boolean {
  const d = format(new Date(shift.start_time), 'yyyy-MM-dd');
  const dayStr = format(day, 'yyyy-MM-dd');
  return d === dayStr;
}

export function formatShiftRange(shift: EmployeeShift): string {
  const start = format(new Date(shift.start_time), 'h:mm a');
  const end = format(new Date(shift.end_time), 'h:mm a');
  const hours = scheduledHoursBetween(shift.start_time, shift.end_time);
  return `${start} – ${end} (${formatHours1Decimal(hours)})`;
}
