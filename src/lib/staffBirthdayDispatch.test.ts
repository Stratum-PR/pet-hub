import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import * as dispatch from '@/lib/staffBirthdayDispatch';

/** The RPC that never reached production (owner decision C5, unit U28). Split so this file doesn't match itself. */
const DROPPED_RPC = ['dispatch', 'staff', 'missing', 'email', 'reminders'].join('_');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe('staffBirthdayDispatch (U28)', () => {
  beforeEach(() => rpc.mockReset());

  it('no longer exports the missing-email reminder helper', () => {
    expect(Object.keys(dispatch).sort()).toEqual(['dispatchStaffBirthdaysForBusiness', 'isStaffDobCalendarToday']);
  });

  it('birthday dispatch still calls its own RPC', async () => {
    rpc.mockResolvedValue({ error: null });
    await expect(dispatch.dispatchStaffBirthdaysForBusiness('b1')).resolves.toEqual({ error: null });
    expect(rpc).toHaveBeenCalledWith('dispatch_staff_birthdays_for_business', { p_business_id: 'b1' });
  });

  it('no app code calls the RPC production does not have', () => {
    const hits = sourceFiles(path.resolve(__dirname, '..')).filter((f) =>
      fs.readFileSync(f, 'utf8').includes(DROPPED_RPC),
    );
    expect(hits).toEqual([]);
  });
});
