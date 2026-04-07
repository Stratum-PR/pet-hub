import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { format, endOfWeek, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import type { WeekTimeRange } from '@/lib/businessHours';
import { getShiftColor } from '@/lib/scheduleColors';
import { formatHours1Decimal, scheduledHoursBetween } from '@/lib/scheduleHours';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';

const DEFAULT_START_MINUTES = 7 * 60;
const DEFAULT_END_MINUTES = 21 * 60;
const SLOT_HEIGHT_PX = 48;
const MINUTES_PER_SLOT = 30;

function generateTimeSlots(startMinutes: number, endMinutes: number) {
  const slots: { hour: number; minute: number; label: string }[] = [];
  for (let m = startMinutes; m < endMinutes; m += MINUTES_PER_SLOT) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label =
      h === 12 && min === 0
        ? '12:00 PM'
        : h < 12
          ? `${h}:${min.toString().padStart(2, '0')} AM`
          : `${h === 12 ? 12 : h - 12}:${min.toString().padStart(2, '0')} PM`;
    slots.push({ hour: h, minute: min, label });
  }
  return slots;
}

function shiftPositionFromTimes(startTime: string, endTime: string, rangeStartMinutes: number) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const top = ((startMinutes - rangeStartMinutes) / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX;
  const height = ((endMinutes - startMinutes) / MINUTES_PER_SLOT) * SLOT_HEIGHT_PX;
  return { top, height };
}

function getShiftLabel(startIso: string, endIso: string): string {
  const start = format(new Date(startIso), 'h:mm');
  const end = format(new Date(endIso), 'h:mm a');
  const hours = scheduledHoursBetween(startIso, endIso);
  return `${start} – ${end} (${formatHours1Decimal(hours)})`;
}

function isShiftOnDay(shift: EmployeeShift, day: Date): boolean {
  const d = format(new Date(shift.start_time), 'yyyy-MM-dd');
  const dayStr = format(day, 'yyyy-MM-dd');
  return d === dayStr;
}

interface ScheduleReadOnlyCalendarProps {
  weekStart: Date;
  shifts: EmployeeShift[];
  /** When set, grid shows this staff member’s shifts (names/colors). */
  employee: Employee | null;
  timeRange?: WeekTimeRange;
}

export function ScheduleReadOnlyCalendar({
  weekStart,
  shifts,
  employee,
  timeRange,
}: ScheduleReadOnlyCalendarProps) {
  const rangeStartMinutes = timeRange?.startMinutes ?? DEFAULT_START_MINUTES;
  const rangeEndMinutes = timeRange?.endMinutes ?? DEFAULT_END_MINUTES;
  const timeSlots = useMemo(
    () => generateTimeSlots(rangeStartMinutes, rangeEndMinutes),
    [rangeStartMinutes, rangeEndMinutes]
  );
  const weekEnd = endOfWeek(weekStart);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const colorEmployees = employee ? [employee] : [];

  const shiftsByDay = useMemo(() => {
    const byDay: Record<string, EmployeeShift[]> = {};
    weekDays.forEach((day) => {
      byDay[format(day, 'yyyy-MM-dd')] = shifts.filter((s) => isShiftOnDay(s, day));
    });
    return byDay;
  }, [shifts, weekDays]);

  const totalGridHeight = timeSlots.length * SLOT_HEIGHT_PX;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="overflow-x-auto lg:overflow-x-visible overflow-y-hidden">
          <div
            className="grid border-b border-border bg-muted/30"
            style={{ gridTemplateColumns: `min(72px, 4.5rem) repeat(${weekDays.length}, minmax(100px, 1fr))` }}
          >
            <div className="sticky left-0 z-30 bg-muted/30 border-r border-border min-w-[72px]" />
            {weekDays.map((day) => (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={cn(
                  'text-center py-2 border-r border-border text-sm font-medium',
                  format(day, 'EEE') === format(new Date(), 'EEE') && 'bg-primary/10'
                )}
              >
                <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                <div>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div
            className="grid border-border"
            style={{
              gridTemplateColumns: `min(72px, 4.5rem) repeat(${weekDays.length}, minmax(100px, 1fr))`,
              minHeight: totalGridHeight,
            }}
          >
            <div className="sticky left-0 z-10 bg-background border-r border-border min-w-[72px] overflow-visible">
              {timeSlots.map((slot) => (
                <div
                  key={`${slot.hour}-${slot.minute}`}
                  className="border-b border-border flex items-center justify-end pr-2 text-xs text-muted-foreground whitespace-nowrap"
                  style={{ height: SLOT_HEIGHT_PX }}
                >
                  {slot.label}
                </div>
              ))}
            </div>
            {weekDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayShifts = shiftsByDay[dayStr] ?? [];

              return (
                <div
                  key={dayStr}
                  className="relative border-r border-border"
                  style={{ minHeight: totalGridHeight }}
                >
                  {timeSlots.map((slot, slotIndex) => (
                    <div
                      key={`${dayStr}-${slot.hour}-${slot.minute}`}
                      className={cn(
                        'absolute border-b',
                        slot.minute === 0 ? 'border-border' : 'border-border/50 bg-muted/5'
                      )}
                      style={{
                        left: 0,
                        right: 0,
                        top: slotIndex * SLOT_HEIGHT_PX,
                        height: SLOT_HEIGHT_PX,
                      }}
                    />
                  ))}
                  {dayShifts.map((shift) => {
                    const emp = employee;
                    const colors = emp
                      ? getShiftColor(shift.staff_id, colorEmployees)
                      : { block: 'bg-muted border-border', hover: '' };
                    const { top, height } = shiftPositionFromTimes(
                      shift.start_time,
                      shift.end_time,
                      rangeStartMinutes
                    );
                    const totalHeight = Math.max(height, 28);
                    const label = getShiftLabel(shift.start_time, shift.end_time);
                    return (
                      <div
                        key={shift.id}
                        className={cn(
                          'absolute rounded-md overflow-hidden border flex flex-col pointer-events-none',
                          colors.block
                        )}
                        style={{
                          top: top + 2,
                          height: totalHeight,
                          left: '0.25rem',
                          width: 'calc(100% - 0.5rem)',
                          zIndex: 1,
                        }}
                      >
                        <div
                          className={cn(
                            'flex-1 min-h-0 px-2 py-1 text-left text-xs font-medium flex flex-col justify-center',
                            colors.hover
                          )}
                          style={{ minHeight: Math.max(height, 28) - 6 }}
                        >
                          {emp ? formatStaffNameAggregated(emp.name) : t('schedule.employee')}
                          <br />
                          <span className="text-muted-foreground font-normal opacity-90">{label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
