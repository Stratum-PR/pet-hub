/**
 * Schedule Check Warning Component
 * Displays warning when employee clocks in off-schedule
 */

import { AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface ScheduleCheckWarningProps {
  scheduleInfo?: {
    is_scheduled: boolean;
    shift_id?: string;
    shift_start?: string;
    shift_end?: string;
    warning?: string | null;
  };
  onContinue: () => void;
  onCancel: () => void;
}

export function ScheduleCheckWarning({
  scheduleInfo,
  onContinue,
  onCancel,
}: ScheduleCheckWarningProps) {
  const hasShift = scheduleInfo?.shift_start && scheduleInfo?.shift_end;

  return (
    <div className="space-y-4">
      <Alert variant="warning" className="border-yellow-500">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <AlertTitle className="text-lg">Off-Schedule Clock In</AlertTitle>
        <AlertDescription className="mt-2">
          You are clocking in outside your scheduled shift time.
        </AlertDescription>
      </Alert>

      {hasShift && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Your Scheduled Shift</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {scheduleInfo.shift_start &&
                    format(new Date(scheduleInfo.shift_start), 'h:mm a')}
                  {' - '}
                  {scheduleInfo.shift_end &&
                    format(new Date(scheduleInfo.shift_end), 'h:mm a')}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {scheduleInfo.shift_start &&
                  format(new Date(scheduleInfo.shift_start), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 justify-center pt-4">
        <Button
          size="lg"
          variant="outline"
          onClick={onCancel}
          className="px-8"
        >
          Cancel
        </Button>
        <Button
          size="lg"
          onClick={onContinue}
          className="px-8"
        >
          Continue Anyway
        </Button>
      </div>
    </div>
  );
}

