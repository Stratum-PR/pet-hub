/**
 * Groomer-aware scheduling rules shared by the appointment book, the booking dialog
 * and the public booking page. Pure functions only (no React, no Supabase) so they
 * can be unit-tested.
 *
 * Rules
 * - A groomer works the hours of their shifts that day (from `staff_shifts`).
 * - If the business has not entered ANY shift that week, every groomer is assumed to
 *   work the business hours (small shops that don't use the Horario page keep working).
 * - Shift hours are clipped to business hours; a closed business day has no hours.
 * - An appointment assigned to a groomer blocks only that groomer.
 * - An unassigned appointment (legacy or online request without a preference) does not
 *   block a specific groomer, but it consumes one groomer of capacity for that time.
 */
import { format } from 'date-fns';
import {
  coerceDayClosedFlag,
  DEFAULT_DAY_HOURS,
  minutesToHHmm,
  timeToMinutes,
  type DayHours,
} from '@/lib/businessHours';

export interface Interval {
  start: number;
  end: number;
}

export interface ShiftLike {
  staff_id: string;
  /** ISO timestamp */
  start_time: string;
  /** ISO timestamp */
  end_time: string;
}

export interface BusyBlock extends Interval {
  /** null = unassigned */
  staffId: string | null;
  appointmentId?: string;
}

export interface StaffServiceRate {
  staff_id: string;
  service_id: string;
  price: number | null;
  duration_minutes: number | null;
}

