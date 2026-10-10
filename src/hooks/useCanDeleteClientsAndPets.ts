import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { useStaff } from '@/hooks/useStaff';
import { canDeleteClientsAndPets, ownStaffAccessRoleForBusiness } from '@/lib/deletePermissions';

/**
 * Whether the signed-in user may delete clients and pets (U23): managers, super admins, and staff whose access_role
 * is admin or manager while their staff row is active (U30). The access_role and status come from the user's own staff
 * row (`useStaff`). Same rule as the database.
 */
export function useCanDeleteClientsAndPets(): boolean {
  const { role, profile } = useAuth();
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const { staffMember } = useStaff();
  const staffAccessRole = ownStaffAccessRoleForBusiness({
    businessId,
    profileStaffId: profile?.staff_id,
    ownStaff: staffMember,
  });
  return canDeleteClientsAndPets({
    role,
    isSuperAdmin: !!profile?.is_super_admin,
    staffAccessRole,
    staffStatus: staffAccessRole ? staffMember?.status : null,
    demoBrowseOnly,
  });
}
