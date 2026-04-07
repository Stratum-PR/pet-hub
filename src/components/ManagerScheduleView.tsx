import { useMemo, useCallback, useState, useRef } from 'react';

import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, setHours, setMinutes, addMinutes, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import type { Employee, EmployeeShift } from '@/types';
import { EditShiftDialog, type AddShiftContext } from '@/components/EditShiftDialog';
import { ScheduleTable } from '@/components/ScheduleTable';
import type { WeekTimeRange } from '@/lib/businessHours';
import { getShiftColor } from '@/lib/scheduleColors';
import { hasSameEmployeeOverlap } from '@/lib/scheduleUtils';
import { formatHours1Decimal, scheduledHoursBetween } from '@/lib/scheduleHours';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { Link } from 'react-router-dom';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { Badge } from '@/components/ui/badge';
import { usePendingShiftChangeRequestCount } from '@/hooks/useShiftChangeRequests';

const DEFAULT_START_MINUTES = 7 * 60;
const DEFAULT_END_MINUTES = 21 * 60;
const SLOT_HEIGHT_PX = 48;
const MINUTES_PER_SLOT = 30;

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
  addShift: (payload: { staff_id: string; start_time: string; end_time: string; notes?: string }) => Promise<EmployeeShift | null>;
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
  const businessSlug = useResolvedBusinessSlug();
  const changeRequestsHref = businessSlug
    ? `/${businessSlug}/employee-schedule/change-requests`
    : '/employee-schedule/change-requests';
  const { pendingCount } = usePendingShiftChangeRequestCount();
  const isMobile = useIsMobile();
  const rangeStartMinutes = timeRange?.startMinutes ?? DEFAULT_START_MINUTES;
  const rangeEndMinutes = timeRange?.endMinutes ?? DEFAULT_END_MINUTES;
  const timeSlots = useMemo(() => generateTimeSlots(rangeStartMinutes, rangeEndMinutes), [rangeStartMinutes, rangeEndMinutes]);
  const weekEnd = endOfWeek(weekStart);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const [editingShift, setEditingShift] = useState<EmployeeShift | null>(null);
  const [addShiftContext, setAddShiftContext] = useState<AddShiftContext | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resizePreview, setResizePreview] = useState<{ shiftId: string; endTime: string } | null>(null);
  const [movePreview, setMovePreview] = useState<{ shiftId: string; startTime: string; endTime: string } | null>(null);
  const [hoveredShiftId, setHoveredShiftId] = useState<string | null>(null);
  const [copyingFromLastWeek, setCopyingFromLastWeek] = useState(false);
  const knownShiftIdsRef = useRef<Set<string>>(new Set());
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
        staff_id: employeeId,
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
      if (shift && hasSameEmployeeOverlap(shifts, shift.staff_id, dayStr, r.shiftStart, newEnd.toISOString(), r.shiftId)) {
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
        if (hasSameEmployeeOverlap(shifts, m.shift.staff_id, dayStr, preview.startTime, preview.endTime, m.shift.id)) {
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
          if (hasSameEmployeeOverlap(shifts, m.shift.staff_id, dayStr, newStart.toISOString(), newEnd.toISOString(), m.shift.id)) {
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

  const weekShifts = useMemo(
    () =>
      shifts.filter((s) => {
        const t = new Date(s.start_time).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime();
      }),
    [shifts, weekStart, weekEnd]
  );

  const shiftsByDay = useMemo(() => {
    const byDay: Record<string, EmployeeShift[]> = {};
    weekDays.forEach((day) => {
      byDay[format(day, 'yyyy-MM-dd')] = weekShifts.filter((s) => isShiftOnDay(s, day));
    });
    return byDay;
  }, [weekShifts, weekDays]);

  const newShiftIds = useMemo(() => {
    const known = knownShiftIdsRef.current;
    const current = new Set(weekShifts.map((s) => s.id));
    const added = new Set<string>();
    for (const id of current) if (!known.has(id)) added.add(id);
    knownShiftIdsRef.current = new Set(shifts.map((s) => s.id));
    return added;
  }, [weekShifts, shifts]);

  const laneLayoutByShiftId = useMemo(() => {
    const layout: Record<string, { laneIndex: number; laneCount: number }> = {};
    if (isMobile) return layout;

    for (const day of weekDays) {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayShifts = (shiftsByDay[dayStr] ?? []).slice().sort((a, b) => {
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });

      const lanes: { endMs: number }[] = [];
      const assigned: Record<string, number> = {};

      for (const s of dayShifts) {
        const startMs = new Date(s.start_time).getTime();
        const endMs = new Date(s.end_time).getTime();

        let laneIndex = lanes.findIndex((l) => l.endMs <= startMs);
        if (laneIndex === -1) {
          laneIndex = lanes.length;
          lanes.push({ endMs });
        } else {
          lanes[laneIndex].endMs = endMs;
        }
        assigned[s.id] = laneIndex;
      }

      const laneCount = Math.max(1, lanes.length);
      for (const s of dayShifts) {
        layout[s.id] = { laneIndex: assigned[s.id] ?? 0, laneCount };
      }
    }
    return layout;
  }, [shiftsByDay, weekDays, isMobile]);

  const lastWeekStart = subWeeks(weekStart, 1);
  const lastWeekEnd = endOfWeek(lastWeekStart);
  const shiftsInLastWeek = useMemo(
    () => shifts.filter((s) => {
      const t = new Date(s.start_time).getTime();
      return t >= lastWeekStart.getTime() && t <= lastWeekEnd.getTime();
    }),
    [shifts, lastWeekStart.getTime(), lastWeekEnd.getTime()]
  );
  const showCopyFromLastWeek = weekShifts.length === 0 && shiftsInLastWeek.length > 0;

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
          staff_id: shift.staff_id,
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
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
          <Button type="button" variant="outline" size="sm" asChild>
            <Link
              to={changeRequestsHref}
              className="inline-flex items-center gap-2"
              aria-label={
                pendingCount >= 1
                  ? `${t('nav.shiftChangeRequests')}: ${pendingCount} ${t('schedule.shiftApproval.pending')}`
                  : t('nav.shiftChangeRequests')
              }
            >
              {t('nav.shiftChangeRequests')}
              {pendingCount >= 1 && (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[1.25rem] justify-center px-1.5 text-xs tabular-nums"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              )}
            </Link>
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

      <div className="flex flex-col gap-4">
        <div className="min-w-0">
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {!isMobile && (
                <div className="w-56 shrink-0">
                  <div className="text-sm font-semibold mb-2">{t('schedule.dragEmployees')}</div>
                  <div className="space-y-2">
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
                        {formatStaffNameAggregated(emp.name)}
                      </div>
                    ))}
                    {activeEmployees.length === 0 && (
                      <p className="text-sm text-muted-foreground">{t('schedule.noActiveEmployees')}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="overflow-x-auto lg:overflow-x-visible overflow-y-visible">
                    <div
                      className="grid border-b border-border sticky top-0 z-20 bg-background"
                      style={{ gridTemplateColumns: `min(72px, 4.5rem) repeat(${weekDays.length}, minmax(100px, 1fr))` }}
                    >
                      <div className="sticky left-0 z-30 bg-muted/30 border-r border-border min-w-[72px]" />
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
                          {(() => {
                            const dayStr = format(day, 'yyyy-MM-dd');
                            const dayShifts = (shiftsByDay[dayStr] ?? []).filter((shift) => shift.id !== movePreview?.shiftId);

                            const groups = new Map<string, EmployeeShift[]>();
                            const getEndFor = (shift: EmployeeShift) =>
                              resizePreview?.shiftId === shift.id ? resizePreview.endTime : shift.end_time;

                            for (const s of dayShifts) {
                              const key = `${s.start_time}__${getEndFor(s)}`;
                              const existing = groups.get(key);
                              if (existing) existing.push(s);
                              else groups.set(key, [s]);
                            }

                            const elements: React.ReactNode[] = [];

                            for (const [key, group] of groups.entries()) {
                              if (group.length <= 1) continue;
                              const anchor = group[0];
                              const startIso = anchor.start_time;
                              const endIso = getEndFor(anchor);
                              const { top, height } = shiftPositionFromTimes(startIso, endIso, rangeStartMinutes);
                              const totalHeight = Math.max(height, 32);
                              const label = getShiftLabel(startIso, endIso);

                              // Fan all cards with a small horizontal offset (like your example).
                              // This keeps each card directly clickable even when start/end match.
                              const OFFSET_PX = 6;

                              const ordered = group
                                .slice()
                                .sort((a, b) => {
                                  const an = employees.find((e) => e.id === a.staff_id)?.name ?? '';
                                  const bn = employees.find((e) => e.id === b.staff_id)?.name ?? '';
                                  return an.localeCompare(bn);
                                });

                              ordered.forEach((shift, idx) => {
                                const emp = employees.find((e) => e.id === shift.staff_id);
                                const colors = getShiftColor(shift.staff_id, activeEmployees);
                                const leftPx = 4 + idx * OFFSET_PX;
                                const widthPx = 8 + idx * OFFSET_PX;

                                elements.push(
                                  <div
                                    key={`stack-${shift.id}`}
                                    className={cn(
                                      'absolute rounded-md overflow-hidden border flex flex-col',
                                      newShiftIds.has(shift.id) && 'animate-in fade-in-0 zoom-in-95 duration-200',
                                      colors.block
                                    )}
                                    style={{
                                      top: top + 2,
                                      height: totalHeight,
                                      left: `calc(0.25rem + ${leftPx}px)`,
                                      width: `calc(100% - 0.5rem - ${widthPx}px)`,
                                      zIndex:
                                        movePreview?.shiftId === shift.id
                                          ? 60
                                          : hoveredShiftId === shift.id
                                            ? 50
                                            : 12 + idx,
                                    }}
                                    onMouseEnter={() => setHoveredShiftId(shift.id)}
                                    onMouseLeave={() => setHoveredShiftId((id) => (id === shift.id ? null : id))}
                                  >
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        'flex-1 min-h-0 px-2 py-1 text-left text-xs font-medium cursor-grab active:cursor-grabbing transition-colors flex flex-col justify-center',
                                        colors.hover
                                      )}
                                      style={{ minHeight: totalHeight - 6 }}
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
                                        {label}
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
                              });
                            }

                            const nonStacked = dayShifts.filter((s) => {
                              const k = `${s.start_time}__${getEndFor(s)}`;
                              return (groups.get(k)?.length ?? 0) <= 1;
                            });

                            elements.push(
                              ...nonStacked.map((shift) => {
                              const endTimeForPosition =
                                resizePreview?.shiftId === shift.id ? resizePreview.endTime : shift.end_time;
                              const { top, height } = shiftPositionFromTimes(
                                shift.start_time,
                                endTimeForPosition,
                                rangeStartMinutes
                              );
                              const emp = employees.find((e) => e.id === shift.staff_id);
                              const colors = getShiftColor(shift.staff_id, activeEmployees);
                              const totalHeight = Math.max(height, 28);
                              const bodyHeight = totalHeight - 6;
                              const dayLayout = laneLayoutByShiftId[shift.id];
                              const laneCount = dayLayout?.laneCount ?? 1;
                              const laneIndex = dayLayout?.laneIndex ?? 0;
                              const laneWidthPercent = laneCount > 1 ? 100 / laneCount : 100;
                              const laneLeftPercent = laneCount > 1 ? laneWidthPercent * laneIndex : 0;
                              const displayLabel = getShiftLabel(shift.start_time, endTimeForPosition);

                              return (
                                <div
                                  key={shift.id}
                                  className={cn('absolute rounded-md overflow-hidden border flex flex-col', colors.block)}
                                  style={{
                                    top: top + 2,
                                    height: totalHeight,
                                    left: laneCount > 1 ? `calc(${laneLeftPercent}% + 0.25rem)` : '0.25rem',
                                    width: laneCount > 1 ? `calc(${laneWidthPercent}% - 0.5rem)` : 'calc(100% - 0.5rem)',
                                    zIndex:
                                      movePreview?.shiftId === shift.id ? 30 : hoveredShiftId === shift.id ? 20 : 1,
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
                                      {displayLabel}
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
                            })
                            );

                            return elements;
                          })()}
                          {movePreview &&
                            format(day, 'yyyy-MM-dd') === format(new Date(movePreview.startTime), 'yyyy-MM-dd') && (() => {
                              const shift = shifts.find((s) => s.id === movePreview.shiftId);
                              if (!shift) return null;
                              const { top, height } = shiftPositionFromTimes(
                                movePreview.startTime,
                                movePreview.endTime,
                                rangeStartMinutes
                              );
                              const emp = employees.find((e) => e.id === shift.staff_id);
                              const colors = getShiftColor(shift.staff_id, activeEmployees);
                              const totalHeight = Math.max(height, 28);
                              const bodyHeight = totalHeight - 6;
                              const previewLabel = getShiftLabel(movePreview.startTime, movePreview.endTime);

                              return (
                                <div
                                  key={`preview-${shift.id}`}
                                  className={cn('absolute rounded-md overflow-hidden border flex flex-col opacity-90 ring-2 ring-primary/30', colors.block)}
                                  style={{
                                    top: top + 2,
                                    height: totalHeight,
                                    left: '0.25rem',
                                    width: 'calc(100% - 0.5rem)',
                                    zIndex: 40,
                                  }}
                                >
                                  <div
                                    className={cn('flex-1 min-h-0 px-2 py-1 text-left text-xs font-medium cursor-grabbing flex flex-col justify-center', colors.hover)}
                                    style={{ minHeight: bodyHeight }}
                                  >
                                    {emp?.name ?? ''}
                                    <br />
                                    <span className="text-muted-foreground font-normal opacity-90">
                                      {previewLabel}
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
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="min-w-0">
          <ScheduleTable
            shifts={weekShifts}
            employees={employees}
            weekDays={weekDays}
            onEditShift={(shift) => {
              setEditingShift(shift);
              setAddShiftContext(null);
              setEditOpen(true);
            }}
            onAddShift={(employeeId, date) => {
              setEditingShift(null);
              setAddShiftContext({ employeeId, date });
              setEditOpen(true);
            }}
          />
        </div>
      </div>

      <EditShiftDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setAddShiftContext(null);
        }}
        shift={editingShift ? (shifts.find((s) => s.id === editingShift.id) ?? editingShift) : null}
        employees={employees}
        onSave={async (id, payload) => updateShift(id, payload)}
        onDelete={deleteShift}
        businessTimeRange={timeRange ?? undefined}
        allShifts={shifts}
        addContext={addShiftContext}
        onAdd={addShift}
      />
    </div>
  );
}

