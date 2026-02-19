import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, differenceInMinutes } from 'date-fns';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ScheduleSummaryProps {
  shifts: EmployeeShift[];
  employees: Employee[];
  weekDays: Date[];
  onOpenShift?: (shift: EmployeeShift) => void;
}

function hoursBetween(start: string, end: string): number {
  return differenceInMinutes(new Date(end), new Date(start)) / 60;
}

export function ScheduleSummary({ shifts, employees, weekDays, onOpenShift }: ScheduleSummaryProps) {
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees]
  );

  const { byEmployee, byEmployeeDay, byEmployeeDayShifts } = useMemo(() => {
    const byEmployee: Record<string, number> = {};
    const byEmployeeDay: Record<string, Record<string, number>> = {};
    const byEmployeeDayShifts: Record<string, Record<string, EmployeeShift[]>> = {};
    activeEmployees.forEach((e) => {
      byEmployee[e.id] = 0;
      byEmployeeDay[e.id] = {};
      byEmployeeDayShifts[e.id] = {};
      weekDays.forEach((d) => {
        const dayStr = format(d, 'yyyy-MM-dd');
        byEmployeeDay[e.id][dayStr] = 0;
        byEmployeeDayShifts[e.id][dayStr] = [];
      });
    });
    shifts.forEach((shift) => {
      const dayStr = format(new Date(shift.start_time), 'yyyy-MM-dd');
      const h = hoursBetween(shift.start_time, shift.end_time);
      if (!byEmployeeDay[shift.employee_id]) {
        byEmployeeDay[shift.employee_id] = {};
        byEmployeeDayShifts[shift.employee_id] = {};
        weekDays.forEach((d) => {
          const ds = format(d, 'yyyy-MM-dd');
          byEmployeeDay[shift.employee_id][ds] = 0;
          byEmployeeDayShifts[shift.employee_id][ds] = [];
        });
      }
      byEmployee[shift.employee_id] = (byEmployee[shift.employee_id] ?? 0) + h;
      if (dayStr in byEmployeeDay[shift.employee_id]) {
        byEmployeeDay[shift.employee_id][dayStr] += h;
        byEmployeeDayShifts[shift.employee_id][dayStr].push(shift);
      }
    });
    return { byEmployee, byEmployeeDay, byEmployeeDayShifts };
  }, [shifts, activeEmployees, weekDays]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('schedule.weeklySummary')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-2 font-semibold">{t('schedule.employee')}</th>
                {weekDays.map((day) => (
                  <th
                    key={format(day, 'yyyy-MM-dd')}
                    className={cn(
                      'text-center p-2 font-semibold min-w-[64px]',
                      format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && 'bg-primary/10'
                    )}
                  >
                    {format(day, 'EEE')}
                  </th>
                ))}
                <th className="text-center p-2 font-semibold min-w-[56px]">{t('schedule.totalHours')}</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.length === 0 ? (
                <tr>
                  <td colSpan={weekDays.length + 2} className="p-4 text-center text-muted-foreground">
                    {t('schedule.noActiveEmployees')}
                  </td>
                </tr>
              ) : (
                activeEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium">{emp.name}</td>
                    {weekDays.map((day) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayShifts = byEmployeeDayShifts[emp.id]?.[dayStr] ?? [];
                      const hours = byEmployeeDay[emp.id]?.[dayStr] ?? 0;
                      const hasHours = hours > 0;
                      const clickable = hasHours && onOpenShift;

                      const cellContent = (
                        <td
                          key={dayStr}
                          className={cn(
                            'text-center p-2 text-muted-foreground',
                            format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && 'bg-primary/5',
                            clickable && 'cursor-pointer hover:bg-muted/50'
                          )}
                          onClick={
                            clickable && dayShifts.length === 1
                              ? () => onOpenShift(dayShifts[0])
                              : undefined
                          }
                          role={clickable && dayShifts.length === 1 ? 'button' : undefined}
                        >
                          {hasHours ? hours.toFixed(1) + 'h' : '0h'}
                        </td>
                      );

                      if (clickable && dayShifts.length > 1) {
                        return (
                          <td
                            key={dayStr}
                            className={cn(
                              'text-center p-2 text-muted-foreground',
                              format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && 'bg-primary/5'
                            )}
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full py-0.5 rounded cursor-pointer hover:bg-muted/50 text-muted-foreground"
                                >
                                  {hours.toFixed(1)}h
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="start">
                                <div className="flex flex-col gap-1">
                                  {dayShifts.map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      className="text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted"
                                      onClick={() => onOpenShift(s)}
                                    >
                                      {format(new Date(s.start_time), 'h:mm a')} – {format(new Date(s.end_time), 'h:mm a')}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                        );
                      }
                      return cellContent;
                    })}
                    <td className="p-2 text-center font-medium">
                      {(byEmployee[emp.id] ?? 0).toFixed(1)}h
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
