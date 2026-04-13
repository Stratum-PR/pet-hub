import { useState, useEffect, useMemo } from 'react';
import type { Locale } from 'date-fns';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WaitlistEntry, CalendarStaff } from '@/types/calendar';
import { Service } from '@/hooks/useBusinessData';
import { cn } from '@/lib/utils';
import { t } from '@/lib/translations';
import type { ApptBookSidebarFilterMode } from '@/lib/apptBookCalendarPrefs';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';

export type ApptBookWeekJumpOffset = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const WEEK_JUMP_OFFSETS: ApptBookWeekJumpOffset[] = [1, 2, 3, 4, 5, 6, 7, 8];

interface AppointmentBookSidebarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  waitlist: WaitlistEntry[];
  waitlistCollapsed: boolean;
  onWaitlistToggle: () => void;
  onCreateClick?: () => void;
  /** Calendar-only: filter panel below mini calendar */
  showCalendarFilters?: boolean;
  sidebarFilterMode?: ApptBookSidebarFilterMode;
  onSidebarFilterModeChange?: (mode: ApptBookSidebarFilterMode) => void;
  activeServices?: Service[];
  /** null = all services selected */
  selectedServiceIds?: Set<string> | null;
  onToggleServiceId?: (id: string) => void;
  onSelectAllServices?: () => void;
  categorySearch?: string;
  onCategorySearchChange?: (q: string) => void;
  calendarEmployees?: CalendarStaff[];
  selectedEmployeeIds?: Set<string> | null;
  onToggleEmployeeId?: (id: string) => void;
  onSelectAllEmployees?: () => void;
  onClearFilters?: () => void;
  /** Week-jump row (grooming calendar): +1 … +8 weeks from this week. */
  showWeekJumpControls?: boolean;
  weekJumpOffset?: ApptBookWeekJumpOffset | null;
  onWeekJump?: (offset: ApptBookWeekJumpOffset) => void;
  weekJumpNoAvailability?: boolean;
  /** If set, days without bookable hours are not selectable in the mini calendar. */
  isBookableDate?: (date: Date) => boolean;
  /** date-fns locale for month/weekday labels. */
  dateLocale?: Locale;
}

