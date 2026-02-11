import { format, parse, isSameDay } from 'date-fns';
import { CalendarAppointment, CalendarEmployee, APPOINTMENT_COLORS } from '@/types/calendar';
import { Appointment, Pet, Service } from '@/hooks/useBusinessData';
import { Employee } from '@/types';

/**
 * Convert database employees to calendar employees
 */
export function convertEmployeesToCalendar(employees: Employee[]): CalendarEmployee[] {
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
  console.log('[convertAppointmentsToCalendar] Processing', appointments.length, 'appointments for date', format(selectedDate, 'yyyy-MM-dd'));
  
  const filtered = appointments
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
        } else if (apt.scheduled_date) {
          aptDate = new Date(apt.scheduled_date);
        }
        
        if (!aptDate || isNaN(aptDate.getTime())) {
          console.warn('[convertAppointmentsToCalendar] Invalid date for appointment', apt.id, apt.appointment_date);
          return false;
        }
        const matches = isSameDay(aptDate, selectedDate);
        if (matches) {
          console.log('[convertAppointmentsToCalendar] Found matching appointment', apt.id, 'on', format(aptDate, 'yyyy-MM-dd'));
        }
        return matches;
      } catch (err) {
        console.warn('[convertAppointmentsToCalendar] Error parsing appointment date:', apt.id, err);
        return false;
      }
    });
  
  console.log('[convertAppointmentsToCalendar] Filtered to', filtered.length, 'appointments for selected date');
  
  return filtered
    .map(apt => {
      // Use joined data from appointments if available, otherwise fallback to separate lookups
      const aptAny = apt as any;
      const pet = aptAny.pets || pets.find(p => p.id === apt.pet_id);
      const service = aptAny.services || services.find(s => s.id === apt.service_id);
      const employee = apt.employee_id ? employees.find(e => e.id === apt.employee_id) : null;
      
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
        employeeId: employee?.id || apt.employee_id || '',
        employeeName: employee?.name || 'Unassigned',
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
