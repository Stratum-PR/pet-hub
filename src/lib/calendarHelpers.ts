import { format, parse, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { CalendarAppointment, CalendarStaff, APPOINTMENT_COLORS } from '@/types/calendar';
import { Appointment, Pet, Service } from '@/hooks/useBusinessData';
import { Employee } from '@/types';
import { staffRecordIdFromRow } from '@/lib/staffRecordCompat';
import { formatStaffNameAggregated } from '@/lib/staffDisplayName';
import { showOnActiveCalendar, isPendingStatus } from '@/lib/appointmentStatus';
import { minutesToHHmm, timeToMinutes } from '@/lib/businessHours';
import { normalizeHHmm, UNASSIGNED_STAFF_ID } from '@/lib/groomerAvailability';
import { t } from '@/lib/translations';

/** Parse calendar day for an appointment row (DATE / ISO string / legacy scheduled_date), in local time. */
export function parseAppointmentDate(apt: Appointment): Date | null {
  try {
    const a = apt as Appointment & { scheduled_date?: string | null };
    if (a.appointment_date) {
      if (typeof a.appointment_date === 'string') {
        // Plain DATE ("2026-10-05") must be parsed as a local day, never via new Date() (UTC midnight).
        const ymd = a.appointment_date.slice(0, 10);
        const d = parse(ymd, 'yyyy-MM-dd', new Date());
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

/** Local calendar day key (yyyy-MM-dd) for an appointment, or null. */
export function appointmentDayKey(apt: Appointment): string | null {
  const d = parseAppointmentDate(apt);
  return d ? format(d, 'yyyy-MM-dd') : null;
}

/** Start "HH:mm" for an appointment (start_time, else the legacy timestamp, else 09:00). */
export function appointmentStartHHmm(apt: Appointment): string {
  const fromCol = normalizeHHmm(apt.start_time);
  if (fromCol) return fromCol;
  const legacy = (apt as Appointment & { scheduled_date?: string | null }).scheduled_date;
  if (legacy) {
    const d = new Date(legacy);
    if (!Number.isNaN(d.getTime())) return format(d, 'HH:mm');
  }
  return '09:00';
}

/** Active staff → calendar columns. */
export function convertEmployeesToCalendar(employees: Employee[]): CalendarStaff[] {
  return employees
    .filter((emp) => emp.status === 'active')
    .map((emp) => ({
      id: emp.id,
      name: emp.name,
      initials: emp.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      offeredServiceIds: emp.offered_service_ids ?? [],
    }));
}

function toCalendarAppointment(
  apt: Appointment,
  pets: Pet[],
  employees: Employee[],
  services: Service[],
  calendarDayKey?: string,
): CalendarAppointment {
  // Rows fetched with joins may already carry the pet/service.
  const joined = apt as Appointment & { pets?: Pet | null; services?: Service | null };
  const pet = (joined.pets || pets.find((p) => p.id === apt.pet_id)) as
    | (Pet & { breeds?: { name?: string } | null; clients?: Pet['clients'] & { phone?: string | null } })
    | undefined;
  const service = joined.services || services.find((s) => s.id === apt.service_id);
  const staffRef = staffRecordIdFromRow(apt) ?? apt.staff_id ?? null;
  const employee = staffRef ? employees.find((e) => e.id === staffRef) : null;

  const serviceIds: string[] =
    Array.isArray(apt.service_ids) && apt.service_ids.length > 0
      ? apt.service_ids
      : apt.service_id
        ? [apt.service_id]
        : [];
  const extraServices = serviceIds
    .slice(1)
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const startTime = appointmentStartHHmm(apt);
  const durationFromService =
    serviceIds.reduce((sum, id) => sum + (services.find((s) => s.id === id)?.duration_minutes ?? 0), 0) ||
    service?.duration_minutes ||
    60;
  let endTime = normalizeHHmm(apt.end_time);
  if (!endTime || timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    endTime = minutesToHHmm(Math.min(timeToMinutes(startTime) + durationFromService, 24 * 60 - 1));
  }
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);

  const petName = pet?.name || t('apptBook.unknownPet');
  const breed = pet?.breed || pet?.breeds?.name || '';
  const petClients = pet?.clients;
  const ownerName = petClients
    ? `${petClients.first_name || ''} ${petClients.last_name || ''}`.trim() || t('apptBook.unknownOwner')
    : t('apptBook.unknownOwner');

  const serviceName = service?.name || apt.service_type || t('apptBook.unknownService');
  const price = Number(apt.total_price ?? apt.price ?? service?.price ?? 0) || 0;

  return {
    id: apt.id,
    calendarDayKey,
    serviceId: apt.service_id,
    serviceIds,
    dbStatus: apt.status,
    isPending: isPendingStatus(apt.status),
    bookingSource: apt.booking_source ?? 'staff',
    petId: apt.pet_id,
    petName,
    breed,
    ownerName,
    ownerPhone: petClients?.phone || '',
    service: extraServices.length ? `${serviceName} + ${extraServices.length}` : serviceName,
    serviceSize: extractServiceSize(serviceName),
    duration,
    startTime,
    endTime,
    color: service?.color || APPOINTMENT_COLORS.blue,
    staffId: employee?.id || staffRef || UNASSIGNED_STAFF_ID,
    staffName: employee?.name ? formatStaffNameAggregated(employee.name) : t('apptBook.unassigned'),
    hasAlert: false,
    notes: apt.notes || undefined,
    price,
  };
}

/** Appointments on one local calendar day, mapped for the day grid. */
export function convertAppointmentsToCalendar(
  appointments: Appointment[],
  pets: Pet[],
  employees: Employee[],
  services: Service[],
  selectedDate: Date,
): CalendarAppointment[] {
  return appointments
    .filter((apt) => showOnActiveCalendar(apt.status))
    .filter((apt) => {
      const d = parseAppointmentDate(apt);
      return !!d && isSameDay(d, selectedDate);
    })
    .map((apt) => toCalendarAppointment(apt, pets, employees, services, format(selectedDate, 'yyyy-MM-dd')));
}

/** Appointments within an inclusive date range (by local calendar day), mapped like the day view. */
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
  return appointments
    .filter((apt) => showOnActiveCalendar(apt.status))
    .map((apt) => ({ apt, d: parseAppointmentDate(apt) }))
    .filter(({ d }) => !!d && d.getTime() >= startMs && d.getTime() <= endMs)
    .map(({ apt, d }) => toCalendarAppointment(apt, pets, employees, services, format(d!, 'yyyy-MM-dd')));
}

/** Extract service size from service name (e.g., "Dog Haircut - Large" -> "Large"). */
function extractServiceSize(serviceName: string): string {
  const sizeMatch = serviceName.match(/\b(Small|Medium|Large|X-Large|XL)\b/i);
  return sizeMatch ? sizeMatch[1] : '';
}