export interface ServiceLike {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface StaffLike {
  id: string;
  status?: string | null;
  offered_service_ids?: string[] | null;
}

export const UNASSIGNED_STAFF_ID = '__unassigned__';

/** "HH:mm" or "HH:mm:ss" from the DB → "HH:mm". Empty when missing or malformed. */
export function normalizeHHmm(raw: string | null | undefined): string {
  if (!raw) return '';
  const parts = String(raw).trim().split(':');
  if (parts.length < 2) return '';
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "14:30" → "2:30 PM" */
export function formatTime12h(hhmm: string): string {
  const n = normalizeHHmm(hhmm);
  if (!n) return hhmm;
  const [h, m] = n.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Merge touching/overlapping intervals, sorted by start. */
export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out.at(-1);
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function businessWindowForDay(day: DayHours | undefined | null): Interval | null {
  if (!day || coerceDayClosedFlag(day.closed)) return null;
  const start = timeToMinutes(day.open ?? DEFAULT_DAY_HOURS.open);
  const end = timeToMinutes(day.close ?? DEFAULT_DAY_HOURS.close);
  return end > start ? { start, end } : null;
}

/** The part of each shift that falls on the given local calendar day, in minutes since midnight. */
export function shiftWindowsForDay(shifts: ShiftLike[], staffId: string, day: Date): Interval[] {
  const dayKey = format(day, 'yyyy-MM-dd');
  const out: Interval[] = [];
  for (const s of shifts) {
    if (s.staff_id !== staffId) continue;
    const st = new Date(s.start_time);
    const en = new Date(s.end_time);
    if (Number.isNaN(st.getTime()) || Number.isNaN(en.getTime()) || en <= st) continue;
    const startKey = format(st, 'yyyy-MM-dd');
    const endKey = format(en, 'yyyy-MM-dd');
    if (startKey > dayKey || endKey < dayKey) continue;
    const start = startKey < dayKey ? 0 : st.getHours() * 60 + st.getMinutes();
    const end = endKey > dayKey ? 24 * 60 : en.getHours() * 60 + en.getMinutes();
    if (end > start) out.push({ start, end });
  }
  return mergeIntervals(out);
}

/** True when the business entered at least one shift (for anyone) inside [rangeStart, rangeEnd]. */
export function businessUsesShifts(shifts: ShiftLike[], rangeStart: Date, rangeEnd: Date): boolean {
  const a = rangeStart.getTime();
  const b = rangeEnd.getTime();
  return shifts.some((s) => {
    const st = new Date(s.start_time).getTime();
    const en = new Date(s.end_time).getTime();
    return st < b && en > a;
  });
}

/** Hours the groomer can take appointments on this day. */
export function workingWindows(opts: {
  staffId: string;
  day: Date;
  dayHours: DayHours | undefined | null;
  shifts: ShiftLike[];
  usesShifts: boolean;
}): Interval[] {
  const business = businessWindowForDay(opts.dayHours);
  if (!business) return [];
  if (!opts.usesShifts) return [business];
  return shiftWindowsForDay(opts.shifts, opts.staffId, opts.day)
    .map((w) => intersect(w, business))
    .filter((w): w is Interval => !!w);
}

export function totalMinutes(list: Interval[]): number {
  return list.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** Empty `offered_service_ids` means "no restriction" (existing app convention). */
export function staffOffersAll(staff: StaffLike, serviceIds: string[]): boolean {
  if (staff.status && staff.status !== 'active') return false;
  const offered = staff.offered_service_ids ?? [];
  if (offered.length === 0 || serviceIds.length === 0) return true;
  const set = new Set(offered);
  return serviceIds.every((id) => set.has(id));
}

/** Total price and duration of the selected services for a groomer (overrides first, then the service default). */
export function quoteForStaff(
  serviceIds: string[],
  services: ServiceLike[],
  rates: StaffServiceRate[],
  staffId: string | null,
): { price: number; duration: number } {
  let price = 0;
  let duration = 0;
  for (const id of serviceIds) {
    const svc = services.find((s) => s.id === id);
    if (!svc) continue;
    const rate = staffId ? rates.find((r) => r.staff_id === staffId && r.service_id === id) : undefined;
    price += Number(rate?.price ?? svc.price ?? 0);
    duration += Number(rate?.duration_minutes ?? svc.duration_minutes ?? 60) || 60;
  }
  return { price: Math.round(price * 100) / 100, duration };
}

/** Price range across groomers for one service, e.g. to show "$40–$55". */
export function priceRangeForService(
  service: ServiceLike,
  staffIds: string[],
  rates: StaffServiceRate[],
): { min: number; max: number } {
  const prices = staffIds.length
    ? staffIds.map((sid) => Number(rates.find((r) => r.staff_id === sid && r.service_id === service.id)?.price ?? service.price))
    : [Number(service.price)];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function staffIsFree(slot: Interval, staffId: string, blocks: BusyBlock[]): boolean {
  return !blocks.some((b) => b.staffId === staffId && overlaps(slot, b));
}

function fitsInWindows(slot: Interval, windows: Interval[]): boolean {
  return windows.some((w) => slot.start >= w.start && slot.end <= w.end);
}

/**
 * True when `staffId` can take [start, start+duration):
 * inside their working hours, no own appointment overlapping, and enough groomers left over
 * to cover unassigned bookings at that time.
 */
export function canStaffTake(opts: {
  staffId: string;
  start: number;
  duration: number;
  windowsByStaff: Record<string, Interval[]>;
  blocks: BusyBlock[];
}): boolean {
  const slot = { start: opts.start, end: opts.start + opts.duration };
  const own = opts.windowsByStaff[opts.staffId] ?? [];
  if (!fitsInWindows(slot, own) || !staffIsFree(slot, opts.staffId, opts.blocks)) return false;
  const unassigned = opts.blocks.filter((b) => b.staffId === null && overlaps(slot, b)).length;
  if (unassigned === 0) return true;
  const freeOthers = Object.keys(opts.windowsByStaff).filter(
    (sid) =>
      sid !== opts.staffId &&
      fitsInWindows(slot, opts.windowsByStaff[sid] ?? []) &&
      staffIsFree(slot, sid, opts.blocks),
  ).length;
  return freeOthers >= unassigned;
}

/** Start times (HH:mm, every `step` minutes) when this groomer can take a booking of `duration` minutes. */
export function freeStartsForStaff(opts: {
  staffId: string;
  duration: number;
  windowsByStaff: Record<string, Interval[]>;
  blocks: BusyBlock[];
  step?: number;
}): string[] {
  const step = opts.step ?? 30;
  const own = opts.windowsByStaff[opts.staffId] ?? [];
  const out: string[] = [];
  for (const w of own) {
    const first = Math.ceil(w.start / step) * step;
    for (let m = first; m + opts.duration <= w.end; m += step) {
      if (canStaffTake({ ...opts, start: m })) out.push(minutesToHHmm(m));
    }
  }
  return [...new Set(out)].sort();
}

/** Start times when at least one of `staffIds` can take the booking. */
export function freeStartsForAnyone(opts: {
  staffIds: string[];
  duration: number;
  windowsByStaff: Record<string, Interval[]>;
  blocks: BusyBlock[];
  step?: number;
}): string[] {
  const all = new Set<string>();
  for (const staffId of opts.staffIds) {
    for (const t of freeStartsForStaff({ ...opts, staffId })) all.add(t);
  }
  return [...all].sort();
}

/**
 * For "Cualquiera": the free groomer with the fewest booked minutes that day
 * (ties: the one listed first). Null when nobody can take it.
 */
export function pickLeastBusyStaff(opts: {
  staffIds: string[];
  start: number;
  duration: number;
  windowsByStaff: Record<string, Interval[]>;
  blocks: BusyBlock[];
}): string | null {
  let best: { id: string; booked: number } | null = null;
  for (const id of opts.staffIds) {
    if (!canStaffTake({ ...opts, staffId: id })) continue;
    const booked = totalMinutes(opts.blocks.filter((b) => b.staffId === id));
    if (!best || booked < best.booked) best = { id, booked };
  }
  return best?.id ?? null;
}

/**
 * Side-by-side layout for overlapping cards in one column.
 * Returns lane index and lane count per item (cards in a cluster share the lane count).
 */
export function layoutLanes<T extends { id: string; start: number; end: number }>(
  items: T[],
): Record<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: Record<string, { lane: number; lanes: number }> = {};
  let cluster: T[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const it of cluster) result[it.id].lanes = lanes;
    cluster = [];
    laneEnds = [];
  };

  for (const it of sorted) {
    if (cluster.length > 0 && it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds.splice(lane, 1, it.end);
    }
    result[it.id] = { lane, lanes: 1 };
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return result;
}

const GROOMER_ROLE_HINTS = ['groom', 'bath', 'bañ', 'estilist', 'stylist', 'peluquer'];

/**
 * Who appears as a bookable column / choice: active staff who either have an explicit service menu
 * or whose job title looks like a grooming role. If nobody matches (custom titles), everyone active is bookable.
 */
export function bookableStaff<T extends StaffLike & { role?: string | null }>(staff: T[]): T[] {
  const active = staff.filter((s) => !s.status || s.status === 'active');
  const matches = active.filter((s) => {
    if ((s.offered_service_ids ?? []).length > 0) return true;
    const role = String(s.role ?? '').toLowerCase();
    return GROOMER_ROLE_HINTS.some((h) => role.includes(h));
  });
  return matches.length > 0 ? matches : active;
}

/** "HH:mm" → minutes, or null when blank/invalid (unlike timeToMinutes, which defaults to 09:00). */
export function timeToMinutesSafe(hhmm: string | null | undefined): number | null {
  const n = normalizeHHmm(hhmm);
  if (!n) return null;
  const [h, m] = n.split(':').map(Number);
  return h * 60 + m;
}
