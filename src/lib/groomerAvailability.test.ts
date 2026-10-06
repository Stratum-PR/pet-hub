import { describe, it, expect } from 'vitest';
import {
  bookableStaff,
  businessUsesShifts,
  canStaffTake,
  formatTime12h,
  freeStartsForAnyone,
  freeStartsForStaff,
  layoutLanes,
  normalizeHHmm,
  pickLeastBusyStaff,
  priceRangeForService,
  quoteForStaff,
  shiftWindowsForDay,
  staffOffersAll,
  workingWindows,
  type BusyBlock,
  type ShiftLike,
} from './groomerAvailability';

const day = new Date(2026, 9, 5); // Mon 5 Oct 2026, local time
const iso = (h: number, m = 0, d = 5) => new Date(2026, 9, d, h, m).toISOString();
const hours = { open: '09:00', close: '17:00' };

describe('time helpers', () => {
  it('normalizes DB times', () => {
    expect(normalizeHHmm('09:30:00')).toBe('09:30');
    expect(normalizeHHmm('9:05')).toBe('09:05');
    expect(normalizeHHmm(null)).toBe('');
    expect(normalizeHHmm('abc')).toBe('');
  });
  it('formats 12h', () => {
    expect(formatTime12h('00:15')).toBe('12:15 AM');
    expect(formatTime12h('13:00:00')).toBe('1:00 PM');
  });
});

describe('working windows', () => {
  const shifts: ShiftLike[] = [
    { staff_id: 'juan', start_time: iso(8), end_time: iso(13) },
    { staff_id: 'juan', start_time: iso(14), end_time: iso(18) },
    { staff_id: 'sofia', start_time: iso(10, 0, 6), end_time: iso(16, 0, 6) },
  ];

  it('uses shifts clipped to business hours', () => {
    expect(workingWindows({ staffId: 'juan', day, dayHours: hours, shifts, usesShifts: true })).toEqual([
      { start: 9 * 60, end: 13 * 60 },
      { start: 14 * 60, end: 17 * 60 },
    ]);
  });

  it('a groomer with no shift that day is off when the business uses shifts', () => {
    expect(workingWindows({ staffId: 'sofia', day, dayHours: hours, shifts, usesShifts: true })).toEqual([]);
  });

  it('falls back to business hours when no shifts are entered', () => {
    expect(workingWindows({ staffId: 'sofia', day, dayHours: hours, shifts: [], usesShifts: false })).toEqual([
      { start: 540, end: 1020 },
    ]);
  });

  it('closed day has no hours', () => {
    expect(
      workingWindows({ staffId: 'juan', day, dayHours: { ...hours, closed: true }, shifts, usesShifts: true }),
    ).toEqual([]);
  });

  it('splits an overnight shift by day', () => {
    const night = [{ staff_id: 'x', start_time: iso(22), end_time: iso(2, 0, 6) }];
    expect(shiftWindowsForDay(night, 'x', day)).toEqual([{ start: 22 * 60, end: 24 * 60 }]);
  });

  it('detects whether the week has shifts', () => {
    expect(businessUsesShifts(shifts, new Date(2026, 9, 4), new Date(2026, 9, 10, 23, 59))).toBe(true);
    expect(businessUsesShifts(shifts, new Date(2026, 9, 11), new Date(2026, 9, 17))).toBe(false);
  });
});

