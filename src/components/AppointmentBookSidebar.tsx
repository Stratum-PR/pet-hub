import { useEffect, useMemo, useState } from 'react';
import type { Locale } from 'date-fns';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';

export interface ApptBookDaySummary {
  appointments: number;
  pending: number;
  revenue: number;
}

interface AppointmentBookSidebarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  /** yyyy-MM-dd keys of days that have at least one appointment (dot under the day). */
  busyDayKeys?: Set<string>;
  daySummary?: ApptBookDaySummary | null;
  isBookableDate?: (date: Date) => boolean;
  dateLocale?: Locale;
  className?: string;
}

export function AppointmentBookSidebar({
  selectedDate,
  onDateChange,
  busyDayKeys,
  daySummary,
  isBookableDate,
  dateLocale,
  className,
}: AppointmentBookSidebarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });
  const fmtOpts = dateLocale ? { locale: dateLocale } : undefined;
  const dayAbbreviations = useMemo(() => {
    const sundayRef = new Date(2023, 0, 1);
    return Array.from({ length: 7 }, (_, i) => format(addDays(sundayRef, i), 'EEEEE', fmtOpts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateLocale]);

  return (
    <aside
      className={cn(
        'flex w-full shrink-0 flex-col gap-5 border-r border-border bg-card px-4 py-4 sm:h-full sm:w-64 sm:overflow-y-auto',
        className,
      )}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded p-1 hover:bg-muted"
            aria-label={t('apptBook.navigatePrevious')}
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold capitalize text-foreground">{format(currentMonth, 'LLLL yyyy', fmtOpts)}</span>
          <button
            type="button"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded p-1 hover:bg-muted"
            aria-label={t('apptBook.navigateNext')}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase text-muted-foreground">
          {dayAbbreviations.map((d, i) => (
            <div key={i} className="flex h-7 items-center justify-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const selected = isSameDay(day, selectedDate);
            const today = isSameDay(day, new Date());
            const bookable = isBookableDate ? isBookableDate(day) : true;
            const busy = busyDayKeys?.has(format(day, 'yyyy-MM-dd'));
            if (!inMonth) return <div key={day.toISOString()} className="h-8" aria-hidden />;
            return (
              <div key={day.toISOString()} className="flex h-8 items-center justify-center">
                <button
                  type="button"
                  disabled={!bookable}
                  title={!bookable ? t('apptBook.noBusinessHoursThisDay') : undefined}
                  onClick={() => bookable && onDateChange(day)}
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors',
                    !bookable && 'cursor-not-allowed text-muted-foreground/45',
                    bookable && !selected && 'text-foreground hover:bg-muted',
                    today && !selected && 'font-semibold text-primary',
                    selected && 'bg-primary font-semibold text-primary-foreground',
                  )}
                >
                  {format(day, 'd')}
                  {busy && bookable && !selected ? (
                    <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary/60" aria-hidden />
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {daySummary ? (
        <div className="border-t border-border pt-4">
          <div className="text-xs font-medium capitalize text-muted-foreground">{format(selectedDate, 'EEEE d MMM', fmtOpts)}</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-sm text-foreground">
              {t(daySummary.appointments === 1 ? 'apptBook.summaryCountOne' : 'apptBook.summaryCount', {
                count: daySummary.appointments,
              })}
            </span>
            <span className="text-sm font-semibold tabular-nums">${daySummary.revenue.toFixed(0)}</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
