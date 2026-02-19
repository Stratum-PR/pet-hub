import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import type { EmployeeShift } from '@/types';
import type { Employee } from '@/types';
import { t } from '@/lib/translations';
import type { WeekTimeRange } from '@/lib/businessHours';
import { hasSameEmployeeOverlapByTime } from '@/lib/scheduleUtils';

interface EditShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: EmployeeShift | null;
  employees: Employee[];
  onSave: (id: string, payload: { start_time: string; end_time: string; notes?: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<boolean>;
  /** When set, shift must fall within this range or save is blocked with a warning. */
  businessTimeRange?: WeekTimeRange | null;
  /** When set, save is blocked if the new times overlap another shift for the same employee. */
  allShifts?: EmployeeShift[];
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return format(d, 'HH:mm');
}

function parseTimeHHMM(time: string): { h: number; m: number } | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/** Round minutes to nearest 30 (0 or 30). */
function roundToHalfHour(h: number, m: number): { h: number; m: number } {
  const totalM = h * 60 + m;
  const rounded = Math.round(totalM / 30) * 30;
  const outH = Math.floor(rounded / 60) % 24;
  const outM = rounded % 60;
  return { h: outH, m: outM };
}

function isoFromDateAndTime(date: Date, time: string): string {
  const parsed = parseTimeHHMM(time);
  if (!parsed) return new Date(date).toISOString();
  const { h, m } = roundToHalfHour(parsed.h, parsed.m);
  const d = new Date(date);
  setHours(d, h);
  setMinutes(d, m);
  return d.toISOString();
}

export function EditShiftDialog({
  open,
  onOpenChange,
  shift,
  employees,
  onSave,
  onDelete,
  businessTimeRange,
  allShifts,
}: EditShiftDialogProps) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (shift) {
      setStartTime(toTimeInputValue(shift.start_time));
      setEndTime(toTimeInputValue(shift.end_time));
      setNotes(shift.notes ?? '');
      setSaveError(null);
      setValidationError(null);
    }
  }, [shift]);

  const employeeName = shift ? employees.find((e) => e.id === shift.employee_id)?.name ?? '' : '';
  const shiftDate = shift ? new Date(shift.start_time) : new Date();

  const handleSave = async () => {
    if (!shift) return;
    setSaveError(null);
    setValidationError(null);
    const startParsed = parseTimeHHMM(startTime);
    const endParsed = parseTimeHHMM(endTime);
    if (!startParsed || !endParsed) {
      setValidationError(t('schedule.invalidTimeFormat'));
      return;
    }
    const startMinutesOfDay = startParsed.h * 60 + startParsed.m;
    const endMinutesOfDay = endParsed.h * 60 + endParsed.m;
    const useNextDayForEnd = endMinutesOfDay <= startMinutesOfDay;
    const y = shiftDate.getFullYear();
    const mo = shiftDate.getMonth();
    const d = shiftDate.getDate();
    const startDate = new Date(y, mo, d, startParsed.h, startParsed.m, 0, 0);
    const endDate = useNextDayForEnd
      ? new Date(y, mo, d + 1, endParsed.h, endParsed.m, 0, 0)
      : new Date(y, mo, d, endParsed.h, endParsed.m, 0, 0);
    const start_time = isoFromDateAndTime(startDate, startTime);
    const end_time = isoFromDateAndTime(endDate, endTime);
    if (new Date(end_time).getTime() <= new Date(start_time).getTime()) {
      setValidationError(t('schedule.endMustBeAfterStart'));
      return;
    }
    if (businessTimeRange != null) {
      const startM = new Date(start_time).getHours() * 60 + new Date(start_time).getMinutes();
      const endM = new Date(end_time).getHours() * 60 + new Date(end_time).getMinutes();
      const rangeStart = businessTimeRange.startMinutes;
      const rangeEnd = businessTimeRange.endMinutes;
      if (startM < rangeStart || endM > rangeEnd) {
        setValidationError(t('schedule.outsideBusinessHours'));
        return;
      }
    }
    if (allShifts?.length && hasSameEmployeeOverlapByTime(allShifts, shift.employee_id, start_time, end_time, shift.id)) {
      setValidationError(t('schedule.sameEmployeeOverlap'));
      return;
    }
    setSaving(true);
    try {
      await onSave(shift.id, { start_time, end_time, notes });
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!shift) return;
    if (!window.confirm(t('schedule.confirmDeleteShift'))) return;
    setDeleting(true);
    try {
      const ok = await onDelete(shift.id);
      if (ok) onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('schedule.editShift')}</DialogTitle>
          <DialogDescription>
            {employeeName} – {format(shiftDate, 'EEEE, MMM d')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shift-start">{t('schedule.startTime')}</Label>
              <Input
                id="shift-start"
                type="time"
                step={1800}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="shift-end">{t('schedule.endTime')}</Label>
              <Input
                id="shift-end"
                type="time"
                step={1800}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {(validationError || saveError) && (
            <p className="text-sm text-destructive">
              {validationError ?? saveError}
            </p>
          )}
          <div>
            <Label htmlFor="shift-notes">{t('schedule.notes')}</Label>
            <Textarea
              id="shift-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('schedule.notesPlaceholder')}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('schedule.deleteShift')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
