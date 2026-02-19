import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { cn } from '@/lib/utils';
import { getShiftColor } from '@/lib/scheduleColors';
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
}

function isShiftOnDay(shift: EmployeeShift, day: Date): boolean {
  const d = format(new Date(shift.start_time), 'yyyy-MM-dd');
  const dayStr = format(day, 'yyyy-MM-dd');
  return d === dayStr;
}

function formatShiftRange(shift: EmployeeShift): string {
  const start = format(new Date(shift.start_time), 'h:mm a');
  const end = format(new Date(shift.end_time), 'h:mm a');
  return `${start} – ${end}`;
}

export function ScheduleTable({
  shifts,
  employees,
  weekDays,
  onEditShift,
  onAddShift,
}: ScheduleTableProps) {
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees]
  );

  const shiftsByEmployeeDay = useMemo(() => {
    const map: Record<string, Record<string, EmployeeShift[]>> = {};
    activeEmployees.forEach((e) => {
      map[e.id] = {};
      weekDays.forEach((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        map[e.id][dayStr] = shifts.filter(
          (s) => s.employee_id === e.id && isShiftOnDay(s, day)
        );
      });
    });
    return map;
  }, [shifts, activeEmployees, weekDays]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('schedule.tableTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('schedule.tableDescription')}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
                    {employee.name}
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
                          'p-2 align-top cursor-pointer border-r border-border min-w-[100px] max-w-[140px]',
                          'transition-colors',
                          isEmpty
                            ? 'hover:bg-muted/50'
                            : cn(colors.block, 'hover:opacity-90'),
                          isToday && isEmpty && 'bg-primary/5'
                        )}
                        onClick={() => {
                          if (isEmpty) {
                            onAddShift(employee.id, dayStr);
                          } else if (cellShifts.length === 1) {
                            onEditShift(cellShifts[0]);
                          }
                          // else: multiple shifts handled via popover
                        }}
                      >
                        {isEmpty ? (
                          <span className="text-muted-foreground text-xs italic block py-1">
                            {t('schedule.clickToAdd')}
                          </span>
                        ) : cellShifts.length === 1 ? (
                          <span className="block py-0.5 text-xs">
                            {formatShiftRange(cellShifts[0])}
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
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    );
                  })}
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
