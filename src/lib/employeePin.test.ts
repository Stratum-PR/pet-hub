import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchLegacyKioskManagerPin,
  findKioskStaffByPin,
  generateUniqueEmployeePin,
  isMissingColumnError,
  isMissingFunctionError,
  isTooManyAttemptsError,
  kioskManagerPinConfigured,
  kioskPinEntry,
  managerPinPrefixInUse,
  setKioskManagerPin,
} from '@/lib/employeePin';

type Result = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * A fake Supabase client: `rpc(name)` answers from `rpcs`, and every `from(table)` query chain resolves to
 * `tables[table]` (an array: one result per `from(table)` call, in order). Records the calls so tests can assert
 * which path ran and what was selected or written.
 */
function fakeClient(rpcs: Record<string, Result>, tables: Record<string, Result | Result[]> = {}) {
  const calls: {
    rpc: Array<[string, unknown]>;
    from: string[];
    select: string[];
    eq: Array<[string, unknown]>;
    update: Array<[string, unknown]>;
  } = {
    rpc: [],
    from: [],
    select: [],
    eq: [],
    update: [],
  };
  const chain = (table: string) => {
    const entry = tables[table];
    const next = Array.isArray(entry) ? entry.shift() : entry;
    const result = next ?? { data: null, error: { message: `unexpected table ${table}` } };
    const q: Record<string, unknown> = {
      select: (cols: string) => {
        calls.select.push(cols);
        return q;
      },
      update: (values: unknown) => {
        calls.update.push([table, values]);
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

const missingColumn = { data: null, error: { code: '42703', message: 'column businesses.kiosk_manager_pin_set does not exist' } };
const columnsOf = (select: string) => select.split(',').map((c) => c.trim());

describe('isMissingColumnError (P2-04)', () => {
  it('is true only for column-not-found errors', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true);
    expect(isMissingColumnError({ code: 'PGRST202' })).toBe(false);
    expect(isMissingColumnError({ code: '42501' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe('kioskManagerPinConfigured (P2-04)', () => {
  it('reads kiosk_manager_pin_set, never the PIN', async () => {
    const { client, calls } = fakeClient({}, { businesses: { data: { kiosk_manager_pin_set: true }, error: null } });
    await expect(kioskManagerPinConfigured(client, 'b1')).resolves.toBe(true);
    expect(calls.select).toEqual(['kiosk_manager_pin_set']);
    expect(calls.eq).toEqual([['id', 'b1']]);
  });

  it('is false when no 6-digit PIN is set (or the caller is not a member: NULL)', async () => {
    const { client } = fakeClient(
      {},
      { businesses: [{ data: { kiosk_manager_pin_set: false }, error: null }, { data: { kiosk_manager_pin_set: null }, error: null }] }
    );
    await expect(kioskManagerPinConfigured(client, 'b1')).resolves.toBe(false);
    await expect(kioskManagerPinConfigured(client, 'b1')).resolves.toBe(false);
  });

  it('falls back to the plain column only when the field is missing (pre-P2-04 database)', async () => {
    const { client, calls } = fakeClient(
      {},
      {
        businesses: [
          missingColumn,
          { data: { kiosk_manager_pin: '123456' }, error: null },
          missingColumn,
          { data: { kiosk_manager_pin: '1234' }, error: null },
        ],
      }
    );
    await expect(kioskManagerPinConfigured(client, 'b1')).resolves.toBe(true);
    // A legacy 4-digit manager PIN counts as not set (upgrade path), as before.
    await expect(kioskManagerPinConfigured(client, 'b1')).resolves.toBe(false);
    expect(calls.select).toEqual(['kiosk_manager_pin_set', 'kiosk_manager_pin', 'kiosk_manager_pin_set', 'kiosk_manager_pin']);
  });

  it('does not fall back on other errors', async () => {
    const { client, calls } = fakeClient({}, { businesses: { data: null, error: { code: '42501', message: 'permission denied' } } });
    await expect(kioskManagerPinConfigured(client, 'b1')).rejects.toMatchObject({ code: '42501' });
    expect(calls.select).toEqual(['kiosk_manager_pin_set']);
  });
});

describe('fetchLegacyKioskManagerPin (pre-P2-04 fallback)', () => {
  it('returns the plain PIN or null, and throws on error', async () => {
    const ok = fakeClient({}, { businesses: { data: { kiosk_manager_pin: '123456' }, error: null } });
    await expect(fetchLegacyKioskManagerPin(ok.client, 'b1')).resolves.toBe('123456');
    const none = fakeClient({}, { businesses: { data: { kiosk_manager_pin: null }, error: null } });
    await expect(fetchLegacyKioskManagerPin(none.client, 'b1')).resolves.toBeNull();
    const bad = fakeClient({}, { businesses: { data: null, error: { code: '42501', message: 'no' } } });
    await expect(fetchLegacyKioskManagerPin(bad.client, 'b1')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('kioskPinEntry (P2-04)', () => {
  it('returns the staff member for an employee PIN, without touching tables', async () => {
    const { client, calls } = fakeClient({ kiosk_pin_entry: { data: { result: 'staff', staff: kim }, error: null } });
    await expect(kioskPinEntry(client, 'b1', '1234')).resolves.toEqual({ result: 'staff', staff: kim });
    expect(calls.rpc).toEqual([['kiosk_pin_entry', { p_business_id: 'b1', p_pin: '1234' }]]);
    expect(calls.from).toEqual([]);
  });

  it('maps manager, manager_prefix and invalid', async () => {
    const answer = (data: unknown) => fakeClient({ kiosk_pin_entry: { data, error: null } }).client;
    await expect(kioskPinEntry(answer({ result: 'manager', staff: null }), 'b1', '123456')).resolves.toEqual({ result: 'manager', staff: null });
    await expect(kioskPinEntry(answer({ result: 'manager', staff: kim }), 'b1', '123456')).resolves.toEqual({ result: 'manager', staff: kim });
    await expect(kioskPinEntry(answer({ result: 'manager_prefix', staff: null }), 'b1', '1234')).resolves.toEqual({
      result: 'manager_prefix',
      staff: null,
    });
    await expect(kioskPinEntry(answer({ result: 'invalid', staff: null }), 'b1', '9999')).resolves.toEqual({ result: 'invalid', staff: null });
    // A "staff" answer without a staff member is treated as invalid.
    await expect(kioskPinEntry(answer({ result: 'staff', staff: null }), 'b1', '9999')).resolves.toEqual({ result: 'invalid', staff: null });
  });

  it('returns null when the function is missing (pre-P2-04 database), on PGRST202 and 42883', async () => {
    const a = fakeClient({ kiosk_pin_entry: missing });
    await expect(kioskPinEntry(a.client, 'b1', '1234')).resolves.toBeNull();
    const b = fakeClient({ kiosk_pin_entry: { data: null, error: { code: '42883', message: 'function does not exist' } } });
    await expect(kioskPinEntry(b.client, 'b1', '1234')).resolves.toBeNull();
    expect(a.calls.from).toEqual([]);
  });

  it('throws on a rate-limit or permission error', async () => {
    const { client } = fakeClient({ kiosk_pin_entry: { data: null, error: { code: 'P0001', message: 'too_many_attempts' } } });
    await expect(kioskPinEntry(client, 'b1', '1234')).rejects.toMatchObject({ message: 'too_many_attempts' });
    const denied = fakeClient({ kiosk_pin_entry: { data: null, error: { code: '42501', message: 'not allowed' } } });
    await expect(kioskPinEntry(denied.client, 'b1', '1234')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('setKioskManagerPin (P2-04)', () => {
  it('saves through set_kiosk_manager_pin, without reading or writing businesses', async () => {
    const { client, calls } = fakeClient({ set_kiosk_manager_pin: { data: { ok: true }, error: null } });
    await expect(setKioskManagerPin(client, 'b1', '654321', { currentPin: '123456' })).resolves.toEqual({ ok: true });
    expect(calls.rpc).toEqual([['set_kiosk_manager_pin', { p_business_id: 'b1', p_new_pin: '654321', p_current_pin: '123456' }]]);
    expect(calls.from).toEqual([]);
  });

  it('sends no current PIN from the reset dialog', async () => {
    const { client, calls } = fakeClient({ set_kiosk_manager_pin: { data: { ok: true }, error: null } });
    await setKioskManagerPin(client, 'b1', '654321');
    expect(calls.rpc).toEqual([['set_kiosk_manager_pin', { p_business_id: 'b1', p_new_pin: '654321', p_current_pin: null }]]);
  });

  it("returns the database's refusals", async () => {
    for (const code of ['invalid_pin', 'pin_prefix_in_use', 'current_pin_required', 'current_pin_incorrect']) {
      const { client } = fakeClient({ set_kiosk_manager_pin: { data: { ok: false, error: code }, error: null } });
      await expect(setKioskManagerPin(client, 'b1', '654321')).resolves.toEqual({ ok: false, error: code });
    }
    const odd = fakeClient({ set_kiosk_manager_pin: { data: { ok: false, error: 'something_else' }, error: null } });
    await expect(setKioskManagerPin(odd.client, 'b1', '654321')).rejects.toThrow('something_else');
  });

  it('does not fall back on a permission or rate-limit error', async () => {
    const denied = fakeClient({ set_kiosk_manager_pin: { data: null, error: { code: '42501', message: 'not allowed' } } });
    await expect(setKioskManagerPin(denied.client, 'b1', '654321')).rejects.toMatchObject({ code: '42501' });
    expect(denied.calls.from).toEqual([]);
    expect(denied.calls.update).toEqual([]);
    const limited = fakeClient({ set_kiosk_manager_pin: { data: null, error: { code: 'P0001', message: 'too_many_attempts' } } });
    const err = await setKioskManagerPin(limited.client, 'b1', '654321', { currentPin: '000000' }).catch((e: unknown) => e);
    expect(isTooManyAttemptsError(err)).toBe(true);
    expect(limited.calls.update).toEqual([]);
  });

  describe('pre-P2-04 database (function missing): the old browser checks and plain update', () => {
    it('refuses a PIN that is not 6 digits without writing', async () => {
      const { client, calls } = fakeClient({ set_kiosk_manager_pin: missing });
      await expect(setKioskManagerPin(client, 'b1', '12345')).resolves.toEqual({ ok: false, error: 'invalid_pin' });
      expect(calls.update).toEqual([]);
    });

    it("refuses a PIN whose first 4 digits are an employee's PIN", async () => {
      const { client, calls } = fakeClient({ set_kiosk_manager_pin: missing, staff_pin_available: { data: false, error: null } });
      await expect(setKioskManagerPin(client, 'b1', '123456')).resolves.toEqual({ ok: false, error: 'pin_prefix_in_use' });
      expect(calls.update).toEqual([]);
    });

    it('checks the current PIN against the plain column', async () => {
      const { client, calls } = fakeClient(
        { set_kiosk_manager_pin: missing, staff_pin_available: { data: true, error: null } },
        { businesses: { data: { kiosk_manager_pin: '111111' }, error: null } }
      );
      await expect(setKioskManagerPin(client, 'b1', '654321', { currentPin: '222222' })).resolves.toEqual({
        ok: false,
        error: 'current_pin_incorrect',
      });
      expect(calls.update).toEqual([]);
    });

    it('writes the plain column when the checks pass (settings with current PIN, reset without)', async () => {
      const settings = fakeClient(
        { set_kiosk_manager_pin: missing, staff_pin_available: { data: true, error: null } },
        { businesses: [{ data: { kiosk_manager_pin: '111111' }, error: null }, { data: null, error: null }] }
      );
      await expect(setKioskManagerPin(settings.client, 'b1', '654321', { currentPin: '111111' })).resolves.toEqual({ ok: true });
      expect(settings.calls.update).toEqual([['businesses', { kiosk_manager_pin: '654321' }]]);
      expect(settings.calls.eq.at(-1)).toEqual(['id', 'b1']);

      const reset = fakeClient(
        { set_kiosk_manager_pin: missing, staff_pin_available: { data: true, error: null } },
        { businesses: { data: null, error: null } }
      );
      await expect(setKioskManagerPin(reset.client, 'b1', '654321')).resolves.toEqual({ ok: true });
      expect(reset.calls.from).toEqual(['businesses']);
      expect(reset.calls.update).toEqual([['businesses', { kiosk_manager_pin: '654321' }]]);
    });
  });
});

describe('generateUniqueEmployeePin on a P2-04 database', () => {
  it('reads only kiosk_manager_pin_set and leaves the reserved prefix to the server', async () => {
    const { client, calls } = fakeClient(
      { generate_staff_pin: { data: '4821', error: null } },
      { businesses: { data: { kiosk_manager_pin_set: true }, error: null } }
    );
    await expect(generateUniqueEmployeePin(client, 'b1')).resolves.toBe('4821');
    expect(calls.select.flatMap(columnsOf)).not.toContain('kiosk_manager_pin');
    expect(calls.rpc).toEqual([['generate_staff_pin', { p_business_id: 'b1', p_exclude_staff_id: null, p_reserved: null }]]);
  });

  it('reserves the plain prefix only on a database without P2-04 (42703 fallback)', async () => {
    const { client, calls } = fakeClient(
      { generate_staff_pin: { data: '4821', error: null } },
      { businesses: [missingColumn, { data: { kiosk_manager_pin: '765432' }, error: null }] }
    );
    await expect(generateUniqueEmployeePin(client, 'b1')).resolves.toBe('4821');
    expect(calls.select).toEqual(['kiosk_manager_pin_set', 'kiosk_manager_pin']);
    expect(calls.rpc).toEqual([['generate_staff_pin', { p_business_id: 'b1', p_exclude_staff_id: null, p_reserved: '7654' }]]);
  });
});

describe('isTooManyAttemptsError', () => {
  it("recognises the database's wrong-PIN limit", () => {
    expect(isTooManyAttemptsError({ code: 'P0001', message: 'too_many_attempts' })).toBe(true);
    expect(isTooManyAttemptsError({ code: '42501', message: 'not allowed' })).toBe(false);
    expect(isTooManyAttemptsError(null)).toBe(false);
    expect(isTooManyAttemptsError('too_many_attempts')).toBe(false);
  });
});
