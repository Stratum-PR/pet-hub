import { timeToMinutes, minutesToHHmm } from '@/lib/businessHours';
import { isTerminalAppointmentStatus } from '@/lib/appointmentStatus';
import type { Service } from '@/hooks/useBusinessData';

export type DayAppointmentRow = {
  staff_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  service_id?: string | null;
  status?: string | null;
  services?: { duration_minutes?: number | null } | null;
};

function normalizeHHMM(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw);
  return s.includes(':') ? s.split(':').slice(0, 2).join(':') : s;
}

/** End minute (exclusive upper bound for overlap) for an existing row. */
export function appointmentBlockEndMinutes(
  row: DayAppointmentRow,
  serviceById: Map<string, Service>,
): { staffId: string | null; start: number; end: number } | null {
  if (isTerminalAppointmentStatus(row.status)) return null;

  const startStr = normalizeHHMM(row.start_time);
  if (!startStr) return null;
  const start = timeToMinutes(startStr);

  let endStr = normalizeHHMM(row.end_time ?? undefined);
  let end: number;
  if (endStr) {
    end = timeToMinutes(endStr);
    if (end <= start) end = start + 60;
  } else {
    let dur = 60;
    if (row.service_id && serviceById.has(row.service_id)) {
      dur = serviceById.get(row.service_id)!.duration_minutes || 60;
    } else if (row.services?.duration_minutes != null) {
      dur = Number(row.services.duration_minutes) || 60;
    }
    end = start + dur;
  }

  const staffId = row.staff_id ? String(row.staff_id) : null;
  return { staffId, start, end };
}

export function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

/**
 * True if [slotStart, slotStart + bookingDuration) does not overlap this staff's busy blocks.
 * Rows with null `staffId` (unassigned) block every staff member.
 */
export function slotFreeForStaff(
  slotStartMin: number,
  bookingDurationMin: number,
  staffId: string,
  blocks: { staffId: string | null; start: number; end: number }[],
): boolean {
  const slotEnd = slotStartMin + bookingDurationMin;
  for (const b of blocks) {
    if (b.staffId !== null && b.staffId !== staffId) continue;
    if (intervalsOverlap(slotStartMin, slotEnd, b.start, b.end)) return false;
  }
  return true;
}

/** Anyone: at least one active staff member is free for the whole block. */
export function slotFreeForAnyone(
  slotStartMin: number,
  bookingDurationMin: number,
  activeStaffIds: string[],
  blocks: { staffId: string | null; start: number; end: number }[],
): boolean {
  if (activeStaffIds.length === 0) return true;
  return activeStaffIds.some((id) => slotFreeForStaff(slotStartMin, bookingDurationMin, id, blocks));
}

export function slotLabelHHmm(slotStartMin: number): string {
  return minutesToHHmm(slotStartMin);
}
