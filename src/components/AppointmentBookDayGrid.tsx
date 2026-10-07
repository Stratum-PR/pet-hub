import { useEffect, useMemo, useRef, useState } from 'react';
import { isSameDay } from 'date-fns';
import { Globe } from 'lucide-react';
import { CalendarAppointment, CalendarStaff } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { t } from '@/lib/translations';
import { appointmentStatusDotClass, appointmentStatusLabelKey } from '@/lib/appointmentStatus';
import {
  dateToDayKey,
  minutesToHHmm,
  timeToMinutes,
  type DayHours,
  type DayKey,
} from '@/lib/businessHours';
import {
  businessWindowForDay,
  formatTime12h,
  layoutLanes,
  UNASSIGNED_STAFF_ID,
  type Interval,
} from '@/lib/groomerAvailability';

/** Height of one 30-minute row. */
const PX_PER_SLOT = 44;
const SLOT_MIN = 30;
const pxPerMinute = PX_PER_SLOT / SLOT_MIN;

export interface AppointmentBookDayGridProps {
  appointments: CalendarAppointment[];
  /** Columns to show, in order (may include the unassigned column). */
  employees: CalendarStaff[];
  hoursPerDay: Record<DayKey, DayHours>;
  selectedDate: Date;
  /** Bookable hours per groomer for this day (shift ∩ business hours). */
  windowsByStaff: Record<string, Interval[]>;
  onAppointmentClick?: (apt: CalendarAppointment) => void;
  /** Click on an empty, bookable slot. */
  onSlotClick?: (employeeId: string, hhmm: string) => void;
}

