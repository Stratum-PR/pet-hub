import { describe, expect, it } from 'vitest';
import { birthdayDueToday, bodyToHtml, petAge, renderTemplate, senderName, todayInZone } from './logic';

describe('todayInZone', () => {
  it('uses the business time zone (PR is UTC-4)', () => {
    // 02:00 UTC on Oct 11 is still Oct 10 in Puerto Rico
    expect(todayInZone(new Date('2026-10-11T02:00:00Z'), 'America/Puerto_Rico')).toEqual({ year: 2026, month: 10, day: 10 });
  });
  it('falls back to Puerto Rico for a missing or invalid zone', () => {
    expect(todayInZone(new Date('2026-10-11T02:00:00Z'), null).day).toBe(10);
    expect(todayInZone(new Date('2026-10-11T02:00:00Z'), 'Not/AZone').day).toBe(10);
  });
});

describe('birthdayDueToday', () => {
  const oct = (day: number) => ({ year: 2026, month: 10, day });
  it('exact day: on the day and up to 2 days after, not before', () => {
    const pet = { birth_month: 10, birth_day: 12 };
    expect(birthdayDueToday(pet, oct(11))).toBe(false);
    expect(birthdayDueToday(pet, oct(12))).toBe(true);
    expect(birthdayDueToday(pet, oct(14))).toBe(true);
    expect(birthdayDueToday(pet, oct(15))).toBe(false);
  });
  it('month only: first 7 days of the birth month', () => {
    const pet = { birth_month: 10, birth_day: null };
    expect(birthdayDueToday(pet, oct(1))).toBe(true);
    expect(birthdayDueToday(pet, oct(7))).toBe(true);
    expect(birthdayDueToday(pet, oct(8))).toBe(false);
  });
  it('other month or no month: never', () => {
    expect(birthdayDueToday({ birth_month: 9, birth_day: 10 }, oct(10))).toBe(false);
    expect(birthdayDueToday({ birth_month: null, birth_day: null }, oct(1))).toBe(false);
  });
  it('Feb 29 falls on Feb 28 in non-leap years', () => {
    expect(birthdayDueToday({ birth_month: 2, birth_day: 29 }, { year: 2027, month: 2, day: 28 })).toBe(true);
  });
});

describe('templates', () => {
  const values = { pet_name: 'Luna', owner_first_name: 'Ana', owner_name: 'Ana Rivera', business_name: 'Pawsome', pet_age: '3' };
  it('fills placeholders and keeps unknown ones', () => {
    expect(renderTemplate('Hola {{owner_first_name}}, {{ pet_name }} cumple {{pet_age}} {{oops}}', values)).toBe(
      'Hola Ana, Luna cumple 3 {{oops}}'
    );
  });
  it('escapes HTML in the email body', () => {
    const html = bodyToHtml('Hola <b>Ana</b>\n\nChao', 'Pawsome', 'footer');
    expect(html).toContain('Hola &lt;b&gt;Ana&lt;/b&gt;');
    expect(html.match(/<p style="margin:0 0 16px">/g)?.length).toBe(2);
  });
  it('pet age and sender name', () => {
    expect(petAge(2023, 2026)).toBe('3');
    expect(petAge(null, 2026)).toBe('');
    expect(senderName('Pawsome "Spa" <x>')).toBe('Pawsome Spa x');
  });
});
