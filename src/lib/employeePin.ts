/**
 * Employee kiosk PINs: lookup, generation and collision checks (unique per business, avoid manager PIN prefix).
 *
 * P2-02: the database hashes PINs (staff_pin_hashes, migration 20261010210000) and exposes RPCs that compare hashes:
 * `kiosk_staff_by_pin`, `generate_staff_pin`, `staff_pin_available`. This module calls those and never selects
 * `staff.pin` on a migrated database. Until the owner applies that migration to a database, the RPCs don't exist
 * there; each call then falls back to the pre-P2-02 query (only on "function not found", never on a permission or
 * rate-limit error). Remove the fallbacks in the P2-02 contract step.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPLOYEE_PIN_LENGTH, KIOSK_MANAGER_PIN_LENGTH } from '@/lib/pinLengths';

/**
 * Legacy (pre-P2-02 database only): staff columns for PIN uniqueness checks. Used solely by the fallback when
 * `generate_staff_pin` / `staff_pin_available` are missing.
 */
export const STAFF_PIN_COLUMNS = 'id, pin';

/** The business's kiosk manager PIN (kiosk lock/unlock, manager PIN settings and reset). */
export const BUSINESS_KIOSK_MANAGER_PIN_COLUMNS = 'kiosk_manager_pin';

/** Staff columns the kiosk shows after a PIN lookup (never the PIN). Same shape `kiosk_staff_by_pin` returns. */
export const KIOSK_STAFF_COLUMNS = 'id, business_id, name, role, access_role, status, photo_url';

export interface KioskStaffRow {
  id: string;
  business_id: string | null;
  name: string;
  role: string;
  access_role: string | null;
  status: string;
  photo_url: string | null;
}

type RpcError = { code?: string; message?: string } | null | undefined;

/**
 * True when an RPC failed because the function doesn't exist in this database (PostgREST PGRST202, or Postgres
 * 42883 undefined_function), i.e. the P2-02 migration isn't applied there yet.
 */
export function isMissingFunctionError(err: RpcError): boolean {
  return !!err && (err.code === 'PGRST202' || err.code === '42883');
}

function randomFourDigitPin(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(EMPLOYEE_PIN_LENGTH, '0');
}

/**
 * The active staff member of the business with this PIN, or null. Hash compare via `kiosk_staff_by_pin`; before the
 * migration, the old filter on `staff.pin` (the PIN is only a filter there, never a selected column).
 * Throws on any other error (permission, too many wrong PINs).
 */
export async function findKioskStaffByPin(
  client: SupabaseClient,
  businessId: string,
  pin: string
): Promise<KioskStaffRow | null> {
  const { data, error } = await client.rpc('kiosk_staff_by_pin', { p_business_id: businessId, p_pin: pin });
  if (!error) {
    const rows = (Array.isArray(data) ? data : data ? [data] : []) as KioskStaffRow[];
    return rows[0] ?? null;
  }
  if (!isMissingFunctionError(error)) throw error;

  const legacy = await client
    .from('staff')
    .select(KIOSK_STAFF_COLUMNS)
    .eq('pin', pin)
    .eq('business_id', businessId)
    .eq('status', 'active')
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  return (legacy.data as KioskStaffRow | null) ?? null;
}

/**
 * Legacy: every employee PIN of a business (selects `staff.pin`). Used by the fallbacks below.
 * @deprecated Still called by `KioskManagerPinResetDialog` (unchanged in U11: the repo's pre-commit hook blocks any
 * commit touching that file on a pre-existing false positive); switch it to `managerPinPrefixInUse`.
 */
export async function fetchEmployeePinsForBusiness(
  client: SupabaseClient,
  businessId: string,
  options?: { excludeEmployeeId?: string }
): Promise<Set<string>> {
  const { data, error } = await client.from('staff').select(STAFF_PIN_COLUMNS).eq('business_id', businessId);
  if (error) throw error;
  const pins = new Set<string>();
  for (const row of (data ?? []) as Array<{ id: string; pin: unknown }>) {
    if (options?.excludeEmployeeId && row.id === options.excludeEmployeeId) continue;
    const p = row.pin;
    if (typeof p === 'string' && new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(p)) {
      pins.add(p);
    }
  }
  return pins;
}

/**
 * True if the first 4 digits of a 6-digit manager PIN match any full employee PIN.
 * @deprecated Use `managerPinPrefixInUse` (no plain PINs in the browser).
 */
export function managerPinPrefixCollidesWithEmployeePins(
  managerPinSixDigit: string,
  employeePins: Set<string>
): boolean {
  if (managerPinSixDigit.length !== KIOSK_MANAGER_PIN_LENGTH) return false;
  return employeePins.has(managerPinSixDigit.slice(0, EMPLOYEE_PIN_LENGTH));
}

/**
 * True if the first 4 digits of a 6-digit manager PIN are some employee's PIN (the kiosk could not tell them apart).
 * Hash compare via `staff_pin_available` (managers only); before the migration, the old PIN list.
 */
export async function managerPinPrefixInUse(
  client: SupabaseClient,
  businessId: string,
  managerPinSixDigit: string
): Promise<boolean> {
  if (managerPinSixDigit.length !== KIOSK_MANAGER_PIN_LENGTH) return false;
  const prefix = managerPinSixDigit.slice(0, EMPLOYEE_PIN_LENGTH);
  const { data, error } = await client.rpc('staff_pin_available', { p_business_id: businessId, p_pin: prefix });
  if (!error) return data === false;
  if (!isMissingFunctionError(error)) throw error;
  return (await fetchEmployeePinsForBusiness(client, businessId)).has(prefix);
}

/**
 * A random 4-digit PIN no other staff member of the business has and that isn't the kiosk manager PIN's prefix.
 * Server-side via `generate_staff_pin`; before the migration, generated here from the old PIN list.
 */
export async function generateUniqueEmployeePin(
  client: SupabaseClient,
  businessId: string,
  options?: { excludeEmployeeId?: string }
): Promise<string> {
  const { data: biz, error: bizErr } = await client
    .from('businesses')
    .select(BUSINESS_KIOSK_MANAGER_PIN_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();
  if (bizErr) throw bizErr;

  const mgr = (biz as { kiosk_manager_pin?: unknown } | null)?.kiosk_manager_pin;
  const reservedPrefix =
    typeof mgr === 'string' && mgr.length === KIOSK_MANAGER_PIN_LENGTH
      ? mgr.slice(0, EMPLOYEE_PIN_LENGTH)
      : null;

  const { data, error } = await client.rpc('generate_staff_pin', {
    p_business_id: businessId,
    p_exclude_staff_id: options?.excludeEmployeeId ?? null,
    p_reserved: reservedPrefix,
  });
  if (!error) {
    if (typeof data === 'string' && new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(data)) return data;
    throw new Error('Could not generate a unique PIN for this business');
  }
  if (!isMissingFunctionError(error)) throw error;

  const used = await fetchEmployeePinsForBusiness(client, businessId, options);
  for (let attempt = 0; attempt < 2500; attempt++) {
    const candidate = randomFourDigitPin();
    if (used.has(candidate)) continue;
    if (reservedPrefix !== null && candidate === reservedPrefix) continue;
    return candidate;
  }
  throw new Error('Could not generate a unique PIN for this business');
}
