import { useState, useMemo } from 'react';
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployeeShifts, useSettings } from '@/hooks/useSupabaseData';
import { parseBusinessHours, getWeekTimeRange } from '@/lib/businessHours';
import { ManagerScheduleView } from '@/components/ManagerScheduleView';
import { MyScheduleView } from '@/components/MyScheduleView';
import type { Employee, TimeEntry } from '@/types';

interface EmployeeScheduleProps {
  employees: Employee[];
  timeEntries: TimeEntry[];
}

export function EmployeeSchedule({ employees, timeEntries }: EmployeeScheduleProps) {
  const { role, employeeId } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const isManager = role === 'manager' || role === 'super_admin';

  const dateRange = useMemo(
    () =>
      isManager
        ? { start: startOfWeek(subWeeks(weekStart, 1)), end: endOfWeek(weekStart) }
        : { start: weekStart, end: endOfWeek(weekStart) },
    [weekStart.getTime(), isManager]
  );

  const shiftsOptions = useMemo(
    () =>
      (role === 'employee' && employeeId
        ? { employeeId, dateRange }
        : { dateRange }) as { employeeId?: string; dateRange: { start: Date; end: Date } },
    [role, employeeId, dateRange]
  );

  const { shifts, loading, error, refetch, addShift, updateShift, deleteShift } = useEmployeeShifts(shiftsOptions);
  const { settings } = useSettings();
  const timeRange = useMemo(() => {
    const hours = parseBusinessHours(settings.business_hours);
    return getWeekTimeRange(hours);
  }, [settings.business_hours]);

  if (loading && shifts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive text-center py-8">
        {error}
        <button type="button" onClick={() => refetch()} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }

  if (isManager) {
    return (
      <ManagerScheduleView
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        employees={employees}
        shifts={shifts}
        addShift={addShift}
        updateShift={updateShift}
        deleteShift={deleteShift}
        timeRange={timeRange}
      />
    );
  }

  return (
    <MyScheduleView
      shifts={shifts}
      employees={employees}
      weekStart={weekStart}
      onWeekChange={setWeekStart}
    />
  );
}
