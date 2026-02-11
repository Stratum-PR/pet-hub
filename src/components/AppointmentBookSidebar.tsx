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
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold mb-3">Appointment Book</h2>
        <div className="flex gap-2">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium"
            onClick={onCreateClick}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
          <Button
            variant="outline"
            className="border-gray-300 text-gray-700 rounded-md px-4 py-2 text-sm font-medium"
            onClick={onToday}
          >
            TODAY
          </Button>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Calendar</h3>
        </div>
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-900">
            {format(currentMonth, 'MMMM yyyy').toUpperCase()}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Day Abbreviations */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayAbbreviations.map((day, idx) => (
            <div
              key={idx}
              className="text-center text-xs font-medium text-gray-600 py-1"
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
                  !isCurrentMonth && "text-gray-300",
                  isCurrentMonth && !isSelected && !isToday && "text-gray-700 hover:bg-gray-100",
                  isToday && !isSelected && "bg-gray-100 text-gray-900",
                  isSelected && "bg-blue-600 text-white"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Week Navigation Footer */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span>+</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
              <button
                key={week}
                className="px-1 hover:text-blue-600"
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
          className="flex items-center justify-between p-4 border-b border-gray-200 hover:bg-gray-50"
        >
          <h3 className="text-sm font-semibold text-gray-900">
            Waitlist ({waitlist.length})
          </h3>
          {waitlistCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {!waitlistCollapsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {waitlist.map((entry) => (
              <div
                key={entry.id}
                className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-2 mb-2">
                  {entry.hasAlert && (
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">
                        {entry.petName}
                      </span>
                      {entry.breed && (
                        <span className="text-xs text-gray-500">
                          ({entry.breed})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{entry.ownerName}</p>
                    <p className="text-xs text-gray-500">{entry.ownerPhone}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">
                    {entry.service} - ${entry.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    with {entry.requestedTime || 'First Available Any Time'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Since {format(new Date(entry.dateAdded), 'EEEE, MMM d, yyyy')} {format(new Date(entry.dateAdded), 'M/d/yyyy')}
                  </p>
                </div>
              </div>
            ))}
            {waitlist.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No waitlist entries
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
