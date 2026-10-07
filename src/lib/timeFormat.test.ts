import { describe, expect, it } from 'vitest';
import { clock12, clock12FromHHmm, formatT } from './timeFormat';

describe('simplified 12h clock', () => {
  it('drops :00 on the hour', () => {
    expect(clock12(13, 0)).toBe('1 PM');
    expect(clock12(0, 0)).toBe('12 AM');
    expect(clock12(12, 0)).toBe('12 PM');
    expect(clock12(9, 5)).toBe('9:05 AM');
    expect(clock12FromHHmm('17:30:00')).toBe('5:30 PM');
  });
  it('wraps date-fns patterns', () => {
    expect(formatT(new Date(2026, 9, 7, 13, 0), 'MMM d, h:mm a')).toBe('Oct 7, 1 PM');
    expect(formatT(new Date(2026, 9, 7, 13, 45), 'h:mm a')).toBe('1:45 PM');
  });
});
