import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarAppointment, WaitlistEntry } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface AppointmentBookSidebarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  waitlist: WaitlistEntry[];
  waitlistCollapsed: boolean;
  onWaitlistToggle: () => void;
  onCreateClick?: () => void;
}

export function AppointmentBookSidebar({
  selectedDate,
  onDateChange,
  onToday,
  waitlist,
  waitlistCollapsed,
  onWaitlistToggle,
  onCreateClick,
}: AppointmentBookSidebarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

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
