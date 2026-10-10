/**
 * Employee PIN generation and collision checks (unique per business, avoid manager PIN prefix).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EMPLOYEE_PIN_LENGTH, KIOSK_MANAGER_PIN_LENGTH } from '@/lib/pinLengths';
/** Staff columns for PIN uniqueness checks (reads every employee PIN of a business; manager screens only). */
export const STAFF_PIN_COLUMNS = 'id, pin';

/** The business's kiosk manager PIN (kiosk lock/unlock, manager PIN settings and reset). */
export const BUSINESS_KIOSK_MANAGER_PIN_COLUMNS = 'kiosk_manager_pin';

function randomFourDigitPin(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(EMPLOYEE_PIN_LENGTH, '0');
}

export async function fetchEmployeePinsForBusiness(
  client: SupabaseClient,
  businessId: string,
  options?: { excludeEmployeeId?: string }
): Promise<Set<string>> {
  const { data, error } = await client.from('staff').select(STAFF_PIN_COLUMNS).eq('business_id', businessId);
  if (error) throw error;
  const pins = new Set<string>();
  for (const row of data ?? []) {
    if (options?.excludeEmployeeId && row.id === options.excludeEmployeeId) continue;
    const p = row.pin;
    if (typeof p === 'string' && new RegExp(`^\\d{${EMPLOYEE_PIN_LENGTH}}$`).test(p)) {
      pins.add(p);
    }
  }
  return pins;
}

/** True if the first 4 digits of a 6-digit manager PIN match any full employee PIN. */
export function managerPinPrefixCollidesWithEmployeePins(
  managerPinSixDigit: string,
  employeePins: Set<string>
): boolean {
  if (managerPinSixDigit.length !== KIOSK_MANAGER_PIN_LENGTH) return false;
  return employeePins.has(managerPinSixDigit.slice(0, EMPLOYEE_PIN_LENGTH));
}

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

  const mgr = biz?.kiosk_manager_pin;
  const reservedPrefix =
    typeof mgr === 'string' && mgr.length === KIOSK_MANAGER_PIN_LENGTH
      ? mgr.slice(0, EMPLOYEE_PIN_LENGTH)
      : null;

  const used = await fetchEmployeePinsForBusiness(client, businessId, options);

  for (let attempt = 0; attempt < 2500; attempt++) {
    const candidate = randomFourDigitPin();
    if (used.has(candidate)) continue;
    if (reservedPrefix !== null && candidate === reservedPrefix) continue;
    return candidate;
  }
  throw new Error('Could not generate a unique PIN for this business');
}