describe('services and prices', () => {
  const services = [
    { id: 'bath', name: 'Baño', price: 40, duration_minutes: 30 },
    { id: 'cut', name: 'Corte', price: 60, duration_minutes: 90 },
  ];
  const rates = [{ staff_id: 'sofia', service_id: 'cut', price: 75, duration_minutes: 60 }];

  it('empty offered list means all services', () => {
    expect(staffOffersAll({ id: 'a', status: 'active', offered_service_ids: [] }, ['bath'])).toBe(true);
    expect(staffOffersAll({ id: 'a', status: 'active', offered_service_ids: ['bath'] }, ['bath', 'cut'])).toBe(false);
    expect(staffOffersAll({ id: 'a', status: 'inactive', offered_service_ids: [] }, ['bath'])).toBe(false);
  });

  it('applies per-groomer overrides', () => {
    expect(quoteForStaff(['bath', 'cut'], services, rates, null)).toEqual({ price: 100, duration: 120 });
    expect(quoteForStaff(['bath', 'cut'], services, rates, 'sofia')).toEqual({ price: 115, duration: 90 });
  });

  it('price range across groomers', () => {
    expect(priceRangeForService(services[1], ['juan', 'sofia'], rates)).toEqual({ min: 60, max: 75 });
  });
});

describe('slots', () => {
  const windowsByStaff = {
    juan: [{ start: 540, end: 720 }],
    sofia: [{ start: 540, end: 720 }],
  };

  it('own appointments block only that groomer', () => {
    const blocks: BusyBlock[] = [{ staffId: 'juan', start: 540, end: 600 }];
    expect(freeStartsForStaff({ staffId: 'juan', duration: 60, windowsByStaff, blocks })).toEqual([
      '10:00',
      '10:30',
      '11:00',
    ]);
    expect(freeStartsForStaff({ staffId: 'sofia', duration: 60, windowsByStaff, blocks })[0]).toBe('09:00');
  });

  it('unassigned bookings consume capacity, not a specific groomer', () => {
    const blocks: BusyBlock[] = [
      { staffId: null, start: 540, end: 600 },
      { staffId: 'sofia', start: 540, end: 600 },
    ];
    // Sofia is busy and Juan must cover the unassigned booking → nobody free at 9:00.
    expect(canStaffTake({ staffId: 'juan', start: 540, duration: 30, windowsByStaff, blocks })).toBe(false);
    expect(freeStartsForAnyone({ staffIds: ['juan', 'sofia'], duration: 30, windowsByStaff, blocks })[0]).toBe('10:00');
  });

  it('respects the end of the shift', () => {
    expect(freeStartsForStaff({ staffId: 'juan', duration: 90, windowsByStaff, blocks: [] }).at(-1)).toBe('10:30');
  });

  it('auto-assign picks the least busy free groomer', () => {
    const blocks: BusyBlock[] = [{ staffId: 'juan', start: 660, end: 720 }];
    expect(
      pickLeastBusyStaff({ staffIds: ['juan', 'sofia'], start: 540, duration: 60, windowsByStaff, blocks }),
    ).toBe('sofia');
    expect(
      pickLeastBusyStaff({ staffIds: ['juan'], start: 660, duration: 60, windowsByStaff, blocks }),
    ).toBeNull();
  });
});

describe('layoutLanes', () => {
  it('puts overlapping cards side by side and keeps others full width', () => {
    const r = layoutLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 570, end: 630 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 700, end: 760 },
    ]);
    expect(r.a).toEqual({ lane: 0, lanes: 2 });
    expect(r.b).toEqual({ lane: 1, lanes: 2 });
    expect(r.c).toEqual({ lane: 0, lanes: 2 });
    expect(r.d).toEqual({ lane: 0, lanes: 1 });
  });
});


describe('bookableStaff', () => {
  it('keeps groomers and staff with a service menu, drops the front desk', () => {
    const list = [
      { id: 'm', status: 'active', role: 'Manager', offered_service_ids: [] },
      { id: 'g', status: 'active', role: 'groomer', offered_service_ids: [] },
      { id: 'r', status: 'active', role: 'Recepcionista', offered_service_ids: ['bath'] },
      { id: 'x', status: 'inactive', role: 'groomer', offered_service_ids: [] },
    ];
    expect(bookableStaff(list).map((s) => s.id)).toEqual(['g', 'r']);
  });
  it('falls back to everyone active when no title matches', () => {
    expect(bookableStaff([{ id: 'a', status: 'active', role: 'Owner', offered_service_ids: [] }]).map((s) => s.id)).toEqual(['a']);
  });
});
