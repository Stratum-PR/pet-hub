import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
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

  // Get day abbreviations based on locale (for now, using English)
  const dayAbbreviations = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold mb-3 text-foreground">Appointment Book</h2>
        <div className="flex gap-2">
          <Button
            onClick={onCreateClick}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
          <Button
            variant="outline"
            onClick={onToday}
          >
            TODAY
          </Button>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Calendar</h3>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-muted rounded"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {format(currentMonth, 'MMMM yyyy').toUpperCase()}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-muted rounded"
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

            return (
              <button
                key={dayIdx}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "h-8 w-8 rounded-full text-sm font-medium transition-colors",
                  !isCurrentMonth && "text-muted-foreground/50",
                  isCurrentMonth && !isSelected && !isToday && "text-foreground hover:bg-muted",
                  isToday && !isSelected && "bg-muted text-foreground",
                  isSelected && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Week Navigation Footer */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>+</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
              <button
                key={week}
                className="px-1 hover:text-primary"
              >
                {week}
              </button>
            ))}
            <span className="ml-1">Weeks</span>
          </div>
        </div>
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
