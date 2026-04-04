import { format, parse, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { CalendarAppointment, CalendarStaff, APPOINTMENT_COLORS } from '@/types/calendar';
import { Appointment, Pet, Service } from '@/hooks/useBusinessData';
import { Employee } from '@/types';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';
import { showOnActiveCalendar } from '@/lib/appointmentStatus';

/** Parse calendar day for an appointment row (DATE / ISO string / legacy scheduled_date). */
export function parseAppointmentDate(apt: Appointment): Date | null {
  try {
    const a = apt as Appointment & { scheduled_date?: string | null };
    if (a.appointment_date) {
      if (typeof a.appointment_date === 'string') {
        if (a.appointment_date.includes('T')) {
          const d = new Date(a.appointment_date);
          return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = parse(a.appointment_date, 'yyyy-MM-dd', new Date());
        return Number.isNaN(d.getTime()) ? null : d;
      }
      const raw = a.appointment_date as unknown as Date;
      if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
    }
    if (a.scheduled_date) {
      const d = new Date(a.scheduled_date);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Convert database employees to calendar employees
 */
export function convertEmployeesToCalendar(employees: Employee[]): CalendarStaff[] {
  return employees
    .filter(emp => emp.status === 'active')
    .map(emp => ({
      id: emp.id,
      name: emp.name,
      initials: emp.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    }));
}

/**
 * Convert database appointments to calendar appointments
 */
export function convertAppointmentsToCalendar(
  appointments: Appointment[],
  pets: Pet[],
  employees: Employee[],
  services: Service[],
  selectedDate: Date
): CalendarAppointment[] {
  const filtered = appointments
    .filter((apt) => showOnActiveCalendar(apt.status))
    .filter(apt => {
      // Filter by date - handle both DATE type and string formats
      try {
        let aptDate: Date | null = null;
        
        if (apt.appointment_date) {
          // Handle DATE type (from database) or string
          if (typeof apt.appointment_date === 'string') {
            // If it's a string, parse it
            if (apt.appointment_date.includes('T')) {
              aptDate = new Date(apt.appointment_date);
            } else {
              aptDate = parse(apt.appointment_date, 'yyyy-MM-dd', new Date());
            }
          } else {
            // If it's already a Date object
            aptDate = apt.appointment_date as any;
          }
        } else if ((apt as any).scheduled_date) {
          aptDate = new Date((apt as any).scheduled_date);
        }
        
        if (!aptDate || isNaN(aptDate.getTime())) {
          return false;
        }
        return isSameDay(aptDate, selectedDate);
      } catch {
        return false;
      }
    });
  
  return filtered
    .map(apt => {
      // Use joined data from appointments if available, otherwise fallback to separate lookups
      const aptAny = apt as any;
      const pet = aptAny.pets || pets.find(p => p.id === apt.pet_id);
      const service = aptAny.services || services.find(s => s.id === apt.service_id);
      const staffRef = staffRecordIdFromRow(apt) ?? apt.staff_id;
      const employee = staffRef ? employees.find((e) => e.id === staffRef) : null;
      
      // Get service color or default
      const serviceColor = (service as any)?.color || APPOINTMENT_COLORS.blue;
      
      // Parse time - handle TIME type or string
      let startTime = '09:00';
      if (apt.start_time) {
        if (typeof apt.start_time === 'string') {
          startTime = apt.start_time.includes(':') ? apt.start_time.split(':').slice(0, 2).join(':') : '09:00';
        } else {
          // TIME type from database
          startTime = String(apt.start_time).split(':').slice(0, 2).join(':');
        }
      }
      
      let endTime = apt.end_time;
      if (!endTime) {
        const duration = (service as any)?.duration_minutes || service?.duration_minutes || 60;
        const [hours, minutes] = startTime.split(':').map(Number);
        const endMinutes = minutes + duration;
        const endHours = hours + Math.floor(endMinutes / 60);
        const finalMinutes = endMinutes % 60;
        endTime = `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
      } else if (typeof endTime !== 'string') {
        endTime = String(endTime).split(':').slice(0, 2).join(':');
      }

      // Get pet info from joined data or lookup
      const petName = pet?.name || aptAny.pets?.name || 'Unknown Pet';
      const breed = pet?.breed || pet?.breeds?.name || aptAny.pets?.breed || '';
      const petPhoto = pet?.photo_url || aptAny.pets?.photo_url || null;
      
      // Get owner info from joined pet data
      const petClients = pet?.clients || aptAny.pets?.clients;
      const ownerName = petClients
        ? `${petClients.first_name || ''} ${petClients.last_name || ''}`.trim() || 'Unknown Owner'
        : 'Unknown Owner';
      const ownerPhone = petClients?.phone || '';

      return {
        id: apt.id,
        serviceId: apt.service_id,
        dbStatus: apt.status,
        petId: apt.pet_id,
        petName,
        breed,
        ownerName,
        ownerPhone,
        service: (service as any)?.name || service?.name || apt.service_type || 'Unknown Service',
        serviceSize: extractServiceSize((service as any)?.name || service?.name || apt.service_type || ''),
        duration: (service as any)?.duration_minutes || service?.duration_minutes || 60,
        startTime,
        endTime: endTime as string,
        color: serviceColor,
        staffId: employee?.id || staffRef || '',
        staffName: employee?.name || 'Unassigned',
        hasAlert: false,
        notes: apt.notes || undefined,
        price: apt.total_price || (apt as any).price || (service as any)?.price || service?.price || 0,
      };
    });
}

/**
 * Appointments within an inclusive date range (by local calendar day), mapped like the day view.
 */
export function convertAppointmentsToCalendarInRange(
  appointments: Appointment[],
  pets: Pet[],
  employees: Employee[],
  services: Service[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarAppointment[] {
  const startMs = startOfDay(rangeStart).getTime();
  const endMs = endOfDay(rangeEnd).getTime();

  const filtered = appointments
    .filter((apt) => showOnActiveCalendar(apt.status))
    .filter((apt) => {
      const aptDate = parseAppointmentDate(apt);
      if (!aptDate) return false;
      const t = aptDate.getTime();
      return t >= startMs && t <= endMs;
    });

  return filtered.map((apt) => {
    const aptAny = apt as any;
    const aptDate = parseAppointmentDate(apt)!;
    const calendarDayKey = format(aptDate, 'yyyy-MM-dd');
    const pet = aptAny.pets || pets.find((p) => p.id === apt.pet_id);
    const service = aptAny.services || services.find((s) => s.id === apt.service_id);
    const staffRef = staffRecordIdFromRow(apt) ?? apt.staff_id;
    const employee = staffRef ? employees.find((e) => e.id === staffRef) : null;
    const serviceColor = (service as any)?.color || APPOINTMENT_COLORS.blue;

    let startTime = '09:00';
    if (apt.start_time) {
      if (typeof apt.start_time === 'string') {
        startTime = apt.start_time.includes(':') ? apt.start_time.split(':').slice(0, 2).join(':') : '09:00';
      } else {
        startTime = String(apt.start_time).split(':').slice(0, 2).join(':');
      }
    }

    let endTime = apt.end_time;
    if (!endTime) {
      const duration = (service as any)?.duration_minutes || service?.duration_minutes || 60;
      const [hours, minutes] = startTime.split(':').map(Number);
      const endMinutes = minutes + duration;
      const endHours = hours + Math.floor(endMinutes / 60);
      const finalMinutes = endMinutes % 60;
      endTime = `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    } else if (typeof endTime !== 'string') {
      endTime = String(endTime).split(':').slice(0, 2).join(':');
    }

    const petName = pet?.name || aptAny.pets?.name || 'Unknown Pet';
    const breed = pet?.breed || pet?.breeds?.name || aptAny.pets?.breed || '';
    const petClients = pet?.clients || aptAny.pets?.clients;
    const ownerName = petClients
      ? `${petClients.first_name || ''} ${petClients.last_name || ''}`.trim() || 'Unknown Owner'
      : 'Unknown Owner';
    const ownerPhone = petClients?.phone || '';

    return {
      id: apt.id,
      calendarDayKey,
      serviceId: apt.service_id,
      dbStatus: apt.status,
      petId: apt.pet_id,
      petName,
      breed,
      ownerName,
      ownerPhone,
      service: (service as any)?.name || service?.name || apt.service_type || 'Unknown Service',
      serviceSize: extractServiceSize(
        (service as any)?.name || service?.name || apt.service_type || '',
      ),
      duration: (service as any)?.duration_minutes || service?.duration_minutes || 60,
      startTime,
      endTime: endTime as string,
      color: serviceColor,
      staffId: employee?.id || staffRef || '',
      staffName: employee?.name || 'Unassigned',
      hasAlert: false,
      notes: apt.notes || undefined,
      price: apt.total_price || (apt as any).price || (service as any)?.price || service?.price || 0,
    };
  });
}

/**
 * Extract service size from service name (e.g., "Dog Haircut - Large" -> "Large")
 */
function extractServiceSize(serviceName: string): string {
  const sizeMatch = serviceName.match(/\b(Small|Medium|Large|X-Large|XL)\b/i);
  return sizeMatch ? sizeMatch[1] : '';
}
