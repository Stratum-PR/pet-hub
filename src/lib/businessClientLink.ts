/**
 * Multi-business pet owner: link an authenticated user to a business.
 * Used after password verification (register linking flow) or from login when not yet linked.
 */

import { supabase } from '@/integrations/supabase/client';

export type LinkStatus = 'approved' | 'revoked';

export interface BusinessClientLinkRow {
  id: string;
  user_id: string;
  business_id: string;
  status: LinkStatus;
  approved_by: string | null;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get the link for (userId, businessId) if it exists.
 */
export async function getBusinessClientLink(
  userId: string,
  businessId: string
): Promise<BusinessClientLinkRow | null> {
  const { data, error } = await supabase
    .from('business_client_links')
    .select('*')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) throw error;
  return data as BusinessClientLinkRow | null;
}

/**
 * Create or re-approve a link. Caller must be authenticated as userId.
 * If link exists and was revoked, updates to approved.
 */
export async function ensureBusinessClientLink(
  userId: string,
  businessId: string,
  approvedBy: string = 'pet_owner'
): Promise<BusinessClientLinkRow> {
  const existing = await getBusinessClientLink(userId, businessId);
  if (existing) {
    if (existing.status === 'approved') return existing;
    const { data, error } = await supabase
      .from('business_client_links')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BusinessClientLinkRow;
  }
  const { data, error } = await supabase
    .from('business_client_links')
    .insert({
      user_id: userId,
      business_id: businessId,
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as BusinessClientLinkRow;
}
