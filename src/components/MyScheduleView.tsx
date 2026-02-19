import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { t } from '@/lib/translations';
import type { EmployeeShift, Employee } from '@/types';

interface MyScheduleViewProps {
  shifts: EmployeeShift[];
  employees: Employee[];
  weekStart: Date;
  onWeekChange: (start: Date) => void;
}

export function MyScheduleView({ shifts, employees, weekStart, onWeekChange }: MyScheduleViewProps) {
  const weekEnd = endOfWeek(weekStart);

  const sortedShifts = [...shifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('schedule.myScheduleTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('schedule.myScheduleDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('schedule.yourShifts')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedShifts.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('schedule.noShiftsScheduled')}</p>
          ) : (
            <ul className="space-y-3">
              {sortedShifts.map((shift) => {
                const start = new Date(shift.start_time);
                const end = new Date(shift.end_time);
                return (
                  <li
                    key={shift.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                  >
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{format(start, 'EEEE, MMM d')}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                        {shift.notes && ` · ${shift.notes}`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
