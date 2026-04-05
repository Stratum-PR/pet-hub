import { useMemo } from 'react';
import { Plus, Settings, PawPrint, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarAppointment, CalendarStaff } from '@/types/calendar';
import { cn } from '@/lib/utils';
import { AppointmentNoShowControl } from '@/components/AppointmentNoShowControl';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { t } from '@/lib/translations';
import {
  appointmentTimeSlotsForDay,
  dateToDayKey,
  minutesToHHmm,
  timeToMinutes,
  type DayHours,
  type DayKey,
} from '@/lib/businessHours';

const PX_PER_SLOT = 40;

function formatTime12H(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr) || 0;
  if (Number.isNaN(h)) return time24;
  const hour12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function slotsForBusinessDay(
  hoursPerDay: Record<DayKey, DayHours>,
  selectedDate: Date,
): { time: string; label: string }[] {
  const day = hoursPerDay[dateToDayKey(selectedDate)];
  return appointmentTimeSlotsForDay(day).map((time) => ({
    time,
    label: formatTime12H(time),
  }));
}

/** When the business has no bookable grid for this day but appointments exist, show a minimal timeline so cards stay visible. */
function slotsCoveringAppointments(appointments: CalendarAppointment[]): { time: string; label: string }[] {
  let minM = 24 * 60;
  let maxM = 0;
  for (const apt of appointments) {
    const s = timeToMinutes(apt.startTime);
    const e = timeToMinutes(apt.endTime);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    minM = Math.min(minM, s);
    maxM = Math.max(maxM, e);
  }
  if (minM >= maxM) return [];
  minM = Math.floor(minM / 30) * 30;
  maxM = Math.ceil(maxM / 30) * 30;
  const out: { time: string; label: string }[] = [];
  for (let m = minM; m < maxM; m += 30) {
    const time = minutesToHHmm(m);
    out.push({ time, label: formatTime12H(time) });
  }
  return out;
}

function calculateAppointmentLayout(
  startTime: string,
  endTime: string,
  slots: { time: string }[],
) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (slots.length === 0) {
    return { top: 0, height: PX_PER_SLOT };
  }
  const startAnchor = timeToMinutes(slots[0].time);
  const top = ((startMinutes - startAnchor) / 30) * PX_PER_SLOT;
  const height = Math.max(((endMinutes - startMinutes) / 30) * PX_PER_SLOT, PX_PER_SLOT);
  return { top, height };
}

export interface AppointmentBookDayGridProps {
  appointments: CalendarAppointment[];
  employees: CalendarStaff[];
  /** Parsed business hours (same shape as {@link parseBusinessHours}). */
  hoursPerDay: Record<DayKey, DayHours>;
  selectedDate: Date;
  onAppointmentClick?: (apt: CalendarAppointment) => void;
  canMarkNoShow?: boolean;
  onMarkNoShow?: (appointmentId: string) => void | Promise<void>;
  /** Header + button: quick-create with this staff pre-selected */
  onStaffQuickBook?: (employeeId: string) => void;
}

