import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

/** True when month/day match the user's local calendar today (full year not required). */
export function isStaffDobCalendarToday(birthMonth: number, birthDay: number): boolean {
  const n = new Date();
  return birthMonth === n.getMonth() + 1 && birthDay === n.getDate();
}

/** Runs server-side staff birthday notifications for everyone in the business (idempotent per day). */
export async function dispatchStaffBirthdaysForBusiness(
  businessId: string | null | undefined
): Promise<{ error: string | null }> {
  if (!businessId) return { error: null };
  const { error } = await supabase.rpc('dispatch_staff_birthdays_for_business', {
    p_business_id: businessId,
  });
  if (error) devConsole.warn('[dispatchStaffBirthdaysForBusiness]', error.message);
  return { error: error?.message ?? null };
}
