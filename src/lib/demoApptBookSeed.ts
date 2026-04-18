import { addDays, format } from 'date-fns';
import type { Appointment } from '@/hooks/useBusinessData';

/** Synthetic rows merged in `useAppointments` for the public demo workspace (not persisted). */
export const DEMO_APPT_BOOK_SEED_PREFIX = 'demo-appt-book-seed-';

function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function clock(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function endFromStart(start: string, durationMinutes: number): string {
  const [hs, ms] = start.split(':').map((x) => parseInt(x, 10));
  const startM = hs * 60 + (ms || 0) + durationMinutes;
  const eh = Math.floor(startM / 60) % 24;
  const em = startM % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
}

type PetRow = { id: string; client_id: string };
type SvcRow = { id: string; duration_minutes: number | null; price: number | null };

type SeedSlot = {
  suffix: string;
  dayOffset: number;
  hour: number;
  minute: number;
  petIndex: number;
  serviceIndex: number;
  staffIndex: number;
  status: Appointment['status'];
  notes: string | null;
};

const SLOTS: SeedSlot[] = [
  { suffix: '1', dayOffset: 0, hour: 9, minute: 0, petIndex: 0, serviceIndex: 0, staffIndex: 0, status: 'confirmed', notes: 'Demo — baño' },
  { suffix: '2', dayOffset: 0, hour: 10, minute: 30, petIndex: 1, serviceIndex: 1, staffIndex: 1, status: 'scheduled', notes: 'Demo — arreglo' },
  { suffix: '3', dayOffset: 0, hour: 13, minute: 0, petIndex: 2, serviceIndex: 0, staffIndex: 0, status: 'in_progress', notes: 'Demo — en proceso' },
  { suffix: '4', dayOffset: 0, hour: 15, minute: 30, petIndex: 3, serviceIndex: 2, staffIndex: 2, status: 'scheduled', notes: 'Demo — uñas' },
  { suffix: '5', dayOffset: 1, hour: 9, minute: 30, petIndex: 4, serviceIndex: 1, staffIndex: 1, status: 'confirmed', notes: 'Demo — mañana' },
  { suffix: '6', dayOffset: 1, hour: 11, minute: 0, petIndex: 0, serviceIndex: 2, staffIndex: 0, status: 'scheduled', notes: null },
  { suffix: '7', dayOffset: 2, hour: 10, minute: 0, petIndex: 1, serviceIndex: 0, staffIndex: 2, status: 'completed', notes: 'Demo — completada' },
  { suffix: '8', dayOffset: 3, hour: 14, minute: 0, petIndex: 2, serviceIndex: 1, staffIndex: 1, status: 'scheduled', notes: 'Demo — esta semana' },
];

/**
 * Build in-memory appointments for Reservar cita (calendar + list) on the demo workspace.
 * Uses real pet / client / service / staff ids from the tenant so joins and labels resolve.
 */
export function buildDemoApptBookSeedAppointments(params: {
  businessId: string;
  pets: PetRow[];
  services: SvcRow[];
  staffIds: string[];
}): (Appointment & { staff_id?: string | null })[] {
  const { businessId, pets, services, staffIds } = params;
  if (pets.length === 0 || services.length === 0) return [];

  const today = new Date();
  const now = new Date().toISOString();
  const staffPick = (i: number) =>
    staffIds.length > 0 ? staffIds[i % staffIds.length]! : null;

  const rows: (Appointment & { staff_id?: string | null })[] = [];

  for (const slot of SLOTS) {
    const pet = pets[slot.petIndex % pets.length];
    const svc = services[slot.serviceIndex % services.length];
    if (!pet?.id || !pet.client_id || !svc?.id) continue;

    const day = addDays(today, slot.dayOffset);
    const appointment_date = ymd(day);
    const start_time = clock(slot.hour, slot.minute);
    const duration = Math.max(15, svc.duration_minutes ?? 60);
    const end_time = endFromStart(start_time, duration);
    const price = svc.price != null ? Number(svc.price) : null;

    rows.push({
      id: `${DEMO_APPT_BOOK_SEED_PREFIX}${slot.suffix}`,
      business_id: businessId,
      client_id: pet.client_id,
      pet_id: pet.id,
      service_id: svc.id,
      appointment_date,
      start_time,
      end_time,
      status: slot.status,
      notes: slot.notes,
      total_price: price,
      created_at: now,
      updated_at: now,
      staff_id: staffPick(slot.staffIndex),
    });
  }

  return rows;
}

export function stripDemoApptBookSeedRows<T extends { id: string }>(rows: T[]): T[] {
  return rows.filter((r) => !r.id.startsWith(DEMO_APPT_BOOK_SEED_PREFIX));
}