export function AppointmentBookSidebar({
  selectedDate,
  onDateChange,
  onToday,
  waitlist,
  waitlistCollapsed,
  onWaitlistToggle,
  onCreateClick,
  showCalendarFilters = false,
  sidebarFilterMode = 'booking-category',
  onSidebarFilterModeChange,
  activeServices = [],
  selectedServiceIds = null,
  onToggleServiceId,
  onSelectAllServices,
  categorySearch = '',
  onCategorySearchChange,
  calendarEmployees = [],
  selectedEmployeeIds = null,
  onToggleEmployeeId,
  onSelectAllEmployees,
  onClearFilters,
  showWeekJumpControls = false,
  weekJumpOffset = null,
  onWeekJump,
  weekJumpNoAvailability = false,
  isBookableDate,
  dateLocale,
}: AppointmentBookSidebarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDayClick = (day: Date) => {
    onDateChange(day);
  };

  const fmtOpts = dateLocale ? { locale: dateLocale } : undefined;

  const dayAbbreviations = useMemo(() => {
    const sundayRef = new Date(2023, 0, 1);
    return Array.from({ length: 7 }, (_, i) => format(addDays(sundayRef, i), 'EEE', fmtOpts));
  }, [fmtOpts]);

  return (
    <div className="flex h-auto min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-border bg-card sm:h-full sm:min-h-0 sm:w-80">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold mb-3 text-foreground">{t('apptBook.pageTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreateClick}>
            <Plus className="w-4 h-4 mr-1" />
            {t('apptBook.createAppointment')}
          </Button>
          <Button variant="outline" onClick={onToday}>
            {t('appointments.today')}
          </Button>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t('apptBook.calendarSectionHeading')}</h3>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-muted rounded"
            aria-label={t('apptBook.navigatePrevious')}
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium capitalize text-foreground">
            {format(currentMonth, 'LLLL yyyy', fmtOpts)}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-muted rounded"
            aria-label={t('apptBook.navigateNext')}
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Day Abbreviations */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayAbbreviations.map((day, idx) => (
            <div
              key={idx}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, dayIdx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const bookable = isBookableDate ? isBookableDate(day) : true;

            return (
              <button
                key={dayIdx}
                type="button"
                disabled={!bookable}
                title={!bookable ? t('apptBook.noBusinessHoursThisDay') : undefined}
                onClick={() => {
                  if (!bookable) return;
                  handleDayClick(day);
                }}
                className={cn(
                  'h-8 w-8 rounded-full text-sm font-medium transition-colors',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  !bookable && 'cursor-not-allowed opacity-40 line-through decoration-muted-foreground/60',
                  bookable && isCurrentMonth && !isSelected && !isToday && 'text-foreground hover:bg-muted',
                  isToday && !isSelected && bookable && 'bg-muted text-foreground',
                  isSelected && 'bg-primary text-primary-foreground',
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {showWeekJumpControls && onWeekJump ? (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <div className="text-xs font-medium text-muted-foreground">{t('apptBook.weekJumpHeading')}</div>
            <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 text-xs text-muted-foreground">
              <span className="mr-0.5 font-medium text-foreground" aria-hidden>
                +
              </span>
              {WEEK_JUMP_OFFSETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={t('apptBook.weekJumpAria', { count: n })}
                  aria-pressed={weekJumpOffset === n}
                  onClick={() => onWeekJump(n)}
                  className={cn(
                    'min-w-[1.65rem] rounded-md px-1.5 py-1 text-center text-xs font-semibold transition-colors',
                    weekJumpOffset === n
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                {t('apptBook.weekJumpWeeksSuffix')}
              </span>
            </div>
            {weekJumpNoAvailability ? (
              <p className="text-xs text-amber-700 dark:text-amber-400" role="status">
                {t('apptBook.noAvailabilityInWeek')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {showCalendarFilters &&
        onSidebarFilterModeChange &&
        onToggleServiceId &&
        onSelectAllServices &&
        onCategorySearchChange &&
        onToggleEmployeeId &&
        onSelectAllEmployees &&
        onClearFilters && (
          <div className="border-b border-border p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t('apptBook.filterCalendar')}</h3>
            <Tabs
              value={sidebarFilterMode}
              onValueChange={(v) => onSidebarFilterModeChange(v as ApptBookSidebarFilterMode)}
            >
              <TabsList className="mb-3 grid w-full grid-cols-2">
                <TabsTrigger value="specialist" className="text-xs">
                  {t('apptBook.specialist')}
                </TabsTrigger>
                <TabsTrigger value="booking-category" className="text-xs">
                  {t('apptBook.bookingCategory')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {sidebarFilterMode === 'booking-category' ? (
              <>
                <Input
                  value={categorySearch}
                  onChange={(e) => onCategorySearchChange(e.target.value)}
                  placeholder={t('apptBook.searchCategories')}
                  className="mb-2 h-8 text-xs"
                />
                <ScrollArea className="h-[160px] pr-2">
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={
                          !selectedServiceIds || selectedServiceIds.size === activeServices.length
                        }
                        onCheckedChange={() => onSelectAllServices()}
                      />
                      <span>{t('apptBook.allCategories')}</span>
                    </label>
                    {activeServices
                      .filter((s) =>
                        categorySearch.trim()
                          ? s.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
                          : true,
                      )
                      .map((s) => {
                        const all =
                          !selectedServiceIds || selectedServiceIds.size === activeServices.length;
                        const checked = all || (selectedServiceIds?.has(s.id) ?? false);
                        return (
                          <label
                            key={s.id}
                            className="flex cursor-pointer items-center gap-2 text-xs"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => onToggleServiceId(s.id)}
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="h-[200px] pr-2">
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={
                        !selectedEmployeeIds ||
                        selectedEmployeeIds.size === calendarEmployees.length
                      }
                      onCheckedChange={() => onSelectAllEmployees()}
                    />
                    <span>{t('apptBook.allStaff')}</span>
                  </label>
                  {calendarEmployees.map((e) => {
                    const all =
                      !selectedEmployeeIds ||
                      selectedEmployeeIds.size === calendarEmployees.length;
                    const checked = all || (selectedEmployeeIds?.has(e.id) ?? false);
                    return (
                      <label
                        key={e.id}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => onToggleEmployeeId(e.id)}
                        />
                        <span className="truncate">{formatStaffNameAggregated(e.name)}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={onClearFilters}
            >
              {t('apptBook.clearFilters')}
            </Button>
          </div>
        )}

      {/* Waitlist Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <button
          onClick={onWaitlistToggle}
          className="flex items-center justify-between p-4 border-b border-border hover:bg-muted/50"
        >
          <h3 className="text-sm font-semibold text-foreground">
            Waitlist ({waitlist.length})
          </h3>
          {waitlistCollapsed ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {!waitlistCollapsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {waitlist.map((entry) => (
              <div
                key={entry.id}
                className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-2 mb-2">
                  {entry.hasAlert && (
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground">
                        {entry.petName}
                      </span>
                      {entry.breed && (
                        <span className="text-xs text-muted-foreground">
                          ({entry.breed})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{entry.ownerName}</p>
                    <p className="text-xs text-muted-foreground">{entry.ownerPhone}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    {entry.service} - ${entry.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mb-1">
                    with {entry.requestedTime || 'First Available Any Time'}
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Since {format(new Date(entry.dateAdded), 'EEEE, MMM d, yyyy')} {format(new Date(entry.dateAdded), 'M/d/yyyy')}
                  </p>
                </div>
              </div>
            ))}
            {waitlist.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No waitlist entries
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
