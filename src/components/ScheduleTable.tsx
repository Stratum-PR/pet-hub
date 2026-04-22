import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { cn } from '@/lib/utils';
import { getShiftColor } from '@/lib/scheduleColors';
import { formatHours1Decimal, scheduledHoursBetween } from '@/lib/scheduleHours';
import { formatShiftRange, isShiftOnDay } from '@/lib/scheduleShiftFormat';
import { Plus } from 'lucide-react';
import { employeeFullName } from '@/lib/employeeName';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ScheduleTableProps {
  shifts: EmployeeShift[];
  employees: Employee[];
  weekDays: Date[];
  onEditShift: (shift: EmployeeShift) => void;
  onAddShift: (employeeId: string, date: string) => void;
  /** Hide add/edit affordances (e.g. while printing). */
  readOnly?: boolean;
  /** Only show this staff member’s row (e.g. “My schedule”). */
  singleStaffId?: string | null;
}

export function ScheduleTable({
  shifts,
  employees,
  weekDays,
  onEditShift,
  onAddShift,
  readOnly = false,
  singleStaffId = null,
}: ScheduleTableProps) {
  const activeEmployees = useMemo(() => {
    const act = employees.filter((e) => e.status === 'active');
    if (singleStaffId) {
      return act.filter((e) => e.id === singleStaffId);
    }
    return act;
  }, [employees, singleStaffId]);

  const shiftsByEmployeeDay = useMemo(() => {
    const map: Record<string, Record<string, EmployeeShift[]>> = {};
    activeEmployees.forEach((e) => {
      map[e.id] = {};
      weekDays.forEach((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        map[e.id][dayStr] = shifts.filter(
          (s) => s.staff_id === e.id && isShiftOnDay(s, day)
        );
      });
    });
    return map;
  }, [shifts, activeEmployees, weekDays]);

  const totalHoursByEmployee = useMemo(() => {
    const weekDaySet = new Set(weekDays.map((d) => format(d, 'yyyy-MM-dd')));
    const totals: Record<string, number> = {};
    activeEmployees.forEach((e) => (totals[e.id] = 0));
    shifts.forEach((s) => {
      const dayStr = format(new Date(s.start_time), 'yyyy-MM-dd');
      if (!weekDaySet.has(dayStr)) return;
      totals[s.staff_id] = (totals[s.staff_id] ?? 0) + scheduledHoursBetween(s.start_time, s.end_time);
    });
    return totals;
  }, [shifts, activeEmployees, weekDays]);

  return (
    <Card className="print:shadow-none print:border print:overflow-visible">
      <CardHeader className={readOnly ? 'print:py-2' : undefined}>
        <CardTitle className="text-base">{t('schedule.tableTitle')}</CardTitle>
        {!readOnly && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('schedule.tableDescription')}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0 print:overflow-visible">
        <div className="overflow-x-auto lg:overflow-x-visible print:overflow-visible">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2 font-semibold sticky left-0 bg-muted/30 z-10 min-w-[120px]">
                  {t('schedule.employee')}
                </th>
                {weekDays.map((day) => (
                  <th
                    key={format(day, 'yyyy-MM-dd')}
                    className={cn(
                      'text-center p-2 font-semibold min-w-[100px] max-w-[140px]',
                      format(day, 'EEE') === format(new Date(), 'EEE') &&
                        format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') &&
                        'bg-primary/10'
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(day, 'EEE')}
                    </div>
                    <div>{format(day, 'd')}</div>
                  </th>
                ))}
                <th className="text-center p-2 font-semibold min-w-[92px]">
                  {t('schedule.totalHours')}
                </th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className="border-b border-border hover:bg-muted/20 transition-colors"
                >
                  <td
                    className={cn(
                      'p-2 font-medium sticky left-0 z-10 border-r border-border',
                      getShiftColor(employee.id, activeEmployees).rowMarker
                    )}
                  >
                    {employeeFullName(employee)}
                  </td>
                  {weekDays.map((day) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const cellShifts =
                      shiftsByEmployeeDay[employee.id]?.[dayStr] ?? [];
                    const isEmpty = cellShifts.length === 0;
                    const isToday =
                      dayStr === format(new Date(), 'yyyy-MM-dd');
                    const colors = getShiftColor(employee.id, activeEmployees);

                    return (
                      <td
                        key={dayStr}
                        className={cn(
                          'p-2 align-top border-r border-border min-w-[100px] max-w-[140px] relative group',
                          !readOnly && 'cursor-pointer',
                          'transition-colors',
                          isEmpty
                            ? 'hover:bg-muted/50'
                            : cn(colors.block, 'hover:opacity-90'),
                          isToday && isEmpty && 'bg-primary/5'
                        )}
                        onClick={() => {
                          if (readOnly) return;
                          if (isEmpty) {
                            onAddShift(employee.id, dayStr);
                          } else if (cellShifts.length === 1) {
                            onEditShift(cellShifts[0]);
                          }
                          // else: multiple shifts handled via popover
                        }}
                      >
                        {!isEmpty && !readOnly && (
                          <button
                            type="button"
                            className={cn(
                              'absolute top-1 right-1 rounded-sm p-1',
                              'opacity-0 group-hover:opacity-100 transition-opacity',
                              'bg-background/70 hover:bg-background border border-border',
                              'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary'
                            )}
                            aria-label={t('schedule.clickToAdd')}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddShift(employee.id, dayStr);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isEmpty ? (
                          <span className="text-muted-foreground text-xs italic block py-1">
                            {readOnly ? '—' : t('schedule.clickToAdd')}
                          </span>
                        ) : cellShifts.length === 1 ? (
                          <span className="block py-0.5 text-xs">
                            {formatShiftRange(cellShifts[0])}
                          </span>
                        ) : readOnly ? (
                          <span className="block py-0.5 text-xs">
                            {cellShifts.map(formatShiftRange).join(', ')}
                          </span>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="text-left w-full block py-0.5 text-xs hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {cellShifts
                                  .map(formatShiftRange)
                                  .join(', ')}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-56 p-2"
                              align="start"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-col gap-1">
                                {cellShifts.map((shift) => (
                                  <button
                                    key={shift.id}
                                    type="button"
                                    className="text-left px-2 py-1.5 rounded hover:bg-muted text-sm"
                                    onClick={() => {
                                      onEditShift(shift);
                                    }}
                                  >
                                    {formatShiftRange(shift)}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  className="text-left px-2 py-1.5 rounded hover:bg-muted text-sm font-medium"
                                  onClick={() => onAddShift(employee.id, dayStr)}
                                >
                                  + {t('schedule.clickToAdd')}
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center font-medium whitespace-nowrap">
                    {formatHours1Decimal(totalHoursByEmployee[employee.id] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activeEmployees.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">
            {t('schedule.noActiveEmployees')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
