import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { cn } from '@/lib/utils';
import { getShiftColor } from '@/lib/scheduleColors';
import { formatHours1Decimal, scheduledHoursBetween } from '@/lib/scheduleHours';
import { employeeFullName } from '@/lib/employeeName';
import { formatShiftRange, isShiftOnDay } from '@/lib/scheduleShiftFormat';

export interface ScheduleWeekAgendaProps {
  shifts: EmployeeShift[];
  employees: Employee[];
  weekDays: Date[];
  onEditShift: (shift: EmployeeShift) => void;
  onAddShift: (employeeId: string, date: string) => void;
  readOnly?: boolean;
  singleStaffId?: string | null;
  /** When set with `onSelectedDayIndexChange`, selection is controlled by the parent (e.g. for synced hours table). */
  selectedDayIndex?: number;
  onSelectedDayIndexChange?: (index: number) => void;
}

/** Default selected day: today if it falls in the week, else Monday (index 0). */
export function getDefaultScheduleAgendaDayIndex(weekDays: Date[]): number {
  if (weekDays.length === 0) return 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  const idx = weekDays.findIndex((d) => format(d, 'yyyy-MM-dd') === today);
  return idx >= 0 ? idx : 0;
}

function AgendaDayAddControls({
  dayStr,
  activeEmployees,
  onAddShift,
}: {
  dayStr: string;
  activeEmployees: Employee[];
  onAddShift: (employeeId: string, date: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState(() => activeEmployees[0]?.id ?? '');

  useEffect(() => {
    if (!activeEmployees.length) return;
    if (!employeeId || !activeEmployees.some((e) => e.id === employeeId)) {
      setEmployeeId(activeEmployees[0]!.id);
    }
  }, [activeEmployees, employeeId]);

  if (activeEmployees.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {activeEmployees.length > 1 ? (
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-full rounded-lg border border-input bg-background text-left">
            <SelectValue placeholder={t('schedule.employee')} />
          </SelectTrigger>
          <SelectContent>
            {activeEmployees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {employeeFullName(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full shrink-0"
        onClick={() => onAddShift(employeeId || activeEmployees[0]!.id, dayStr)}
      >
        {t('schedule.addShift')}
      </Button>
    </div>
  );
}

export function ScheduleWeekAgenda({
  shifts,
  employees,
  weekDays,
  onEditShift,
  onAddShift,
  readOnly = false,
  singleStaffId = null,
  selectedDayIndex: selectedDayIndexProp,
  onSelectedDayIndexChange,
}: ScheduleWeekAgendaProps) {
  const weekKey = useMemo(() => weekDays.map((d) => format(d, 'yyyy-MM-dd')).join('|'), [weekDays]);
  const isControlled =
    selectedDayIndexProp !== undefined && typeof onSelectedDayIndexChange === 'function';
  const [internalDayIndex, setInternalDayIndex] = useState(() => getDefaultScheduleAgendaDayIndex(weekDays));

  useEffect(() => {
    if (isControlled) return;
    setInternalDayIndex(getDefaultScheduleAgendaDayIndex(weekDays));
  }, [weekKey, isControlled]);

  const rawDayIndex = isControlled ? selectedDayIndexProp! : internalDayIndex;
  const setDayIndex = useCallback(
    (next: number) => {
      const last = Math.max(0, weekDays.length - 1);
      const clamped = Math.min(Math.max(0, next), last);
      if (isControlled) onSelectedDayIndexChange!(clamped);
      else setInternalDayIndex(clamped);
    },
    [isControlled, onSelectedDayIndexChange, weekDays.length],
  );

  const activeEmployees = useMemo(() => {
    const act = employees.filter((e) => e.status === 'active');
    if (singleStaffId) return act.filter((e) => e.id === singleStaffId);
    return act;
  }, [employees, singleStaffId]);

  const shiftsByDay = useMemo(() => {
    const allowed = new Set(activeEmployees.map((e) => e.id));
    const map: Record<string, EmployeeShift[]> = {};
    for (const day of weekDays) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const list = shifts
        .filter((s) => allowed.has(s.staff_id) && isShiftOnDay(s, day))
        .slice()
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      map[dayStr] = list;
    }
    return map;
  }, [shifts, weekDays, activeEmployees]);

  const weekTotalHours = useMemo(() => {
    const daySet = new Set(weekDays.map((d) => format(d, 'yyyy-MM-dd')));
    let sum = 0;
    for (const s of shifts) {
      const dayStr = format(new Date(s.start_time), 'yyyy-MM-dd');
      if (!daySet.has(dayStr)) continue;
      if (singleStaffId && s.staff_id !== singleStaffId) continue;
      if (!singleStaffId && !activeEmployees.some((e) => e.id === s.staff_id)) continue;
      sum += scheduledHoursBetween(s.start_time, s.end_time);
    }
    return sum;
  }, [shifts, weekDays, singleStaffId, activeEmployees]);

  const lastIndex = Math.max(0, weekDays.length - 1);
  const displayIndex = Math.min(Math.max(0, rawDayIndex), lastIndex);
  const selectedDay = weekDays[displayIndex] ?? weekDays[0];
  const selectedDayStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';
  const dayShifts = selectedDayStr ? (shiftsByDay[selectedDayStr] ?? []) : [];
  const isToday = selectedDayStr === format(new Date(), 'yyyy-MM-dd');

  const goPrev = useCallback(() => {
    setDayIndex(displayIndex - 1);
  }, [displayIndex, setDayIndex]);

  const goNext = useCallback(() => {
    setDayIndex(displayIndex + 1);
  }, [displayIndex, setDayIndex]);

  const swipeStartX = useRef<number | null>(null);

  const onSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.changedTouches[0]?.clientX ?? null;
  }, []);

  const onSwipeTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = swipeStartX.current;
      swipeStartX.current = null;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientX;
      if (end == null) return;
      const dx = end - start;
      if (dx > 56) goPrev();
      else if (dx < -56) goNext();
    },
    [goPrev, goNext],
  );

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-base">{t('schedule.weekAgendaTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t(readOnly ? 'schedule.weekAgendaDescriptionReadOnly' : 'schedule.weekAgendaDescription')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-4 sm:px-6">
        {weekDays.length > 0 && (
          <div
            className="grid grid-cols-7 gap-1"
            role="tablist"
            aria-label={t('schedule.weekDayStripLabel')}
          >
            {weekDays.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const hasShifts = (shiftsByDay[dayStr]?.length ?? 0) > 0;
              const selected = i === displayIndex;
              const dayIsToday = dayStr === format(new Date(), 'yyyy-MM-dd');

              return (
                <button
                  key={dayStr}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setDayIndex(i)}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-2 text-center transition-colors',
                    'border-border bg-muted/30 hover:bg-muted/60',
                    selected && 'border-primary bg-primary/10 ring-2 ring-primary/30',
                    dayIsToday && !selected && 'border-primary/40 bg-primary/[0.06]',
                  )}
                >
                  <span className="text-[0.65rem] font-medium uppercase leading-none text-muted-foreground">
                    {format(day, 'EEE')}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold tabular-nums leading-none">{format(day, 'd')}</span>
                  <span
                    className={cn('mt-1 h-1 w-1 shrink-0 rounded-full', hasShifts ? 'bg-primary' : 'bg-transparent')}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        )}

        {selectedDay && (
          <div
            className="min-w-0 space-y-3"
            onTouchStart={onSwipeTouchStart}
            onTouchEnd={onSwipeTouchEnd}
          >
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={displayIndex <= 0}
                onClick={goPrev}
                aria-label={t('schedule.previousDay')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div
                className={cn(
                  'min-w-0 flex-1 rounded-xl border border-border bg-card/60 px-3 py-2 text-center',
                  isToday && 'ring-1 ring-primary/25 bg-primary/[0.04]',
                )}
              >
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {format(selectedDay, 'EEEE')}
                </div>
                <div className="text-base font-semibold">{format(selectedDay, 'MMMM d, yyyy')}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={displayIndex >= lastIndex}
                onClick={goNext}
                aria-label={t('schedule.nextDay')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {dayShifts.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('schedule.weekAgendaEmptyDay')}</p>
                {!readOnly && (
                  <AgendaDayAddControls
                    dayStr={selectedDayStr}
                    activeEmployees={activeEmployees}
                    onAddShift={onAddShift}
                  />
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {dayShifts.map((shift) => {
                  const emp = employees.find((e) => e.id === shift.staff_id);
                  const colors = getShiftColor(shift.staff_id, activeEmployees);
                  const body = (
                    <>
                      {!singleStaffId && (
                        <div className="font-medium leading-tight">
                          {emp ? employeeFullName(emp) : '—'}
                        </div>
                      )}
                      <div className={cn('text-xs text-muted-foreground', !singleStaffId && 'mt-0.5')}>
                        {formatShiftRange(shift)}
                      </div>
                    </>
                  );
                  return (
                    <li key={shift.id}>
                      {readOnly ? (
                        <div
                          className={cn(
                            'w-full rounded-lg border px-3 py-2.5 text-left text-sm',
                            colors.block,
                          )}
                        >
                          {body}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditShift(shift)}
                          className={cn(
                            'w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                            colors.block,
                            'cursor-pointer active:opacity-90',
                          )}
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
                {!readOnly && (
                  <div className="pt-1">
                    <AgendaDayAddControls
                      dayStr={selectedDayStr}
                      activeEmployees={activeEmployees}
                      onAddShift={onAddShift}
                    />
                  </div>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('schedule.weeklySummary')}</span>
          <span className="font-medium tabular-nums">{formatHours1Decimal(weekTotalHours)}</span>
        </div>

        {activeEmployees.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('schedule.noActiveEmployees')}</p>
        )}
      </CardContent>
    </Card>
  );
}
