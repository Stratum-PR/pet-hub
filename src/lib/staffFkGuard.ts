import { supabase } from '@/integrations/supabase/client';

/** Returns staff_id only if a row exists for this business (avoids transactions_staff_id_fkey violations). */
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
