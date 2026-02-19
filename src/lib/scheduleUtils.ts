import { format } from 'date-fns';
import type { EmployeeShift } from '@/types';

/** True if the same employee has another shift on the same day that overlaps [startTime, endTime). */
export function hasSameEmployeeOverlap(
  shifts: EmployeeShift[],
  employeeId: string,
  dayStr: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string
): boolean {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return shifts.some((s) => {
    if (s.employee_id !== employeeId) return false;
    if (format(new Date(s.start_time), 'yyyy-MM-dd') !== dayStr) return false;
    if (excludeShiftId && s.id === excludeShiftId) return false;
    const sStart = new Date(s.start_time).getTime();
    const sEnd = new Date(s.end_time).getTime();
    return start < sEnd && end > sStart;
  });
}

/** True if the same employee has any other shift (any day) that overlaps [startTime, endTime). */
export function hasSameEmployeeOverlapByTime(
  shifts: EmployeeShift[],
  employeeId: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string
): boolean {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return shifts.some((s) => {
    if (s.employee_id !== employeeId) return false;
    if (excludeShiftId && s.id === excludeShiftId) return false;
    const sStart = new Date(s.start_time).getTime();
    const sEnd = new Date(s.end_time).getTime();
    return start < sEnd && end > sStart;
  });
}
