import { useState, useMemo } from 'react';
import { format, startOfDay, addDays, subDays, isSameDay } from 'date-fns';
import { CalendarAppointment, CalendarEmployee, WaitlistEntry, CalendarFilters, CalendarView } from '@/types/calendar';
import { AppointmentBookSidebar } from '@/components/AppointmentBookSidebar';
import { AppointmentCalendarView } from '@/components/AppointmentCalendarView';
import { DaycareCalendarView } from '@/components/DaycareCalendarView';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { t } from '@/lib/translations';
import { useAppointments, usePets, useServices, useCustomers } from '@/hooks/useBusinessData';
import { useEmployees } from '@/hooks/useSupabaseData';
import { convertAppointmentsToCalendar, convertEmployeesToCalendar } from '@/lib/calendarHelpers';
import { BookingFormDialog } from '@/components/BookingFormDialog';

export function AppointmentBook() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'calendar' | 'list' | 'requests' | 'settings'>('calendar');
  const [filters, setFilters] = useState<CalendarFilters>({
    service: 'Daycare',
    employee: 'All Rooms',
    view: 'day',
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [waitlistCollapsed, setWaitlistCollapsed] = useState(false);

  // Fetch real data
  const { appointments, loading: appointmentsLoading, addAppointment, refetch: refetchAppointments } = useAppointments();
  const { pets, loading: petsLoading } = usePets();
  const { employees, loading: employeesLoading } = useEmployees();
  const { services, loading: servicesLoading } = useServices();
  const { customers } = useCustomers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loading = appointmentsLoading || petsLoading || employeesLoading || servicesLoading;

  // Convert employees to calendar format
  const calendarEmployees = useMemo(() => {
    return convertEmployeesToCalendar(employees);
  }, [employees]);

  // Convert appointments to calendar format
  const calendarAppointments = useMemo(() => {
    if (loading) return [];
    return convertAppointmentsToCalendar(
      appointments,
      pets,
      employees,
      services,
      selectedDate
    );
  }, [appointments, pets, employees, services, selectedDate, loading]);

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    let filtered = calendarAppointments;

    // Filter by service type if specified
    if (filters.service !== 'All Services') {
      filtered = filtered.filter(apt => {
        const serviceName = apt.service.toLowerCase();
        if (filters.service === 'Grooming') {
          return !serviceName.includes('daycare');
        } else if (filters.service === 'Daycare') {
          return serviceName.includes('daycare');
        }
        return true;
      });
    }

    // Filter by employee/room
    if (filters.service === 'Daycare') {
      // For daycare, filter by room if not "All Rooms"
      if (filters.employee !== 'All Rooms') {
        // Room filtering logic would go here when rooms are implemented
      }
    } else {
      // For grooming, filter by employee
      if (filters.employee !== 'All Employees' && filters.employee !== 'All Rooms') {
        const employee = calendarEmployees.find(e => e.name === filters.employee);
        if (employee) {
          filtered = filtered.filter(apt => apt.employeeId === employee.id);
        }
      }
    }

    return filtered;
  }, [calendarAppointments, calendarEmployees, filters]);

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleFilterChange = (key: keyof CalendarFilters, value: string | CalendarView) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      // When switching service type, reset employee filter
      if (key === 'service') {
        if (value === 'Daycare') {
          newFilters.employee = 'All Rooms';
        } else {
          newFilters.employee = 'All Employees';
        }
      }
      return newFilters;
    });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gray-50 -m-6 overflow-hidden">
      {/* Left Sidebar */}
      <AppointmentBookSidebar
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onToday={handleToday}
        waitlist={[]} // TODO: Implement waitlist functionality
        waitlistCollapsed={waitlistCollapsed}
        onWaitlistToggle={() => setWaitlistCollapsed(!waitlistCollapsed)}
        onCreateClick={() => setCreateDialogOpen(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-transparent">
              <TabsTrigger value="calendar" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
                {t('appointments.calendar') || 'Calendar'}
              </TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
                Appointment List
              </TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 relative">
                Online Requests
                <Badge className="ml-2 bg-red-500 text-white text-xs">13</Badge>
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600">
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Calendar View */}
        {activeTab === 'calendar' && (
          <div className="flex-1 overflow-hidden relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filters.service === 'Daycare' ? (
              <DaycareCalendarView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                pets={pets}
                filters={filters}
                onFilterChange={handleFilterChange}
                onPreviousDay={handlePreviousDay}
                onNextDay={handleNextDay}
                onToday={handleToday}
                onCheckIn={(appointmentId) => {
                  // TODO: Implement check-in functionality
                  console.log('Check in:', appointmentId);
                }}
                onCreateClick={() => setCreateDialogOpen(true)}
              />
            ) : (
              <AppointmentCalendarView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                employees={calendarEmployees}
                filters={filters}
                onFilterChange={handleFilterChange}
                onPreviousDay={handlePreviousDay}
                onNextDay={handleNextDay}
                onToday={handleToday}
                onCreateClick={() => setCreateDialogOpen(true)}
              />
            )}
          </div>
        )}

        {/* Other tabs content */}
        {activeTab === 'list' && (
          <div className="flex-1 p-6">
            <p className="text-gray-500">Appointment List view coming soon...</p>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="flex-1 p-6">
            <p className="text-gray-500">Online Requests view coming soon...</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 p-6">
            <p className="text-gray-500">Settings view coming soon...</p>
          </div>
        )}
      </div>

      {/* Create Appointment Dialog */}
      <BookingFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        customers={customers}
        pets={pets}
        services={services}
        appointments={appointments}
        onSuccess={() => {
          refetchAppointments();
          setCreateDialogOpen(false);
        }}
        onAddAppointment={addAppointment}
      />
    </div>
  );
}