export function AppointmentBookDayGrid({
  appointments,
  employees,
  hoursPerDay,
  selectedDate,
  onAppointmentClick,
  canMarkNoShow,
  onMarkNoShow,
  onStaffQuickBook,
}: AppointmentBookDayGridProps) {
  const slots = useMemo(() => {
    const business = slotsForBusinessDay(hoursPerDay, selectedDate);
    if (business.length > 0) return business;
    return slotsCoveringAppointments(appointments);
  }, [hoursPerDay, selectedDate, appointments]);
  const totalHeight = slots.length === 0 ? 120 : slots.length * PX_PER_SLOT;

  const appointmentsByEmployee = useMemo(() => {
    const grouped: Record<string, CalendarAppointment[]> = {};
    employees.forEach((emp) => {
      grouped[emp.id] = appointments.filter((apt) => apt.staffId === emp.id);
    });
    return grouped;
  }, [appointments, employees]);

  const categorySegments = useMemo(() => {
    const map = new Map<string, string>();
    appointments.forEach((apt) => {
      const key = apt.service || 'Service';
      if (!map.has(key)) map.set(key, apt.color);
    });
    return [...map.entries()].map(([name, color]) => ({ name, color }));
  }, [appointments]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {categorySegments.length > 0 ? (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/20 px-3 py-2">
          {categorySegments.map(({ name, color }) => (
            <div
              key={name}
              className="min-w-0 max-w-[200px] flex-1 truncate rounded-md px-2 py-1.5 text-center text-xs font-semibold text-foreground shadow-sm"
              style={{ backgroundColor: color }}
              title={name}
            >
              {name}
            </div>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="inline-block min-w-full min-h-full align-top">
          <div
            className="sticky top-0 z-30 flex border-b border-border bg-card"
            style={{ minWidth: 64 + employees.length * 160 }}
          >
            <div className="sticky left-0 z-40 w-16 shrink-0 border-r border-border bg-muted/30" />
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="w-[160px] shrink-0 border-r border-border bg-muted/30 px-2 py-2 text-center"
              >
                <div className="text-sm font-semibold text-foreground">
                  {formatStaffNameAggregated(employee.name)}
                </div>
                <div className="mt-1 flex items-center justify-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Add"
                    onClick={() => onStaffQuickBook?.(employee.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Settings">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-1 rounded-md bg-background/80 px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
                  — / —
                </div>
              </div>
            ))}
          </div>

          <div className="flex" style={{ minHeight: totalHeight, minWidth: 64 + employees.length * 160 }}>
            {slots.length === 0 ? (
              <>
                <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-border bg-card" />
                <div className="flex flex-1 items-center justify-center border-b border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('apptBook.noBusinessHoursThisDay')}
                </div>
              </>
            ) : (
              <>
                <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-border bg-card">
                  {slots.map((slot) => (
                    <div
                      key={slot.time}
                      className="flex justify-end border-b border-border/60 pr-2 pt-0.5 text-[10px] text-muted-foreground"
                      style={{ height: PX_PER_SLOT }}
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>

                <div className="flex flex-1">
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="relative w-[160px] shrink-0 border-r border-border"
                      style={{ height: totalHeight }}
                    >
                      {slots.map((slot) => (
                        <div
                          key={slot.time}
                          className="border-b border-border/40"
                          style={{ height: PX_PER_SLOT }}
                        />
                      ))}

                      {appointmentsByEmployee[employee.id]?.map((appointment) => {
                        const { top, height } = calculateAppointmentLayout(
                          appointment.startTime,
                          appointment.endTime,
                          slots,
                        );

                        return (
                          <button
                            key={appointment.id}
                            type="button"
                            className={cn(
                              'absolute left-1 right-1 rounded-md border border-border p-1.5 text-left shadow-sm transition-shadow hover:shadow-md',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            )}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              backgroundColor: appointment.color,
                              minHeight: PX_PER_SLOT,
                            }}
                            onClick={() => onAppointmentClick?.(appointment)}
                          >
                            <div className="flex items-start gap-0.5">
                              <PawPrint className="mt-0.5 h-3 w-3 shrink-0 text-foreground/80" />
                              {appointment.hasAlert ? (
                                <Bell className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                              ) : null}
                            </div>
                            <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                              {appointment.service}
                              {appointment.serviceSize ? ` · ${appointment.serviceSize}` : ''}
                            </div>
                            <div className="line-clamp-1 text-[10px] text-foreground/90">{appointment.ownerName}</div>
                            <div className="line-clamp-1 text-[10px] font-medium text-foreground/80">
                              {appointment.petName}
                              {appointment.breed ? ` (${appointment.breed})` : ''}
                            </div>
                            <div className="mt-0.5 text-[10px] text-foreground/70">
                              {appointment.startTime} – {appointment.endTime}
                            </div>
                            {canMarkNoShow && onMarkNoShow && appointment.dbStatus ? (
                              <div
                                className="mt-1 border-t border-border/50 pt-1"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <AppointmentNoShowControl
                                  status={appointment.dbStatus}
                                  compact
                                  onMarkNoShow={() => onMarkNoShow(appointment.id)}
                                />
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
