import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Printer, Bell, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarAppointment, CalendarEmployee, CalendarFilters, CalendarView } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface AppointmentCalendarViewProps {
  selectedDate: Date;
  appointments: CalendarAppointment[];
  employees: CalendarEmployee[];
  filters: CalendarFilters;
  onFilterChange: (key: keyof CalendarFilters, value: string | CalendarView) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onCreateClick?: () => void;
}

// Generate time slots from 7 AM to 8 PM
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 7; hour <= 20; hour++) {
    slots.push({
      hour,
      label: hour === 12 ? '12PM' : hour < 12 ? `${hour}AM` : `${hour - 12}PM`,
      time: `${hour.toString().padStart(2, '0')}:00`,
    });
  }
  return slots;
};

// Convert time string (HH:mm) to minutes since midnight
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Calculate position and height for appointment card
const calculateAppointmentPosition = (startTime: string, endTime: string, startHour: number = 7) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const startHourMinutes = startHour * 60;
  
  const top = ((startMinutes - startHourMinutes) / 60) * 80; // 80px per hour
  const height = ((endMinutes - startMinutes) / 60) * 80;
  
  return { top, height };
};

export function AppointmentCalendarView({
  selectedDate,
  appointments,
  employees,
  filters,
  onFilterChange,
  onPreviousDay,
  onNextDay,
  onToday,
  onCreateClick,
}: AppointmentCalendarViewProps) {
  const timeSlots = useMemo(() => generateTimeSlots(), []);

  // Group appointments by employee
  const appointmentsByEmployee = useMemo(() => {
    const grouped: Record<string, CalendarAppointment[]> = {};
    employees.forEach(emp => {
      grouped[emp.id] = appointments.filter(apt => apt.employeeId === emp.id);
    });
    return grouped;
  }, [appointments, employees]);

  const formatDateHeader = (date: Date) => {
    return format(date, 'EEEE MMMM d, yyyy');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Controls */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">Appointment Book</h1>
          <div className="flex items-center gap-3">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium"
              onClick={onCreateClick}
            >
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

        {/* Date Navigation and Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onPreviousDay}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-base font-medium text-gray-900 min-w-[200px] text-center">
              {formatDateHeader(selectedDate)}
            </span>
            <button
              onClick={onNextDay}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={filters.service}
              onValueChange={(value) => onFilterChange('service', value)}
            >
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Grooming">Grooming</SelectItem>
                <SelectItem value="Daycare">Daycare</SelectItem>
                <SelectItem value="All Services">All Services</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.employee || 'All Employees'}
              onValueChange={(value) => onFilterChange('employee', value)}
            >
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Employees">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.name}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.view}
              onValueChange={(value) => onFilterChange('view', value as CalendarView)}
            >
              <SelectTrigger className="w-[100px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>

            <button className="p-2 hover:bg-gray-200 rounded">
              <Printer className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative min-h-full">
          {/* Grid Container */}
          <div 
            className="grid sticky top-0 bg-white z-10 border-b border-gray-200"
            style={{ gridTemplateColumns: `80px repeat(${employees.length}, 1fr)` }}
          >
            {/* Time Column Header */}
            <div className="border-r border-gray-200 bg-gray-50"></div>
            
            {/* Employee Column Headers */}
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="border-r border-gray-200 bg-gray-50 px-4 py-3 text-center"
              >
                <span className="text-sm font-semibold text-gray-900">{employee.name}</span>
              </div>
            ))}
          </div>

          {/* Time Slots and Appointments */}
          <div className="relative" style={{ minHeight: `${timeSlots.length * 80}px` }}>
            {/* Time Labels */}
            <div className="absolute left-0 top-0 w-20 border-r border-gray-200 bg-white">
              {timeSlots.map((slot, idx) => (
                <div
                  key={slot.hour}
                  className="h-20 border-b border-gray-100 flex items-start justify-end pr-3 pt-1"
                >
                  <span className="text-xs text-gray-600">{slot.label}</span>
                </div>
              ))}
            </div>

            {/* Employee Columns */}
            <div
              className="ml-20 grid relative"
              style={{ gridTemplateColumns: `repeat(${employees.length}, 1fr)` }}
            >
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="border-r border-gray-200 relative"
                >
                  {/* Time Slot Grid Lines */}
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.hour}
                      className="h-20 border-b border-gray-100"
                    />
                  ))}

                  {/* Appointments */}
                  {appointmentsByEmployee[employee.id]?.map((appointment) => {
                    const position = calculateAppointmentPosition(
                      appointment.startTime,
                      appointment.endTime,
                      7
                    );

                    return (
                      <div
                        key={appointment.id}
                        className="absolute left-1 right-1 rounded-md p-2 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                        style={{
                          top: `${position.top}px`,
                          height: `${position.height}px`,
                          backgroundColor: appointment.color,
                          minHeight: '60px',
                        }}
                      >
                        <div className="flex items-start gap-1 mb-1">
                          <PawPrint className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
                          {appointment.hasAlert && (
                            <Bell className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-gray-900 mb-0.5">
                          {appointment.petName}
                          {appointment.breed && (
                            <span className="font-normal"> ({appointment.breed})</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 italic mb-0.5">
                          {appointment.ownerName}
                        </div>
                        <div className="text-xs text-gray-600">
                          {appointment.service}
                          {appointment.serviceSize && ` - ${appointment.serviceSize}`}
                          {appointment.duration && ` - ${appointment.duration} Min`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {appointment.startTime} - {appointment.endTime}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
