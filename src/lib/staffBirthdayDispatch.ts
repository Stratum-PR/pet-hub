import { supabase } from '@/integrations/supabase/client';

/** True when month/day match the user's local calendar today (full year not required). */
export function isStaffDobCalendarToday(birthMonth: number, birthDay: number): boolean {
  const n = new Date();
  return birthMonth === n.getMonth() + 1 && birthDay === n.getDate();
}

/** Runs server-side staff birthday notifications for everyone in the business (idempotent per day). */
export async function dispatchStaffBirthdaysForBusiness(businessId: string | null | undefined): Promise<void> {
  if (!businessId) return;
  const { error } = await supabase.rpc('dispatch_staff_birthdays_for_business', {
    p_business_id: businessId,
  });
  if (error && import.meta.env.DEV) console.warn('[dispatchStaffBirthdaysForBusiness]', error.message);
}

/** Daily reminder to managers: active staff missing email (RPC inserts per manager, deduped per local day). */
export async function dispatchStaffMissingEmailReminders(
  businessId: string | null | undefined
): Promise<void> {
  if (!businessId) return;
  const { error } = await supabase.rpc('dispatch_staff_missing_email_reminders', {
    p_business_id: businessId,
  });
  if (error && import.meta.env.DEV) console.warn('[dispatchStaffMissingEmailReminders]', error.message);
}
