import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { STAFF_PUBLIC_COLUMNS, type StaffPublicRow } from '@/hooks/useSupabaseData';
import { devConsole } from '@/lib/clientDebug';

/** The signed-in employee's own staff row (public columns: no PIN, pay or bank fields) plus its business. */
export type StaffWithBusiness = StaffPublicRow & {
  businesses?: { slug: string | null; name: string } | null;
};

const OWN_STAFF_COLUMNS = `${STAFF_PUBLIC_COLUMNS}, businesses (slug, name)`;

export function useStaff() {
  const { user } = useAuth();
  const [staffMember, setStaffMember] = useState<StaffWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStaff() {
      if (!user?.id) {
        setStaffMember(null);
        setLoading(false);
        return;
      }
      try {
        const { data, error: queryError } = await supabase
          .from('staff')
          .select(OWN_STAFF_COLUMNS)
          .eq('user_id', user.id)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!data) {
          setStaffMember(null);
          return;
        }
        const row = data as Record<string, unknown>;
        const biz = row.businesses as { slug: string | null; name: string } | { slug: string | null; name: string }[] | null | undefined;
        const businesses = Array.isArray(biz) ? biz[0] ?? null : biz ?? null;
        const { businesses: _b, ...rest } = row;
        setStaffMember({ ...(rest as unknown as StaffPublicRow), businesses });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error loading staff';
        devConsole.error('useStaff:', err);
        setError(message);
        setStaffMember(null);
      } finally {
        setLoading(false);
      }
    }
    void fetchStaff();
  }, [user?.id]);

  return { staffMember, loading, error };
}
