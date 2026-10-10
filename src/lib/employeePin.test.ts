import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findKioskStaffByPin,
  generateUniqueEmployeePin,
  isMissingFunctionError,
  managerPinPrefixInUse,
} from '@/lib/employeePin';

type Result = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * A fake Supabase client: `rpc(name)` answers from `rpcs`, and every `from(table)` query chain resolves to
 * `tables[table]`. Records the calls so tests can assert which path ran and what was selected.
 */
function fakeClient(rpcs: Record<string, Result>, tables: Record<string, Result> = {}) {
  const calls: { rpc: Array<[string, unknown]>; from: string[]; select: string[]; eq: Array<[string, unknown]> } = {
    rpc: [],
    from: [],
    select: [],
    eq: [],
  };
  const chain = (table: string) => {
    const result = tables[table] ?? { data: null, error: { message: `unexpected table ${table}` } };
    const q: Record<string, unknown> = {
      select: (cols: string) => {
        calls.select.push(cols);
        return q;
      },
      eq: (col: string, val: unknown) => {
        calls.eq.push([col, val]);
        return q;
      },
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    };
    return q;
  };
  const client = {
    rpc: vi.fn((name: string, args: unknown) => {
      calls.rpc.push([name, args]);
      return Promise.resolve(rpcs[name] ?? { data: null, error: { code: 'PGRST202', message: 'not found' } });
    }),
    from: vi.fn((table: string) => {
      calls.from.push(table);
      return chain(table);
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const missing = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
const kim = { id: 's1', business_id: 'b1', name: 'Kim', role: 'groomer', access_role: 'staff', status: 'active', photo_url: null };

describe('isMissingFunctionError', () => {
  it('is true only for function-not-found errors', () => {
    expect(isMissingFunctionError({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunctionError({ code: '42883' })).toBe(true);
    expect(isMissingFunctionError({ code: '42501' })).toBe(false);
    expect(isMissingFunctionError({ code: 'P0001' })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
  });
});

describe('findKioskStaffByPin (P2-02)', () => {
  it('uses kiosk_staff_by_pin when the database has it, without touching staff', async () => {
    const { client, calls } = fakeClient({ kiosk_staff_by_pin: { data: [kim], error: null } });
    await expect(findKioskStaffByPin(client, 'b1', '1234')).resolves.toEqual(kim);
    expect(calls.rpc).toEqual([['kiosk_staff_by_pin', { p_business_id: 'b1', p_pin: '1234' }]]);
    expect(calls.from).toEqual([]);
  });

  it('returns null when no one has the PIN', async () => {
    const { client } = fakeClient({ kiosk_staff_by_pin: { data: [], error: null } });
    await expect(findKioskStaffByPin(client, 'b1', '0000')).resolves.toBeNull();
  });

  it('falls back to the pre-migration staff filter when the RPC is missing, without selecting the PIN', async () => {
    const { client, calls } = fakeClient({ kiosk_staff_by_pin: missing }, { staff: { data: kim, error: null } });
    await expect(findKioskStaffByPin(client, 'b1', '1234')).resolves.toEqual(kim);
    expect(calls.from).toEqual(['staff']);
    expect(calls.select[0].split(',').map((c) => c.trim())).not.toContain('pin');
    expect(calls.eq).toEqual([
      ['pin', '1234'],
      ['business_id', 'b1'],
      ['status', 'active'],
    ]);
  });

  it('also falls back on Postgres 42883', async () => {
    const { client } = fakeClient(
      { kiosk_staff_by_pin: { data: null, error: { code: '42883', message: 'function does not exist' } } },
      { staff: { data: kim, error: null } }
    );
    await expect(findKioskStaffByPin(client, 'b1', '1234')).resolves.toEqual(kim);
  });

  it('does not fall back on a rate-limit or permission error', async () => {
    const { client, calls } = fakeClient({ kiosk_staff_by_pin: { data: null, error: { code: 'P0001', message: 'too_many_attempts' } } });
    await expect(findKioskStaffByPin(client, 'b1', '1234')).rejects.toMatchObject({ message: 'too_many_attempts' });
    expect(calls.from).toEqual([]);
  });
});

describe('managerPinPrefixInUse (P2-02)', () => {
  it('asks staff_pin_available for the first 4 digits', async () => {
    const { client, calls } = fakeClient({ staff_pin_available: { data: false, error: null } });
    await expect(managerPinPrefixInUse(client, 'b1', '123456')).resolves.toBe(true);
    expect(calls.rpc).toEqual([['staff_pin_available', { p_business_id: 'b1', p_pin: '1234' }]]);
    expect(calls.from).toEqual([]);
  });

  it('is false when the prefix is free', async () => {
    const { client } = fakeClient({ staff_pin_available: { data: true, error: null } });
    await expect(managerPinPrefixInUse(client, 'b1', '123456')).resolves.toBe(false);
  });

  it('falls back to the pre-migration PIN list when the RPC is missing', async () => {
    const { client } = fakeClient(
      { staff_pin_available: missing },
      { staff: { data: [{ id: 's1', pin: '1234' }, { id: 's2', pin: '' }], error: null } }
    );
    await expect(managerPinPrefixInUse(client, 'b1', '123456')).resolves.toBe(true);
    await expect(managerPinPrefixInUse(client, 'b1', '999999')).resolves.toBe(false);
  });

  it('does not fall back when the caller is not a manager', async () => {
    const { client } = fakeClient({ staff_pin_available: { data: null, error: { code: '42501', message: 'not allowed' } } });
    await expect(managerPinPrefixInUse(client, 'b1', '123456')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('generateUniqueEmployeePin (P2-02)', () => {
  it('uses generate_staff_pin with the manager PIN prefix reserved', async () => {
    const { client, calls } = fakeClient(
      { generate_staff_pin: { data: '4821', error: null } },
      { businesses: { data: { kiosk_manager_pin: '765432' }, error: null } }
    );
    await expect(generateUniqueEmployeePin(client, 'b1', { excludeEmployeeId: 's9' })).resolves.toBe('4821');
    expect(calls.rpc).toEqual([['generate_staff_pin', { p_business_id: 'b1', p_exclude_staff_id: 's9', p_reserved: '7654' }]]);
    expect(calls.from).toEqual(['businesses']);
  });

  it('falls back to generating from the pre-migration PIN list when the RPC is missing', async () => {
    const { client, calls } = fakeClient(
      { generate_staff_pin: missing },
      { businesses: { data: { kiosk_manager_pin: null }, error: null }, staff: { data: [{ id: 's1', pin: '1234' }], error: null } }
    );
    const pin = await generateUniqueEmployeePin(client, 'b1');
    expect(pin).toMatch(/^\d{4}$/);
    expect(pin).not.toBe('1234');
    expect(calls.from).toEqual(['businesses', 'staff']);
  });
});
