import { useMemo, useCallback, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, setHours, setMinutes, addMinutes, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { EditShiftDialog } from '@/components/EditShiftDialog';
import { ScheduleSummary } from '@/components/ScheduleSummary';
import type { WeekTimeRange } from '@/lib/businessHours';
import { hasSameEmployeeOverlap } from '@/lib/scheduleUtils';

const DEFAULT_START_MINUTES = 7 * 60;
const DEFAULT_END_MINUTES = 21 * 60;
const SLOT_HEIGHT_PX = 48;
const MINUTES_PER_SLOT = 30;

const SHIFT_COLORS = [
  { block: 'bg-blue-200/80 border-blue-400 dark:bg-blue-900/40 dark:border-blue-600', handle: 'bg-blue-300 hover:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600', hover: 'hover:bg-blue-300/80 dark:hover:bg-blue-800/50' },
  { block: 'bg-emerald-200/80 border-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-600', handle: 'bg-emerald-300 hover:bg-emerald-400 dark:bg-emerald-700 dark:hover:bg-emerald-600', hover: 'hover:bg-emerald-300/80 dark:hover:bg-emerald-800/50' },
  { block: 'bg-amber-200/80 border-amber-400 dark:bg-amber-900/40 dark:border-amber-600', handle: 'bg-amber-300 hover:bg-amber-400 dark:bg-amber-700 dark:hover:bg-amber-600', hover: 'hover:bg-amber-300/80 dark:hover:bg-amber-800/50' },
  { block: 'bg-violet-200/80 border-violet-400 dark:bg-violet-900/40 dark:border-violet-600', handle: 'bg-violet-300 hover:bg-violet-400 dark:bg-violet-700 dark:hover:bg-violet-600', hover: 'hover:bg-violet-300/80 dark:hover:bg-violet-800/50' },
  { block: 'bg-rose-200/80 border-rose-400 dark:bg-rose-900/40 dark:border-rose-600', handle: 'bg-rose-300 hover:bg-rose-400 dark:bg-rose-700 dark:hover:bg-rose-600', hover: 'hover:bg-rose-300/80 dark:hover:bg-rose-800/50' },
  { block: 'bg-cyan-200/80 border-cyan-400 dark:bg-cyan-900/40 dark:border-cyan-600', handle: 'bg-cyan-300 hover:bg-cyan-400 dark:bg-cyan-700 dark:hover:bg-cyan-600', hover: 'hover:bg-cyan-300/80 dark:hover:bg-cyan-800/50' },
  { block: 'bg-orange-200/80 border-orange-400 dark:bg-orange-900/40 dark:border-orange-600', handle: 'bg-orange-300 hover:bg-orange-400 dark:bg-orange-700 dark:hover:bg-orange-600', hover: 'hover:bg-orange-300/80 dark:hover:bg-orange-800/50' },
  { block: 'bg-teal-200/80 border-teal-400 dark:bg-teal-900/40 dark:border-teal-600', handle: 'bg-teal-300 hover:bg-teal-400 dark:bg-teal-700 dark:hover:bg-teal-600', hover: 'hover:bg-teal-300/80 dark:hover:bg-teal-800/50' },
] as const;

function getShiftColor(employeeId: string, activeEmployees: Employee[]) {
  const idx = activeEmployees.findIndex((e) => e.id === employeeId);
  return SHIFT_COLORS[idx < 0 ? 0 : idx % SHIFT_COLORS.length];
}

function generateTimeSlots(startMinutes: number, endMinutes: number) {
  const slots: { hour: number; minute: number; label: string }[] = [];
  for (let m = startMinutes; m < endMinutes; m += MINUTES_PER_SLOT) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label = h === 12 && min === 0 ? '12:00 PM' : h < 12 ? `${h}:${min.toString().padStart(2, '0')} AM` : `${h === 12 ? 12 : h - 12}:${min.toString().padStart(2, '0')} PM`;
    slots.push({ hour: h, minute: min, label });
  }
  return slots;
}

