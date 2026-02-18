import { useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Printer, AlertTriangle, User, MoreVertical, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarAppointment, CalendarEmployee, CalendarFilters, CalendarView } from '@/types/calendar';
import { Pet } from '@/hooks/useBusinessData';
import { Dog, Cat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DaycareCalendarViewProps {
  selectedDate: Date;
  appointments: CalendarAppointment[];
  pets: Pet[];
  filters: CalendarFilters;
  onFilterChange: (key: keyof CalendarFilters, value: string | CalendarView) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onCheckIn?: (appointmentId: string) => void;
  onCreateClick?: () => void;
}

// Mock daycare rooms - in production, this would come from database
const DAYCARE_ROOMS = [
  { id: 'high-energy', name: 'HighEnergy', maxPets: 10 },
  { id: 'senior', name: 'Senior', maxPets: 10 },
  { id: 'puppy', name: 'Puppy', maxPets: 8 },
  { id: 'small-dogs', name: 'Small Dogs', maxPets: 6 },
];

export function DaycareCalendarView({
  selectedDate,
  appointments,
  pets,
  filters,
  onFilterChange,
  onPreviousDay,
  onNextDay,
  onToday,
  onCheckIn,
  onCreateClick,
}: DaycareCalendarViewProps) {
  // Group appointments by room (for now, randomly assign to rooms)
  // In production, this would be based on pet characteristics or appointment type
  const appointmentsByRoom = useMemo(() => {
    const grouped: Record<string, CalendarAppointment[]> = {};
    
    DAYCARE_ROOMS.forEach(room => {
      grouped[room.id] = [];
    });
    
    // Distribute appointments across rooms
    appointments.forEach((apt, index) => {
      const roomIndex = index % DAYCARE_ROOMS.length;
      const room = DAYCARE_ROOMS[roomIndex];
      grouped[room.id].push(apt);
    });
    
    return grouped;
  }, [appointments]);

  const formatDateHeader = (date: Date) => {
    return format(date, 'EEEE MMMM d, yyyy');
  };

  const getPetPhoto = (appointment: CalendarAppointment) => {
    const pet = appointment.petId 
      ? pets.find(p => p.id === appointment.petId)
      : pets.find(p => 
          p.name === appointment.petName && 
          (p.breed === appointment.breed || p.breeds?.name === appointment.breed)
        );
    return pet?.photo_url || null;
  };

  const getPetSpeciesIcon = (appointment: CalendarAppointment) => {
    const pet = appointment.petId 
      ? pets.find(p => p.id === appointment.petId)
      : pets.find(p => 
          p.name === appointment.petName && 
          (p.breed === appointment.breed || p.breeds?.name === appointment.breed)
        );
    if (!pet) return Dog;
    return pet.species === 'cat' ? Cat : Dog;
  };

  const handleCheckIn = (appointmentId: string) => {
    if (onCheckIn) {
      onCheckIn(appointmentId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Controls */}
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Appointment Book</h1>
          <div className="flex items-center gap-3">
            <Button
              onClick={onCreateClick}
            >
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

        {/* Date Navigation and Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onPreviousDay}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <span className="text-base font-medium text-foreground min-w-[200px] text-center">
              {formatDateHeader(selectedDate)}
            </span>
            <button
              onClick={onNextDay}
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={filters.service}
              onValueChange={(value) => onFilterChange('service', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Daycare">Daycare</SelectItem>
                <SelectItem value="All Services">All Services</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.employee || 'All Rooms'}
              onValueChange={(value) => onFilterChange('employee', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Rooms">All Rooms</SelectItem>
                {DAYCARE_ROOMS.map(room => (
                  <SelectItem key={room.id} value={room.name}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.view}
              onValueChange={(value) => onFilterChange('view', value as CalendarView)}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>

            <button className="p-2 hover:bg-muted rounded">
              <Printer className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Daycare Rooms */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {DAYCARE_ROOMS.map((room) => {
            const roomAppointments = appointmentsByRoom[room.id] || [];
            const filteredAppointments = filters.employee === 'All Rooms' || filters.employee === room.name
              ? roomAppointments
              : [];

            return (
              <div key={room.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Daycare - {room.name} ({filteredAppointments.length} pets; {room.maxPets} max)
                  </h3>
                </div>

                {filteredAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No pets scheduled for this room</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredAppointments.map((appointment) => {
                      const petPhoto = getPetPhoto(appointment);
                      const SpeciesIcon = getPetSpeciesIcon(appointment);
                      const hasAlert = appointment.hasAlert || false;

                      return (
                        <div
                          key={appointment.id}
                          className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              {petPhoto ? (
                                <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-border flex-shrink-0">
                                  <img
                                    src={petPhoto}
                                    alt={appointment.petName}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-muted flex items-center justify-center rounded-lg flex-shrink-0">
                                  <SpeciesIcon className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-sm text-foreground truncate">
                                    {appointment.petName}
                                  </span>
                                  {hasAlert && (
                                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                                  )}
                                  <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                                {appointment.breed && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {appointment.breed}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button className="p-1 hover:bg-muted rounded">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Check In {appointment.startTime}
                            </p>
                            <Button
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => handleCheckIn(appointment.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Check In
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
