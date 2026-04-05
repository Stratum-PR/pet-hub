import { useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarAppointment, CalendarStaff } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';

export interface AppointmentBookWeekViewProps {
  weekDays: Date[];
  employees: CalendarStaff[];
  appointments: CalendarAppointment[];
  onAppointmentClick?: (apt: CalendarAppointment) => void;
  onCellClick?: (employeeId: string, day: Date) => void;
}

function dayKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export function AppointmentBookWeekView({
  weekDays,
  employees,
  appointments,
  onAppointmentClick,
  onCellClick,
}: AppointmentBookWeekViewProps) {
  const grouped = useMemo(() => {
    const g: Record<string, Record<string, CalendarAppointment[]>> = {};
    employees.forEach((e) => {
      g[e.id] = {};
      weekDays.forEach((d) => {
        g[e.id][dayKey(d)] = [];
      });
    });
    appointments.forEach((apt) => {
      const dk = apt.calendarDayKey;
      if (!dk || !apt.staffId) return;
      if (!g[apt.staffId]) return;
      if (!g[apt.staffId][dk]) g[apt.staffId][dk] = [];
      g[apt.staffId][dk].push(apt);
    });
    for (const eid of Object.keys(g)) {
      for (const dk of Object.keys(g[eid])) {
        g[eid][dk].sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }
    return g;
  }, [appointments, employees, weekDays]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-card shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 min-w-[140px] border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                Employee
              </th>
              {weekDays.map((d) => (
                <th
                  key={dayKey(d)}
                  className="min-w-[130px] border border-border bg-muted/30 px-2 py-2 text-center text-xs font-semibold text-foreground"
                >
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">{format(d, 'MMM d')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="align-top">
                <td className="sticky left-0 z-10 border border-border bg-card px-3 py-2 text-sm font-medium text-foreground">
                  {formatStaffNameAggregated(emp.name)}
                </td>
                {weekDays.map((d) => {
                  const key = dayKey(d);
                  const list = grouped[emp.id]?.[key] ?? [];
                  return (
                    <td
                      key={key}
                      className={cn(
                        'min-h-[88px] min-w-[130px] border border-border p-1 align-top',
                        onCellClick && 'cursor-pointer hover:bg-muted/40',
                      )}
                      onClick={() => onCellClick?.(emp.id, d)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onCellClick?.(emp.id, d);
                        }
                      }}
                      role={onCellClick ? 'button' : undefined}
                      tabIndex={onCellClick ? 0 : undefined}
                    >
                      <div className="flex flex-col gap-1">
                        {list.map((apt) => (
                          <button
                            key={apt.id}
                            type="button"
                            className="w-full rounded-md border border-border bg-card p-1.5 text-left text-[11px] shadow-sm transition-colors hover:bg-muted/60"
                            style={{ borderLeftWidth: 3, borderLeftColor: apt.color }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAppointmentClick?.(apt);
                            }}
                          >
                            <div className="font-semibold leading-tight text-foreground">{apt.service}</div>
                            <div className="text-muted-foreground">{apt.ownerName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {apt.startTime}
                              {apt.petName ? ` · ${apt.petName}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
