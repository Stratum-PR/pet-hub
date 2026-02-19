/**
 * Time Edit Request Dialog
 * Allows employees to request changes to their time entries
 */

import { useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTimeKiosk } from '@/hooks/useTimeKiosk';
import { TimeEntry } from '@/types';
import { format } from 'date-fns';

interface TimeEditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeEntry: TimeEntry;
  onSuccess?: () => void;
}

export function TimeEditRequestDialog({
  open,
  onOpenChange,
  timeEntry,
  onSuccess,
}: TimeEditRequestDialogProps) {
  const { requestTimeEdit, loading, error } = useTimeKiosk();
  const [clockIn, setClockIn] = useState(
    timeEntry.clock_in ? format(new Date(timeEntry.clock_in), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [clockOut, setClockOut] = useState(
    timeEntry.clock_out ? format(new Date(timeEntry.clock_out), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [notes, setNotes] = useState(timeEntry.notes || '');
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setSubmitError('Please provide a reason for the edit request');
      return;
    }

    setSubmitError(null);

    const changes: any = {};
    if (clockIn) {
      changes.clock_in = new Date(clockIn).toISOString();
    }
    if (clockOut) {
      changes.clock_out = new Date(clockOut).toISOString();
    }
    if (notes !== timeEntry.notes) {
      changes.notes = notes;
    }

    if (Object.keys(changes).length === 0) {
      setSubmitError('No changes detected');
      return;
    }

    const result = await requestTimeEdit(timeEntry.id, changes, reason);
    
    if (result) {
      onSuccess?.();
      onOpenChange(false);
      // Reset form
      setClockIn(timeEntry.clock_in ? format(new Date(timeEntry.clock_in), "yyyy-MM-dd'T'HH:mm") : '');
      setClockOut(timeEntry.clock_out ? format(new Date(timeEntry.clock_out), "yyyy-MM-dd'T'HH:mm") : '');
      setNotes(timeEntry.notes || '');
      setReason('');
    } else {
      setSubmitError(error || 'Failed to submit edit request');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Request Time Entry Edit
          </DialogTitle>
          <DialogDescription>
            Request changes to your time entry. A manager will review and approve your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Time Entry Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Current Time Entry</h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Clock In: </span>
                {timeEntry.clock_in &&
                  format(new Date(timeEntry.clock_in), 'MMM d, yyyy h:mm a')}
              </div>
              {timeEntry.clock_out && (
                <div>
                  <span className="text-muted-foreground">Clock Out: </span>
                  {format(new Date(timeEntry.clock_out), 'MMM d, yyyy h:mm a')}
                </div>
              )}
              {timeEntry.notes && (
                <div>
                  <span className="text-muted-foreground">Notes: </span>
                  {timeEntry.notes}
                </div>
              )}
            </div>
          </div>

          {/* Requested Changes */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clock-in">Clock In</Label>
                <Input
                  id="clock-in"
                  type="datetime-local"
                  value={clockIn}
                  onChange={(e) => setClockIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clock-out">Clock Out</Label>
                <Input
                  id="clock-out"
                  type="datetime-local"
                  value={clockOut}
                  onChange={(e) => setClockOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Edit <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please explain why you need to edit this time entry..."
                rows={3}
                required
              />
            </div>
          </div>

          {/* Error Message */}
          {(submitError || error) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError || error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !reason.trim()}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

