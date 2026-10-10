import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { defaultPayScheduleAnchorISO, resolvePayScheduleAnchorISO } from './payrollAnchor';
import { getPayPeriodRangeForDate } from './payScheduleUtils';

// Grumi businesses are in Puerto Rico (UTC-4, no DST). 21:00 PR on 2026-10-10 is 01:00 UTC on 2026-10-11.
const PR_EVENING = new Date('2026-10-11T01:00:00Z');

describe('payroll default anchor (local calendar day, not UTC)', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Puerto_Rico';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('runs in Puerto Rico local time (sanity)', () => {
    expect(format(PR_EVENING, 'yyyy-MM-dd HH:mm')).toBe('2026-10-10 21:00');
  });

  it('defaults the anchor to the local date at 21:00 PR', () => {
    vi.useFakeTimers();
    vi.setSystemTime(PR_EVENING);
    expect(defaultPayScheduleAnchorISO()).toBe('2026-10-10');
    expect(resolvePayScheduleAnchorISO('')).toBe('2026-10-10');
    expect(resolvePayScheduleAnchorISO(null)).toBe('2026-10-10');
  });

  it('current pay period with the default anchor includes 2026-10-10 at 21:00 PR', () => {
    vi.useFakeTimers();
    vi.setSystemTime(PR_EVENING);
    const now = new Date();
    const { periodStart, periodEnd } = getPayPeriodRangeForDate(now, {
      anchorDateISO: resolvePayScheduleAnchorISO(undefined),
      cadenceWeeks: 2,
    });
    expect(format(periodStart, 'yyyy-MM-dd')).toBe('2026-10-10');
    expect(format(periodEnd, 'yyyy-MM-dd')).toBe('2026-10-23');
    // A shift clocked in at 20:30 PR today falls inside the current period.
    const shift = new Date('2026-10-11T00:30:00Z');
    expect(shift >= periodStart && shift <= periodEnd).toBe(true);
  });

  it('keeps a saved anchor unchanged', () => {
    expect(resolvePayScheduleAnchorISO('2026-01-05', PR_EVENING)).toBe('2026-01-05');
  });

  it('matches the UTC date during the day (midday PR)', () => {
    expect(defaultPayScheduleAnchorISO(new Date('2026-10-10T16:00:00Z'))).toBe('2026-10-10');
  });
});
