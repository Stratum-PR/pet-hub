import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/translations';
import type { EmployeeShift, StaffShiftChangeKind } from '@/types';
import { format } from 'date-fns';

interface ShiftRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: EmployeeShift[];
  onSubmit: (payload: {
    kind: StaffShiftChangeKind;
    staffShiftId?: string | null;
    proposedStart?: string | null;
    proposedEnd?: string | null;
    reason: string;
  }) => Promise<boolean>;
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v: string): string {
  return new Date(v).toISOString();
}

export function ShiftRequestDialog({
  open,
  onOpenChange,
  shifts,
  onSubmit,
}: ShiftRequestDialogProps) {
  const [kind, setKind] = useState<StaffShiftChangeKind>('new');
  const [shiftId, setShiftId] = useState<string>('');
  const [startLocal, setStartLocal] = useState(() => toLocalDatetimeValue(new Date().toISOString()));
  const [endLocal, setEndLocal] = useState(() => toLocalDatetimeValue(new Date().toISOString()));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedShift = useMemo(
    () => shifts.find((s) => s.id === shiftId),
    [shifts, shiftId]
  );

  useEffect(() => {
    if (kind === 'change' && selectedShift) {
      setStartLocal(toLocalDatetimeValue(selectedShift.start_time));
      setEndLocal(toLocalDatetimeValue(selectedShift.end_time));
    }
  }, [kind, selectedShift]);

  const resetForOpen = () => {
    setKind('new');
    setShiftId('');
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    setStartLocal(toLocalDatetimeValue(now.toISOString()));
    setEndLocal(toLocalDatetimeValue(end.toISOString()));
    setReason('');
  };

  const handleOpen = (next: boolean) => {
    if (next) resetForOpen();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let payload: Parameters<typeof onSubmit>[0];
      if (kind === 'new') {
        payload = {
          kind: 'new',
          proposedStart: fromLocalDatetimeValue(startLocal),
          proposedEnd: fromLocalDatetimeValue(endLocal),
          reason,
        };
      } else if (kind === 'change') {
        if (!selectedShift) return;
        payload = {
          kind: 'change',
          staffShiftId: selectedShift.id,
          proposedStart: fromLocalDatetimeValue(startLocal),
          proposedEnd: fromLocalDatetimeValue(endLocal),
          reason,
        };
      } else {
        if (!selectedShift) return;
        payload = {
          kind: 'cancel',
          staffShiftId: selectedShift.id,
          reason,
        };
      }
      const ok = await onSubmit(payload);
      if (ok) handleOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('schedule.shiftRequest.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('schedule.shiftRequest.kind')}</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as StaffShiftChangeKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">{t('schedule.shiftRequest.kindNew')}</SelectItem>
                <SelectItem value="change">{t('schedule.shiftRequest.kindChange')}</SelectItem>
                <SelectItem value="cancel">{t('schedule.shiftRequest.kindCancel')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(kind === 'change' || kind === 'cancel') && (
            <div className="space-y-2">
              <Label>{t('schedule.shiftRequest.pickShift')}</Label>
              <Select value={shiftId} onValueChange={setShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('schedule.shiftRequest.pickShift')} />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {format(new Date(s.start_time), 'MMM d, h:mm a')} –{' '}
                      {format(new Date(s.end_time), 'h:mm a')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === 'new' || kind === 'change') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="shift-req-start">{t('schedule.startTime')}</Label>
                <Input
                  id="shift-req-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-req-end">{t('schedule.endTime')}</Label>
                <Input
                  id="shift-req-end"
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                />
              </div>
            </>
          )}

          {kind === 'change' && selectedShift && (
            <p className="text-xs text-muted-foreground">
              {t('schedule.shiftRequest.was')}{' '}
              {format(new Date(selectedShift.start_time), 'MMM d, h:mm a')} –{' '}
              {format(new Date(selectedShift.end_time), 'h:mm a')}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="shift-req-reason">{t('schedule.shiftRequest.reason')}</Label>
            <Textarea
              id="shift-req-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('schedule.shiftRequest.reasonPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              (kind !== 'new' && kind !== 'change' && kind !== 'cancel') ||
              ((kind === 'change' || kind === 'cancel') && !shiftId) ||
              ((kind === 'new' || kind === 'change') && (!startLocal || !endLocal))
            }
          >
            {saving ? t('common.saving') : t('schedule.shiftRequest.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