export function AppointmentBookDayGrid({
  appointments,
  employees,
  hoursPerDay,
  selectedDate,
  windowsByStaff,
  onAppointmentClick,
  onSlotClick,
}: AppointmentBookDayGridProps) {
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  /** Visible range: business hours, widened to cover shifts and appointments outside them. */
  const range = useMemo(() => {
    const business = businessWindowForDay(hoursPerDay[dateToDayKey(selectedDate)]);
    let start = business?.start ?? 24 * 60;
    let end = business?.end ?? 0;
    for (const list of Object.values(windowsByStaff)) {
      for (const w of list) {
        start = Math.min(start, w.start);
        end = Math.max(end, w.end);
      }
    }
    for (const a of appointments) {
      start = Math.min(start, timeToMinutes(a.startTime));
      end = Math.max(end, timeToMinutes(a.endTime));
    }
    if (start >= end) return null;
    return { start: Math.floor(start / SLOT_MIN) * SLOT_MIN, end: Math.ceil(end / SLOT_MIN) * SLOT_MIN };
  }, [hoursPerDay, selectedDate, windowsByStaff, appointments]);

  const slots = useMemo(() => {
    if (!range) return [];
    const out: number[] = [];
    for (let m = range.start; m < range.end; m += SLOT_MIN) out.push(m);
    return out;
  }, [range]);

  const byColumn = useMemo(() => {
    const grouped: Record<string, CalendarAppointment[]> = {};
    for (const emp of employees) grouped[emp.id] = [];
    for (const apt of appointments) {
      (grouped[apt.staffId] ??= []).push(apt);
    }
    return grouped;
  }, [appointments, employees]);

  const totalHeight = slots.length * PX_PER_SLOT;

  // On today, open scrolled near the current time; other days start at the top of the workday.
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayKey = selectedDate.toDateString();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !range) return;
    const n = new Date();
    const now = n.getHours() * 60 + n.getMinutes();
    const target = isSameDay(selectedDate, n) && now > range.start ? (now - 60 - range.start) * pxPerMinute : 0;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, range?.start]);
  const showNow = !!range && isSameDay(selectedDate, new Date()) && nowMin >= range.start && nowMin <= range.end;

  if (!range || employees.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {employees.length === 0 ? t('apptBook.noGroomersToShow') : t('apptBook.noBusinessHoursThisDay')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background max-sm:h-auto">
      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto max-sm:flex-none max-sm:overflow-x-auto max-sm:overflow-y-visible">
        <div className="min-w-full" style={{ minWidth: `${4 + employees.length * 9}rem` }}>
          {/* Column headers */}
          <div className="sticky top-0 z-30 flex border-b border-border bg-card">
            <div className="sticky left-0 z-40 w-14 shrink-0 border-r border-border bg-card sm:w-16" />
            {employees.map((emp) => {
              const isUnassigned = emp.id === UNASSIGNED_STAFF_ID;
              const windows = windowsByStaff[emp.id] ?? [];
              const list = byColumn[emp.id] ?? [];
              return (
                <div
                  key={emp.id}
                  className={cn(
                    'flex min-w-0 items-center gap-1 border-r border-border px-3 py-2',
                    isUnassigned ? 'w-28 flex-none sm:w-44' : 'flex-1',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'truncate text-sm font-semibold',
                        isUnassigned ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
                      )}
                      title={isUnassigned ? t('apptBook.unassignedHint') : emp.name}
                    >
                      {isUnassigned ? t('apptBook.unassigned') : formatStaffNameAggregated(emp.name)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {!isUnassigned && windows.length === 0
                        ? t('apptBook.dayOff')
                        : t(list.length === 1 ? 'apptBook.summaryCountOne' : 'apptBook.summaryCount', { count: list.length })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div className="relative flex" style={{ height: totalHeight }}>
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-border bg-card sm:w-16">
              {slots.map((m) => (
                <div
                  key={m}
                  className={cn(
                    'pr-1.5 pt-0.5 text-right text-[10px] tabular-nums sm:pr-2 sm:text-[11px]',
                    m % 60 === 0 ? 'font-medium text-foreground/80' : 'text-muted-foreground/70',
                  )}
                  style={{ height: PX_PER_SLOT }}
                >
                  {m % 60 === 0 ? formatTime12h(minutesToHHmm(m)) : null}
                </div>
              ))}
            </div>

            {employees.map((emp) => {
              const isUnassigned = emp.id === UNASSIGNED_STAFF_ID;
              const windows = isUnassigned ? [{ start: range.start, end: range.end }] : windowsByStaff[emp.id] ?? [];
              const list = byColumn[emp.id] ?? [];
              const lanes = layoutLanes(
                list.map((a) => ({ id: a.id, start: timeToMinutes(a.startTime), end: timeToMinutes(a.endTime) })),
              );
              return (
                <div
                  key={emp.id}
                  className={cn(
                    'relative min-w-0 border-r border-border',
                    isUnassigned ? 'w-28 flex-none bg-amber-500/[0.04] sm:w-44' : 'flex-1',
                  )}
                >
                  {slots.map((m) => {
                    const inWindow = windows.some((w) => m >= w.start && m + SLOT_MIN <= w.end);
                    const bookable = inWindow && !isUnassigned && !!onSlotClick;
                    return (
                      <div
                        key={m}
                        className={cn(
                          'group/slot relative border-b',
                          m % 60 === 0 ? 'border-border/70' : 'border-border/30 border-dashed',
                          isUnassigned
                            ? null
                            : inWindow
                              ? 'bg-card'
                              : 'bg-muted bg-[repeating-linear-gradient(135deg,transparent,transparent_7px,hsl(var(--foreground)/0.06)_7px,hsl(var(--foreground)/0.06)_8px)]',
                          bookable && 'cursor-pointer hover:bg-primary/5',
                        )}
                        style={{ height: PX_PER_SLOT }}
                        onClick={bookable ? () => onSlotClick?.(emp.id, minutesToHHmm(m)) : undefined}
                        role={bookable ? 'button' : undefined}
                        tabIndex={bookable ? 0 : undefined}
                        aria-label={
                          bookable
                            ? t('apptBook.bookSlotAria', {
                                name: formatStaffNameAggregated(emp.name),
                                time: formatTime12h(minutesToHHmm(m)),
                              })
                            : undefined
                        }
                        onKeyDown={
                          bookable
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onSlotClick?.(emp.id, minutesToHHmm(m));
                                }
                              }
                            : undefined
                        }
                      >
                        {bookable ? (
                          <span className="pointer-events-none absolute left-1.5 top-1 hidden text-[11px] font-medium text-primary group-hover/slot:inline">
                            + {formatTime12h(minutesToHHmm(m))}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}

                  {list.map((apt) => {
                    const s = timeToMinutes(apt.startTime);
                    const e = timeToMinutes(apt.endTime);
                    const top = (s - range.start) * pxPerMinute;
                    const height = Math.max((e - s) * pxPerMinute, 22);
                    const lane = lanes[apt.id] ?? { lane: 0, lanes: 1 };
                    const widthPct = 100 / lane.lanes;
                    const compact = height < 48;
                    const showOwner = height >= 84;
                    const statusLabel = t(appointmentStatusLabelKey(apt.dbStatus));
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        className={cn(
                          'absolute overflow-hidden rounded-md border px-1.5 py-1 text-left shadow-sm transition-shadow hover:z-10 hover:shadow-md',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          apt.isPending ? 'border-2 border-dashed border-amber-500' : 'border-black/10',
                        )}
                        style={{
                          top,
                          height,
                          left: `calc(${lane.lane * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          backgroundColor: apt.isPending ? `${apt.color}66` : apt.color,
                        }}
                        title={`${apt.startTime}–${apt.endTime} · ${apt.petName} · ${apt.service} · ${apt.ownerName} · ${statusLabel}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onAppointmentClick?.(apt);
                        }}
                      >
                        {compact ? (
                          <div className="flex items-center gap-1 truncate text-[11px] leading-tight text-slate-900">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', appointmentStatusDotClass(apt.dbStatus))} />
                            <span className="font-semibold tabular-nums">{formatTime12h(apt.startTime)}</span>
                            <span className="truncate font-medium">{apt.petName}</span>
                            <span className="truncate opacity-80">· {apt.service}</span>
                          </div>
                        ) : (
                          <div className="flex h-full flex-col gap-0.5 text-slate-900">
                            <div className="flex items-center gap-1">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', appointmentStatusDotClass(apt.dbStatus))} />
                              <span className="truncate text-xs font-semibold">{apt.petName}</span>
                              {apt.bookingSource === 'online' ? (
                                <Globe className="h-3 w-3 shrink-0 opacity-70" aria-label={t('apptBook.onlineBadge')} />
                              ) : null}
                            </div>
                            <div className="truncate text-[11px] font-medium opacity-90">{apt.service}</div>
                            {showOwner ? <div className="truncate text-[11px] opacity-80">{apt.ownerName}</div> : null}
                            <div className="mt-auto truncate text-[10px] tabular-nums opacity-75">
                              {formatTime12h(apt.startTime)} – {formatTime12h(apt.endTime)}
                              {apt.isPending ? ` · ${statusLabel}` : ''}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {showNow ? (
              <div
                className="pointer-events-none absolute left-14 right-0 z-20 flex items-center sm:left-16"
                style={{ top: (nowMin - range.start) * pxPerMinute }}
                aria-hidden
              >
                <span className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                <span className="h-px flex-1 bg-red-500" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
