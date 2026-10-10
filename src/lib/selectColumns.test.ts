import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { BUSINESS_COLUMNS, PROFILE_COLUMNS } from '@/lib/auth';
import { BUSINESS_KIOSK_MANAGER_PIN_COLUMNS, STAFF_PIN_COLUMNS } from '@/lib/employeePin';
import { STAFF_MANAGER_COLUMNS, STAFF_PUBLIC_COLUMNS } from '@/hooks/useSupabaseData';
import { KIOSK_STAFF_COLUMNS } from '@/hooks/useTimeKiosk';

/** Column names of `public.<table>` in the production schema snapshot the test stack starts from. */
function snapshotColumns(table: string): Set<string> {
  const sql = readFileSync(resolve(__dirname, '../../test-env/supabase/prod-schema-snapshot.sql'), 'utf8');
  const start = sql.indexOf(`CREATE TABLE public.${table} (`);
  if (start < 0) throw new Error(`table ${table} not in snapshot`);
  const body = sql.slice(start, sql.indexOf('\n);', start));
  const cols = new Set<string>();
  for (const line of body.split('\n').slice(1)) {
    const m = /^\s+([a-z_][a-z0-9_]*)\s/.exec(line);
    if (m) cols.add(m[1]);
  }
  return cols;
}

const list = (columns: string) => columns.split(',').map((c) => c.trim());

describe('explicit column lists (P3-04)', () => {
  const lists: Array<[string, string, string]> = [
    ['STAFF_PUBLIC_COLUMNS', 'staff', STAFF_PUBLIC_COLUMNS],
    ['STAFF_MANAGER_COLUMNS', 'staff', STAFF_MANAGER_COLUMNS],
    ['KIOSK_STAFF_COLUMNS', 'staff', KIOSK_STAFF_COLUMNS],
    ['STAFF_PIN_COLUMNS', 'staff', STAFF_PIN_COLUMNS],
    ['PROFILE_COLUMNS', 'profiles', PROFILE_COLUMNS],
    ['BUSINESS_COLUMNS', 'businesses', BUSINESS_COLUMNS],
    ['BUSINESS_KIOSK_MANAGER_PIN_COLUMNS', 'businesses', BUSINESS_KIOSK_MANAGER_PIN_COLUMNS],
  ];

  it.each(lists)('%s names only existing %s columns, without duplicates', (_name, table, columns) => {
    const existing = snapshotColumns(table);
    const cols = list(columns);
    expect(cols.filter((c) => !existing.has(c))).toEqual([]);
    expect(new Set(cols).size).toBe(cols.length);
  });

  it('the employee-facing staff list does not include the PIN', () => {
    expect(list(STAFF_PUBLIC_COLUMNS)).not.toContain('pin');
  });

  it('the business list behind the auth context does not include the kiosk manager PIN', () => {
    expect(list(BUSINESS_COLUMNS)).not.toContain('kiosk_manager_pin');
  });
});
