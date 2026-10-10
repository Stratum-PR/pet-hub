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

/**
 * Legacy (pre-P2-04 database only): the business's plain kiosk manager PIN. Selected solely by the fallbacks below
 * when `kiosk_manager_pin_set` / `kiosk_pin_entry` / `set_kiosk_manager_pin` are missing.
 */
export const BUSINESS_KIOSK_MANAGER_PIN_COLUMNS = 'kiosk_manager_pin';

/**
 * P2-04: computed field on businesses (migration 20261010220000): true when a 6-digit manager PIN is set. Never the
 * PIN. Before that migration, selecting it fails with 42703 and the callers fall back to the plain column.
 */
export const BUSINESS_KIOSK_MANAGER_PIN_STATUS_COLUMNS = 'kiosk_manager_pin_set';

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

/**
 * True when a select failed because a column (or computed field) doesn't exist in this database (Postgres 42703,
 * PostgREST PGRST204), i.e. the P2-04 migration isn't applied there yet.
 */
export function isMissingColumnError(err: RpcError): boolean {
  return !!err && (err.code === '42703' || err.code === 'PGRST204');
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
 * Legacy: every employee PIN of a business (selects `staff.pin`). Used only by the pre-P2-02 fallbacks below.
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

type BusinessKioskPinRow = { kiosk_manager_pin_set?: unknown; kiosk_manager_pin?: unknown } | null;

/**
 * The business's manager-PIN status: `kiosk_manager_pin_set` (P2-04, never the PIN). Only on a database without the
 * P2-04 migration (42703), the legacy plain `kiosk_manager_pin`. Throws on any other error.
 */
async function selectKioskManagerPinRow(client: SupabaseClient, businessId: string): Promise<BusinessKioskPinRow> {
  const status = await client
    .from('businesses')
    .select(BUSINESS_KIOSK_MANAGER_PIN_STATUS_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();
  if (!status.error) return status.data as BusinessKioskPinRow;
  if (!isMissingColumnError(status.error)) throw status.error;

  const legacy = await client
    .from('businesses')
    .select(BUSINESS_KIOSK_MANAGER_PIN_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data as BusinessKioskPinRow;
}

function isSixDigitManagerPin(value: unknown): value is string {
  return typeof value === 'string' && value.length === KIOSK_MANAGER_PIN_LENGTH;
}

/**
 * Is a 6-digit kiosk manager PIN set for the business? (Kiosk lock gate, settings "current PIN" field.) A legacy
 * shorter PIN counts as not set. P2-04: reads `kiosk_manager_pin_set`; before that migration, the plain column.
 */
export async function kioskManagerPinConfigured(client: SupabaseClient, businessId: string): Promise<boolean> {
  const row = await selectKioskManagerPinRow(client, businessId);
  if (row && 'kiosk_manager_pin_set' in row) return row.kiosk_manager_pin_set === true;
  return isSixDigitManagerPin(row?.kiosk_manager_pin);
}

/**
 * Legacy (pre-P2-04 database only): the plain manager PIN, for the kiosk's old in-browser comparison. Throws on error.
 */
export async function fetchLegacyKioskManagerPin(client: SupabaseClient, businessId: string): Promise<string | null> {
  const { data, error } = await client
    .from('businesses')
    .select(BUSINESS_KIOSK_MANAGER_PIN_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw error;
  const pin = (data as BusinessKioskPinRow)?.kiosk_manager_pin;
  return typeof pin === 'string' ? pin : null;
}

export type KioskPinEntryResult =
  | { result: 'staff'; staff: KioskStaffRow }
  | { result: 'manager'; staff: KioskStaffRow | null }
  | { result: 'manager_prefix'; staff: null }
  | { result: 'invalid'; staff: null };

/**
 * The kiosk keypad (P2-04 `kiosk_pin_entry`, hash compare in the database, rate-limited like clock_in_out):
 * 4 digits → a staff member, or `manager_prefix` (keep typing); 5 → `manager_prefix` or invalid; 6 → `manager`
 * (with the staff member who has that PIN, if any) or invalid.
 * Returns null when the function is missing (pre-P2-04 database): the caller uses its old in-browser comparison.
 * Throws on any other error (permission, too many wrong PINs).
 */
export async function kioskPinEntry(
  client: SupabaseClient,
  businessId: string,
  pin: string
): Promise<KioskPinEntryResult | null> {
  const { data, error } = await client.rpc('kiosk_pin_entry', { p_business_id: businessId, p_pin: pin });
  if (error) {
    if (isMissingFunctionError(error)) return null;
    throw error;
  }
  const body = (data ?? {}) as { result?: unknown; staff?: unknown };
  const staff = (body.staff && typeof body.staff === 'object' ? body.staff : null) as KioskStaffRow | null;
  if (body.result === 'staff' && staff) return { result: 'staff', staff };
  if (body.result === 'manager') return { result: 'manager', staff };
  if (body.result === 'manager_prefix') return { result: 'manager_prefix', staff: null };
  return { result: 'invalid', staff: null };
}

export type SetKioskManagerPinError =
  | 'invalid_pin'
  | 'pin_prefix_in_use'
  | 'current_pin_required'
  | 'current_pin_incorrect';

export type SetKioskManagerPinResult = { ok: true; error?: undefined } | { ok: false; error: SetKioskManagerPinError };

const SET_KIOSK_MANAGER_PIN_ERRORS: readonly SetKioskManagerPinError[] = [
  'invalid_pin',
  'pin_prefix_in_use',
  'current_pin_required',
  'current_pin_incorrect',
];

/**
 * Set or change the kiosk manager PIN (settings card with `currentPin`, reset dialog without it right after the
 * account password step). P2-04 `set_kiosk_manager_pin` checks everything in the database: managers only, 6 digits,
 * first 4 not a staff PIN, and when a PIN exists the current PIN or a password sign-in in the last 10 minutes.
 * Before that migration: the old browser checks and a direct update of the plain column.
 * Throws on permission / rate-limit / network errors.
 */
export async function setKioskManagerPin(
  client: SupabaseClient,
  businessId: string,
  newPin: string,
  options?: { currentPin?: string }
): Promise<SetKioskManagerPinResult> {
  const { data, error } = await client.rpc('set_kiosk_manager_pin', {
    p_business_id: businessId,
    p_new_pin: newPin,
    p_current_pin: options?.currentPin ?? null,
  });
  if (!error) {
    const body = (data ?? {}) as { ok?: unknown; error?: unknown };
    if (body.ok === true) return { ok: true };
    const code = SET_KIOSK_MANAGER_PIN_ERRORS.find((c) => c === body.error);
    if (code) return { ok: false, error: code };
    throw new Error(typeof body.error === 'string' ? body.error : 'set_kiosk_manager_pin failed');
  }
  if (!isMissingFunctionError(error)) throw error;

  // Pre-P2-04 database: the checks the settings card and reset dialog made in the browser before.
  if (!new RegExp(`^\\d{${KIOSK_MANAGER_PIN_LENGTH}}$`).test(newPin)) return { ok: false, error: 'invalid_pin' };
  if (await managerPinPrefixInUse(client, businessId, newPin)) return { ok: false, error: 'pin_prefix_in_use' };
  if (options?.currentPin !== undefined) {
    const stored = await fetchLegacyKioskManagerPin(client, businessId);
    if (isSixDigitManagerPin(stored) && stored !== options.currentPin) {
      return { ok: false, error: 'current_pin_incorrect' };
    }
  }
  const { error: upErr } = await client
    .from('businesses')
    .update({ kiosk_manager_pin: newPin })
    .eq('id', businessId);
  if (upErr) throw upErr;
  return { ok: true };
}

/** True for the database's wrong-PIN limit (clock_in_out, kiosk_staff_by_pin, kiosk_pin_entry, set_kiosk_manager_pin). */
export function isTooManyAttemptsError(err: unknown): err is { message: string; details?: string } {
  return !!err && typeof err === 'object' && (err as { message?: unknown }).message === 'too_many_attempts';
}

/**
 * A random 4-digit PIN no other staff member of the business has and that isn't the kiosk manager PIN's prefix.
 * Server-side via `generate_staff_pin` (since P2-04 it also skips the manager PIN's prefix itself, so the plain PIN
 * is not read); before the migrations, generated here from the old PIN list.
 */
export async function generateUniqueEmployeePin(
  client: SupabaseClient,
  businessId: string,
  options?: { excludeEmployeeId?: string }
): Promise<string> {
  // P2-04: only the status field; the plain PIN is selected solely on a pre-P2-04 database (to reserve its prefix).
  const biz = await selectKioskManagerPinRow(client, businessId);

  const mgr = biz?.kiosk_manager_pin;
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
