/**
 * Overtime Calculation Utilities
 * Calculates regular hours, overtime hours (after 40h/week), and total hours
 */

import { TimeEntry } from '@/types';
import { startOfWeek, endOfWeek, isWithinInterval, differenceInHours } from 'date-fns';

export interface OvertimeCalculation {
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  weekStart: Date;
  weekEnd: Date;
}

/**
 * Calculates overtime for a given week
 * @param timeEntries - Array of time entries
 * @param weekStart - Start date of the week
 * @returns Overtime calculation result
 */
export function calculateOvertime(
  timeEntries: TimeEntry[],
  weekStart: Date
): OvertimeCalculation {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Monday start
  
  // Filter entries within the week
  const weekEntries = timeEntries.filter(entry => {
    if (!entry.clock_out) return false;
    
    const clockIn = new Date(entry.clock_in);
    return isWithinInterval(clockIn, { start: weekStart, end: weekEnd });
  });
  
  // Calculate total hours using rounded times if available, otherwise actual times
  const totalHours = weekEntries.reduce((sum, entry) => {
    if (!entry.clock_out) return sum;
    
    const clockIn = entry.rounded_clock_in 
      ? new Date(entry.rounded_clock_in)
      : new Date(entry.clock_in);
    const clockOut = entry.rounded_clock_out
      ? new Date(entry.rounded_clock_out)
      : new Date(entry.clock_out);
    
    const hours = differenceInHours(clockOut, clockIn);
    return sum + Math.max(0, hours);
  }, 0);
  
  // Calculate regular and overtime hours
  // Overtime threshold: 40 hours per week
  const regularHours = Math.min(totalHours, 40);
  const overtimeHours = Math.max(0, totalHours - 40);
  
  return {
    regularHours: Math.round(regularHours * 100) / 100, // Round to 2 decimals
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    weekStart,
    weekEnd,
  };
}

/**
 * Calculates overtime for the current week
 * @param timeEntries - Array of time entries
 * @returns Overtime calculation result for current week
 */
export function calculateCurrentWeekOvertime(
  timeEntries: TimeEntry[]
): OvertimeCalculation {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
  return calculateOvertime(timeEntries, weekStart);
}

/**
 * Calculates overtime for a specific employee in a week
 * @param timeEntries - Array of time entries
 * @param employeeId - Employee ID
 * @param weekStart - Start date of the week
 * @returns Overtime calculation result
 */
export function calculateEmployeeOvertime(
  timeEntries: TimeEntry[],
  employeeId: string,
  weekStart: Date
): OvertimeCalculation {
  const employeeEntries = timeEntries.filter(
    entry => entry.employee_id === employeeId
  );
  return calculateOvertime(employeeEntries, weekStart);
}

