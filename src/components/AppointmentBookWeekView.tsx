import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import type { Locale } from 'date-fns';
import { CalendarAppointment, CalendarStaff } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { t } from '@/lib/translations';

export interface AppointmentBookWeekViewProps {
  weekDays: Date[];
  employees: CalendarStaff[];
  appointments: CalendarAppointment[];
  /** Highlights the column for this day (e.g. week-jump or manual selection). */
  selectedDate?: Date;
  /** date-fns locale for header labels. */
  dateLocale?: Locale;
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
  selectedDate,
  dateLocale,
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

  const dayColPct = weekDays.length > 0 ? `${(100 - 17) / weekDays.length}%` : '11.9%';

  const renderAppointmentButton = (apt: CalendarAppointment) => {
    const detail = [apt.startTime, apt.petName].filter(Boolean).join(' · ');
    return (
      <button
        key={apt.id}
        type="button"
        className="w-full min-w-0 rounded-md border border-border bg-card p-2.5 text-left text-sm shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ borderLeftWidth: 3, borderLeftColor: apt.color }}
        title={[apt.service, apt.ownerName, detail].filter(Boolean).join(' — ')}
        onClick={(e) => {
          e.stopPropagation();
          onAppointmentClick?.(apt);
        }}
      >
        <div className="font-semibold leading-snug text-foreground">{apt.service}</div>
        {apt.ownerName ? (
          <div className="mt-1 text-xs text-muted-foreground">{apt.ownerName}</div>
        ) : null}
        {detail ? <div className="mt-1 text-xs tabular-nums text-muted-foreground">{detail}</div> : null}
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background max-sm:h-auto max-sm:min-h-0 max-sm:overflow-visible">
      {/* Mobile: one column per day — no horizontal scroll */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-4 sm:hidden">
        <div className="space-y-4">
          {weekDays.map((d) => {
            const dk = dayKey(d);
            const colSelected = selectedDate ? isSameDay(d, selectedDate) : false;
            const dayHasAny = employees.some((emp) => (grouped[emp.id]?.[dk] ?? []).length > 0);
            return (
              <section
                key={dk}
                className={cn(
                  'rounded-lg border border-border bg-card p-3 shadow-sm',
                  colSelected && 'ring-2 ring-primary/30',
                )}
              >
                <h3 className="border-b border-border pb-2 text-sm font-semibold capitalize text-foreground">
                  {format(d, 'EEEE d MMM', dateLocale ? { locale: dateLocale } : undefined)}
                </h3>
                {!dayHasAny ? (
                  <p className="mt-3 text-sm text-muted-foreground">{t('apptBook.weekMobileDayEmpty')}</p>
                ) : (
                  <div className="mt-3 space-y-4">
                    {employees.map((emp) => {
                      const list = grouped[emp.id]?.[dk] ?? [];
                      if (list.length === 0) return null;
                      return (
                        <div key={emp.id}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {formatStaffNameAggregated(emp.name)}
                          </p>
                          <div className="mt-2 flex flex-col gap-2">{list.map((apt) => renderAppointmentButton(apt))}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Tablet/desktop: grid table */}
      <div className="hidden min-h-0 min-w-0 flex-1 overflow-auto sm:block">
        <table className="w-full min-w-0 table-fixed border-collapse text-foreground">
          <colgroup>
            <col style={{ width: '17%' }} />
            {weekDays.map((d) => (
              <col key={dayKey(d)} style={{ width: dayColPct }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-card shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 border border-border bg-card px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                {t('apptBook.columnEmployee')}
              </th>
              {weekDays.map((d) => {
                const colSelected = selectedDate ? isSameDay(d, selectedDate) : false;
                return (
                  <th
                    key={dayKey(d)}
                    className={cn(
                      'border border-border px-2 py-2 text-center text-xs font-semibold leading-snug text-foreground',
                      colSelected ? 'bg-primary/15 ring-1 ring-inset ring-primary/40' : 'bg-muted/30',
                    )}
                  >
                    <div>
                      {format(d, 'EEE', dateLocale ? { locale: dateLocale } : undefined)}{' '}
                      <span className="text-muted-foreground">
                        {format(d, 'd MMM', dateLocale ? { locale: dateLocale } : undefined)}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="align-top">
                <td
                  className="sticky left-0 z-10 border border-border bg-card px-2 py-2 text-sm font-medium text-foreground"
                  title={formatStaffNameAggregated(emp.name)}
                >
                  {formatStaffNameAggregated(emp.name)}
                </td>
                {weekDays.map((d) => {
                  const key = dayKey(d);
                  const list = grouped[emp.id]?.[key] ?? [];
                  const colSelected = selectedDate ? isSameDay(d, selectedDate) : false;
                  return (
                    <td
                      key={key}
                      className={cn(
                        'min-h-[5.5rem] min-w-0 border border-border p-1.5 align-top',
                        colSelected && 'bg-primary/5',
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
                      <div className="flex min-w-0 flex-col gap-1.5">
                        {list.map((apt) => renderAppointmentButton(apt))}
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
