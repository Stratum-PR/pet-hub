/**
 * Informational panel when employee clocks in outside a scheduled shift (optional per business).
 */

import { Info, Calendar, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { t } from '@/lib/translations';

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

export function ScheduleCheckWarning({ scheduleInfo, onContinue, onCancel }: ScheduleCheckWarningProps) {
  const hasShift = scheduleInfo?.shift_start && scheduleInfo?.shift_end;

  return (
    <div className="space-y-4">
      <Alert variant="default" className="border-primary/25 bg-muted/40">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg text-foreground">{t('scheduleCheck.title')}</AlertTitle>
        <AlertDescription className="mt-2 text-muted-foreground">{t('scheduleCheck.body')}</AlertDescription>
      </Alert>

      {hasShift && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{t('scheduleCheck.shiftReference')}</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {scheduleInfo.shift_start && format(new Date(scheduleInfo.shift_start), 'h:mm a')}
                  {' – '}
                  {scheduleInfo.shift_end && format(new Date(scheduleInfo.shift_end), 'h:mm a')}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                {scheduleInfo.shift_start && format(new Date(scheduleInfo.shift_start), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-4 pt-4">
        <Button size="lg" variant="outline" onClick={onCancel} className="px-8">
          {t('scheduleCheck.cancel')}
        </Button>
        <Button size="lg" variant="default" onClick={onContinue} className="px-8">
          {t('scheduleCheck.continue')}
        </Button>
      </div>
    </div>
  );
}
