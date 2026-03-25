import { supabase } from '@/integrations/supabase/client';

/** Returns `staff.id` only if that row exists for this business (for FKs that reference `public.staff`). */
export async function staffIdForBusinessOrNull(
  staffId: string | null | undefined,
  businessId: string | null | undefined
): Promise<string | null> {
  if (!staffId || !businessId) return null;
  const { data } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('business_id', businessId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Returns `profiles.id` for `transactions.staff_id` / refund attribution when the FK targets `public.profiles`.
 * `profiles.staff_id` points at `public.staff` and must not be used as `transactions.staff_id`.
 */
export async function profileIdForTransactionFkOrNull(
  profileUserId: string | null | undefined,
  activeBusinessId: string | null | undefined
): Promise<string | null> {
  if (!profileUserId || !activeBusinessId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, business_id, is_super_admin')
    .eq('id', profileUserId)
    .maybeSingle();
  if (!data?.id) return null;
  if (data.is_super_admin) return data.id;
  if (data.business_id === activeBusinessId) return data.id;
  return null;
}