function shiftPosition(shift: EmployeeShift, rangeStartMinutes: number) {
  return shiftPositionFromTimes(shift.start_time, shift.end_time, rangeStartMinutes);
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

function isShiftOnDay(shift: EmployeeShift, day: Date): boolean {
  const d = format(new Date(shift.start_time), 'yyyy-MM-dd');
  const dayStr = format(day, 'yyyy-MM-dd');
  return d === dayStr;
}

/** Snap a date to the nearest 30-minute boundary (same calendar day). */
function snapToHalfHour(d: Date): Date {
  const totalM = d.getHours() * 60 + d.getMinutes();
  const snapped = Math.round(totalM / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
  const out = new Date(d);
  out.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
  return out;
}

interface ManagerScheduleViewProps {
  weekStart: Date;
  onWeekChange: (start: Date) => void;
  employees: Employee[];
  shifts: EmployeeShift[];
  addShift: (payload: { employee_id: string; start_time: string; end_time: string; notes?: string }) => Promise<EmployeeShift | null>;
  updateShift: (id: string, payload: Partial<Pick<EmployeeShift, 'start_time' | 'end_time' | 'notes'>>) => Promise<EmployeeShift | null>;
  deleteShift: (id: string) => Promise<boolean>;
  timeRange?: WeekTimeRange;
}

export function ManagerScheduleView({
  weekStart,
  onWeekChange,
  employees,
  shifts,
  addShift,
  updateShift,
  deleteShift,
  timeRange,
}: ManagerScheduleViewProps) {
  const rangeStartMinutes = timeRange?.startMinutes ?? DEFAULT_START_MINUTES;
  const rangeEndMinutes = timeRange?.endMinutes ?? DEFAULT_END_MINUTES;
  const timeSlots = useMemo(() => generateTimeSlots(rangeStartMinutes, rangeEndMinutes), [rangeStartMinutes, rangeEndMinutes]);
  const weekEnd = endOfWeek(weekStart);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const [editingShift, setEditingShift] = useState<EmployeeShift | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resizePreview, setResizePreview] = useState<{ shiftId: string; endTime: string } | null>(null);
  const [movePreview, setMovePreview] = useState<{ shiftId: string; startTime: string; endTime: string } | null>(null);
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null);
  const [copyingFromLastWeek, setCopyingFromLastWeek] = useState(false);
  const movePreviewRef = useRef<{ shiftId: string; startTime: string; endTime: string } | null>(null);
  movePreviewRef.current = movePreview;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef<{ shiftId: string; shiftStart: string; startY: number; originalEnd: string } | null>(null);
  const movingRef = useRef<{ shift: EmployeeShift; startY: number; startX: number } | null>(null);
  const didDragRef = useRef(false);

  const TIME_COL_WIDTH_PX = 72;

  const activeEmployees = useMemo(() => employees.filter((e) => e.status === 'active'), [employees]);

  const handleDrop = useCallback(
    async (e: React.DragEvent, day: Date, slotHour: number, slotMinute: number) => {
      e.preventDefault();
      const employeeId = e.dataTransfer.getData('employeeId');
      if (!employeeId) return;
      const start = setMinutes(setHours(new Date(day), slotHour), slotMinute);
      const rangeEndHour = Math.floor(rangeEndMinutes / 60);
      const rangeEndMin = rangeEndMinutes % 60;
      const endHour = Math.min(slotHour + 4, rangeEndHour);
      const endMin = endHour === rangeEndHour ? Math.min(slotMinute, rangeEndMin) : slotMinute;
      const end = setMinutes(setHours(new Date(day), endHour), endMin);
      const dayStr = format(day, 'yyyy-MM-dd');
      if (hasSameEmployeeOverlap(shifts, employeeId, dayStr, start.toISOString(), end.toISOString())) {
        toast.error(t('schedule.sameEmployeeOverlap'));
        return;
      }
      await addShift({
        employee_id: employeeId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
    },
    [addShift, rangeEndMinutes, shifts]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const deltaY = e.clientY - r.startY;
      const deltaMinutes = Math.round((deltaY / SLOT_HEIGHT_PX) * MINUTES_PER_SLOT);
      const startDate = new Date(r.shiftStart);
      let newEnd = addMinutes(new Date(r.originalEnd), deltaMinutes);
      newEnd = snapToHalfHour(newEnd);
      const minEnd = addMinutes(startDate, MINUTES_PER_SLOT);
      const maxEnd = new Date(startDate);
      maxEnd.setHours(Math.floor(rangeEndMinutes / 60), rangeEndMinutes % 60, 0, 0);
      if (newEnd <= minEnd) newEnd = minEnd;
      if (newEnd > maxEnd) newEnd = maxEnd;
      setResizePreview({ shiftId: r.shiftId, endTime: newEnd.toISOString() });
    },
    [rangeEndMinutes]
  );

  const handleResizeEnd = useCallback(
    (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      setResizePreview(null);
      const deltaY = e.clientY - r.startY;
      const deltaMinutes = Math.round((deltaY / SLOT_HEIGHT_PX) * MINUTES_PER_SLOT);
      const startDate = new Date(r.shiftStart);
      let newEnd = addMinutes(new Date(r.originalEnd), deltaMinutes);
      newEnd = snapToHalfHour(newEnd);
      const minEnd = addMinutes(startDate, MINUTES_PER_SLOT);
      const maxEnd = new Date(startDate);
      maxEnd.setHours(Math.floor(rangeEndMinutes / 60), rangeEndMinutes % 60, 0, 0);
      if (newEnd <= minEnd) newEnd = minEnd;
      if (newEnd > maxEnd) newEnd = maxEnd;
      const shift = shifts.find((s) => s.id === r.shiftId);
      const dayStr = format(startDate, 'yyyy-MM-dd');
      if (shift && hasSameEmployeeOverlap(shifts, shift.employee_id, dayStr, r.shiftStart, newEnd.toISOString(), r.shiftId)) {
        toast.error(t('schedule.sameEmployeeOverlap'));
      } else {
        updateShift(r.shiftId, { end_time: newEnd.toISOString() }).catch(() => {});
      }
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    },
    [updateShift, handleResizeMove, rangeEndMinutes, shifts]
  );

  const startResize = useCallback(
    (shift: EmployeeShift, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizingRef.current = {
        shiftId: shift.id,
        shiftStart: shift.start_time,
        startY: e.clientY,
        originalEnd: shift.end_time,
      };
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    },
    [handleResizeMove, handleResizeEnd]
  );

  const handleMoveMove = useCallback(
    (e: MouseEvent) => {
      const m = movingRef.current;
      if (!m) return;
      if (Math.abs(e.clientY - m.startY) > 5 || Math.abs(e.clientX - m.startX) > 5) didDragRef.current = true;
      const grid = gridRef.current;
      if (!grid) return;
      const gridRect = grid.getBoundingClientRect();
      const dayColWidth = (gridRect.width - TIME_COL_WIDTH_PX) / weekDays.length;
      const dayIndex = Math.floor((e.clientX - gridRect.left - TIME_COL_WIDTH_PX) / dayColWidth);
      const clampedDayIndex = Math.max(0, Math.min(weekDays.length - 1, dayIndex));
      const slotIndex = Math.round((e.clientY - gridRect.top) / SLOT_HEIGHT_PX);
      const numSlots = timeSlots.length;
      const clampedSlotIndex = Math.max(0, Math.min(numSlots - 1, slotIndex));
      const startMinutes = rangeStartMinutes + clampedSlotIndex * MINUTES_PER_SLOT;
      const durationMinutes = (new Date(m.shift.end_time).getTime() - new Date(m.shift.start_time).getTime()) / 60000;
      let endMinutes = startMinutes + durationMinutes;
      if (endMinutes > rangeEndMinutes) endMinutes = rangeEndMinutes;
      if (endMinutes - startMinutes < MINUTES_PER_SLOT) endMinutes = startMinutes + MINUTES_PER_SLOT;
      const targetDay = weekDays[clampedDayIndex];
      const newStart = new Date(targetDay);
      newStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      const newEnd = addMinutes(newStart, endMinutes - startMinutes);
      setMovePreview({ shiftId: m.shift.id, startTime: newStart.toISOString(), endTime: newEnd.toISOString() });
    },
    [weekDays, timeSlots.length, rangeStartMinutes, rangeEndMinutes]
  );

  const handleMoveEnd = useCallback(
    (e: MouseEvent) => {
      const m = movingRef.current;
      const preview = movePreviewRef.current;
      document.removeEventListener('mousemove', handleMoveMove);
      document.removeEventListener('mouseup', handleMoveEnd);
      if (!m) return;
      const releasedInsideGrid = gridRef.current?.contains(e.target as Node) ?? false;
      if (didDragRef.current && releasedInsideGrid && preview?.shiftId === m.shift.id) {
        const dayStr = format(new Date(preview.startTime), 'yyyy-MM-dd');
        if (hasSameEmployeeOverlap(shifts, m.shift.employee_id, dayStr, preview.startTime, preview.endTime, m.shift.id)) {
          toast.error(t('schedule.sameEmployeeOverlap'));
          setMovePreview(null);
        } else {
          updateShift(m.shift.id, {
            start_time: preview.startTime,
            end_time: preview.endTime,
          })
            .then(() => setMovePreview(null))
            .catch(() => setMovePreview(null));
        }
      } else if (didDragRef.current && releasedInsideGrid && !preview) {
        const deltaY = e.clientY - m.startY;
        const deltaMinutes = Math.round((deltaY / SLOT_HEIGHT_PX) * MINUTES_PER_SLOT);
        if (deltaMinutes !== 0) {
          const startDate = new Date(m.shift.start_time);
          const endDate = new Date(m.shift.end_time);
          let newStart = addMinutes(startDate, -deltaMinutes);
          let newEnd = addMinutes(endDate, -deltaMinutes);
          const dayStart = new Date(startDate);
          dayStart.setHours(Math.floor(rangeStartMinutes / 60), rangeStartMinutes % 60, 0, 0);
          const dayEnd = new Date(startDate);
          dayEnd.setHours(Math.floor(rangeEndMinutes / 60), rangeEndMinutes % 60, 0, 0);
          if (newStart < dayStart) {
            newStart = dayStart;
            newEnd = addMinutes(newStart, (endDate.getTime() - startDate.getTime()) / 60000);
          }
          if (newEnd > dayEnd) {
            newEnd = dayEnd;
            newStart = addMinutes(newEnd, -(endDate.getTime() - startDate.getTime()) / 60000);
          }
          const dayStr = format(newStart, 'yyyy-MM-dd');
          if (hasSameEmployeeOverlap(shifts, m.shift.employee_id, dayStr, newStart.toISOString(), newEnd.toISOString(), m.shift.id)) {
            toast.error(t('schedule.sameEmployeeOverlap'));
          } else {
            updateShift(m.shift.id, {
              start_time: newStart.toISOString(),
              end_time: newEnd.toISOString(),
            }).then(() => setMovePreview(null)).catch(() => setMovePreview(null));
          }
        } else {
          setMovePreview(null);
        }
      } else {
        setMovePreview(null);
        if (!didDragRef.current) {
          setEditingShift(m.shift);
          setEditOpen(true);
        }
      }
      movingRef.current = null;
    },
    [updateShift, handleMoveMove, rangeStartMinutes, rangeEndMinutes, shifts]
  );

  const startMove = useCallback(
    (shift: EmployeeShift, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      didDragRef.current = false;
      movingRef.current = { shift, startY: e.clientY, startX: e.clientX };
      document.addEventListener('mousemove', handleMoveMove);
      document.addEventListener('mouseup', handleMoveEnd);
    },
    [handleMoveMove, handleMoveEnd]
  );

  const shiftsByDay = useMemo(() => {
    const byDay: Record<string, EmployeeShift[]> = {};
    weekDays.forEach((day) => {
      byDay[format(day, 'yyyy-MM-dd')] = shifts.filter((s) => isShiftOnDay(s, day));
    });
    return byDay;
  }, [shifts, weekDays]);

  const lastWeekStart = subWeeks(weekStart, 1);
  const lastWeekEnd = endOfWeek(lastWeekStart);
  const shiftsInCurrentWeek = useMemo(
    () => shifts.filter((s) => {
      const t = new Date(s.start_time).getTime();
      return t >= weekStart.getTime() && t <= weekEnd.getTime();
    }),
    [shifts, weekStart.getTime(), weekEnd.getTime()]
  );
  const shiftsInLastWeek = useMemo(
    () => shifts.filter((s) => {
      const t = new Date(s.start_time).getTime();
      return t >= lastWeekStart.getTime() && t <= lastWeekEnd.getTime();
    }),
    [shifts, lastWeekStart.getTime(), lastWeekEnd.getTime()]
  );
  const showCopyFromLastWeek = shiftsInCurrentWeek.length === 0 && shiftsInLastWeek.length > 0;

  const handleCopyFromLastWeek = useCallback(async () => {
    setCopyingFromLastWeek(true);
    try {
      for (const shift of shiftsInLastWeek) {
        const startDate = new Date(shift.start_time);
        const dayOfWeek = startDate.getDay();
        const newStart = addDays(weekStart, dayOfWeek);
        newStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
        const durationMs = new Date(shift.end_time).getTime() - startDate.getTime();
        const newEnd = addMinutes(newStart, durationMs / 60000);
        await addShift({
          employee_id: shift.employee_id,
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
          notes: shift.notes ?? undefined,
        });
      }
    } finally {
      setCopyingFromLastWeek(false);
    }
  }, [shiftsInLastWeek, weekStart, addShift]);

  const totalGridHeight = timeSlots.length * SLOT_HEIGHT_PX;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('schedule.managerTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('schedule.managerDescription')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => onWeekChange(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[220px] text-center">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => onWeekChange(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWeekChange(startOfWeek(new Date()))}>
            {t('schedule.today')}
          </Button>
          {showCopyFromLastWeek && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyFromLastWeek}
              disabled={copyingFromLastWeek}
            >
              {copyingFromLastWeek ? t('common.saving') : t('schedule.copyFromLastWeek')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Draggable employees */}
        <Card className="lg:w-52 shrink-0">
          <CardHeader>
            <CardTitle className="text-sm">{t('schedule.dragEmployees')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {activeEmployees.map((emp) => (
              <div
                key={emp.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('employeeId', emp.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className={cn(
                  'px-3 py-2 rounded-md border bg-card text-sm font-medium cursor-grab active:cursor-grabbing',
                  'hover:bg-muted/80 transition-colors'
                )}
              >
                <User className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {emp.name}
              </div>
            ))}
            {activeEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('schedule.noActiveEmployees')}</p>
            )}
          </CardContent>
        </Card>

        {/* Week grid */}
        <Card className="flex-1 min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-hidden">
              <div
                className="grid border-b border-border"
                style={{ gridTemplateColumns: `min(72px, 4.5rem) repeat(${weekDays.length}, minmax(100px, 1fr))` }}
              >
                <div className="sticky left-0 z-10 bg-muted/30 border-r border-border min-w-[72px]" />
                {weekDays.map((day) => (
                  <div
                    key={format(day, 'yyyy-MM-dd')}
                    className={cn(
                      'text-center py-2 border-r border-border bg-muted/30 text-sm font-medium',
                      format(day, 'EEE') === format(new Date(), 'EEE') && 'bg-primary/10'
                    )}
                  >
                    <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                    <div>{format(day, 'd')}</div>
                  </div>
                ))}
              </div>
              <div
                ref={gridRef}
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
                {weekDays.map((day) => (
                  <div
                    key={format(day, 'yyyy-MM-dd')}
                    className="relative border-r border-border"
                    style={{ minHeight: totalGridHeight }}
                  >
                    {timeSlots.map((slot, slotIndex) => (
                        <div
                          key={`${format(day, 'yyyy-MM-dd')}-${slot.hour}-${slot.minute}`}
                          className={cn(
                            'absolute border-b hover:bg-muted/30 transition-colors',
                            slot.minute === 0 ? 'border-border' : 'border-border/50 bg-muted/5'
                          )}
                          style={{
                            left: 0,
                            right: 0,
                            top: slotIndex * SLOT_HEIGHT_PX,
                            height: SLOT_HEIGHT_PX,
                          }}
                          onDrop={(e) => handleDrop(e, day, slot.hour, slot.minute)}
                          onDragOver={handleDragOver}
                        />
                      ))}
                    {(shiftsByDay[format(day, 'yyyy-MM-dd')] ?? [])
                      .filter((shift) => shift.id !== movePreview?.shiftId)
                      .map((shift) => {
                        const endTimeForPosition =
                          resizePreview?.shiftId === shift.id ? resizePreview.endTime : shift.end_time;
                        const { top, height } = shiftPositionFromTimes(
                          shift.start_time,
                          endTimeForPosition,
                          rangeStartMinutes
                        );
                        const emp = employees.find((e) => e.id === shift.employee_id);
                        const colors = getShiftColor(shift.employee_id, activeEmployees);
                        const totalHeight = Math.max(height, 28);
                        const bodyHeight = totalHeight - 6;
                        return (
                          <div
                            key={shift.id}
                            className={cn('absolute left-1 right-1 rounded-md overflow-hidden border flex flex-col', colors.block)}
                            style={{
                              top: top + 2,
                              height: totalHeight,
                              zIndex: hoveredShiftId === shift.id ? 10 : 1,
                            }}
                            onMouseEnter={() => setHoveredShiftId(shift.id)}
                            onMouseLeave={() => setHoveredShiftId((id) => (id === shift.id ? null : id))}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              className={cn('flex-1 min-h-0 px-2 py-1 text-left text-xs font-medium cursor-grab active:cursor-grabbing transition-colors flex flex-col justify-center', colors.hover)}
                              style={{ minHeight: bodyHeight }}
                              onMouseDown={(e) => startMove(shift, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setEditingShift(shift);
                                  setEditOpen(true);
                                }
                              }}
                            >
                              {emp?.name ?? ''}
                              <br />
                              <span className="text-muted-foreground font-normal opacity-90">
                                {format(new Date(shift.start_time), 'h:mm')} – {format(new Date(shift.end_time), 'h:mm a')}
                              </span>
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              className={cn('h-1.5 shrink-0 cursor-ns-resize', colors.handle)}
                              onMouseDown={(e) => startResize(shift, e)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
                              }}
                              aria-label={t('schedule.resizeEndTime')}
                            />
                          </div>
                        );
                      })}
                    {movePreview &&
                      format(day, 'yyyy-MM-dd') === format(new Date(movePreview.startTime), 'yyyy-MM-dd') && (() => {
                        const shift = shifts.find((s) => s.id === movePreview.shiftId);
                        if (!shift) return null;
                        const { top, height } = shiftPositionFromTimes(
                          movePreview.startTime,
                          movePreview.endTime,
                          rangeStartMinutes
                        );
                        const emp = employees.find((e) => e.id === shift.employee_id);
                        const colors = getShiftColor(shift.employee_id, activeEmployees);
                        const totalHeight = Math.max(height, 28);
                        const bodyHeight = totalHeight - 6;
                        return (
                          <div
                            key={`preview-${shift.id}`}
                            className={cn('absolute left-1 right-1 rounded-md overflow-hidden border flex flex-col opacity-90 ring-2 ring-primary/30', colors.block)}
                            style={{ top: top + 2, height: totalHeight }}
                          >
                            <div
                              className={cn('flex-1 min-h-0 px-2 py-1 text-left text-xs font-medium cursor-grabbing flex flex-col justify-center', colors.hover)}
                              style={{ minHeight: bodyHeight }}
                            >
                              {emp?.name ?? ''}
                              <br />
                              <span className="text-muted-foreground font-normal opacity-90">
                                {format(new Date(movePreview.startTime), 'h:mm')} – {format(new Date(movePreview.endTime), 'h:mm a')}
                              </span>
                            </div>
                            <div className={cn('h-1.5 shrink-0', colors.handle)} />
                          </div>
                        );
                      })()}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScheduleSummary
        shifts={shifts}
        employees={employees}
        weekDays={weekDays}
        onOpenShift={(shift) => {
          setEditingShift(shift);
          setEditOpen(true);
        }}
      />

      <EditShiftDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        shift={editingShift ? (shifts.find((s) => s.id === editingShift.id) ?? editingShift) : null}
        employees={employees}
        onSave={async (id, payload) => updateShift(id, payload)}
        onDelete={deleteShift}
        businessTimeRange={timeRange ?? undefined}
        allShifts={shifts}
      />
    </div>
  );
}

