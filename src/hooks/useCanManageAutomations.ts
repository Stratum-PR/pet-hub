import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/hooks/useSupabaseData';

/**
 * Managers and staff with access role manager/admin can build automations, coupons and reports
 * (same rule as can_manage_automations() in the database, which is what actually enforces it).
 */
export function useCanManageAutomations(): { canManage: boolean; loading: boolean } {
  const { role, profile, staffId } = useAuth();
  const { employees, loading } = useEmployees({ includeSensitive: false });
  return useMemo(() => {
    if (role === 'manager' || role === 'super_admin' || profile?.is_super_admin) return { canManage: true, loading: false };
    const me = staffId ? employees.find((e) => e.id === staffId) : undefined;
    return { canManage: me?.access_role === 'admin' || me?.access_role === 'manager', loading };
  }, [role, profile?.is_super_admin, staffId, employees, loading]);
}
