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
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';

export type ApptBookWeekJumpOffset = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const WEEK_JUMP_OFFSETS: ApptBookWeekJumpOffset[] = [1, 2, 3, 4, 5, 6, 7, 8];

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
  onOpenRequests?: () => void;
  showWeekJumpControls?: boolean;
  weekJumpOffset?: ApptBookWeekJumpOffset | null;
  onWeekJump?: (offset: ApptBookWeekJumpOffset) => void;
  weekJumpNoAvailability?: boolean;
  isBookableDate?: (date: Date) => boolean;
  dateLocale?: Locale;
  className?: string;
}

export function AppointmentBookSidebar({
  selectedDate,
  onDateChange,
  busyDayKeys,
  daySummary,
  onOpenRequests,
  showWeekJumpControls = false,
  weekJumpOffset = null,
  onWeekJump,
  weekJumpNoAvailability = false,
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
        'flex w-full shrink-0 flex-col gap-4 border-r border-border bg-card p-4 sm:h-full sm:w-72 sm:overflow-y-auto',
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

        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase text-muted-foreground">
          {dayAbbreviations.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const selected = isSameDay(day, selectedDate);
            const today = isSameDay(day, new Date());
            const bookable = isBookableDate ? isBookableDate(day) : true;
            const busy = busyDayKeys?.has(format(day, 'yyyy-MM-dd'));
            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!bookable}
                title={!bookable ? t('apptBook.noBusinessHoursThisDay') : undefined}
                onClick={() => bookable && onDateChange(day)}
                className={cn(
                  'relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                  !inMonth && 'text-muted-foreground/40',
                  !bookable && 'cursor-not-allowed text-muted-foreground/40',
                  bookable && inMonth && !selected && 'text-foreground hover:bg-muted',
                  today && !selected && 'font-semibold text-primary ring-1 ring-primary/40',
                  selected && 'bg-primary font-semibold text-primary-foreground',
                )}
              >
                {format(day, 'd')}
                {busy && !selected ? (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary/70" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {showWeekJumpControls && onWeekJump ? (
        <div className="border-t border-border pt-3">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t('apptBook.jumpAhead')}</div>
          <div className="flex flex-wrap gap-1">
            {WEEK_JUMP_OFFSETS.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t('apptBook.weekJumpAria', { count: n })}
                aria-pressed={weekJumpOffset === n}
                onClick={() => onWeekJump(n)}
                className={cn(
                  'h-7 min-w-7 rounded-md px-1.5 text-xs font-semibold transition-colors',
                  weekJumpOffset === n ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground hover:bg-muted',
                )}
              >
                +{n}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">{t('apptBook.weekJumpWeeksSuffix')}</div>
          {weekJumpNoAvailability ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">
              {t('apptBook.noAvailabilityInWeek')}
            </p>
          ) : null}
        </div>
      ) : null}

      {daySummary ? (
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-medium capitalize text-muted-foreground">
            {format(selectedDate, 'EEEE d MMM', fmtOpts)}
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/50 p-2">
              <dt className="text-[11px] text-muted-foreground">{t('apptBook.summaryAppointments')}</dt>
              <dd className="text-lg font-semibold tabular-nums">{daySummary.appointments}</dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <dt className="text-[11px] text-muted-foreground">{t('apptBook.summaryRevenue')}</dt>
              <dd className="text-lg font-semibold tabular-nums">${daySummary.revenue.toFixed(0)}</dd>
            </div>
          </dl>
          {daySummary.pending > 0 && onOpenRequests ? (
            <button
              type="button"
              onClick={onOpenRequests}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-500/15 dark:text-amber-100"
            >
              <Inbox className="h-4 w-4 shrink-0" />
              {daySummary.pending === 1
                ? t('apptBook.summaryPendingOne')
                : t('apptBook.summaryPending', { count: daySummary.pending })}
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
