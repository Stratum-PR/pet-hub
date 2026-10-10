/**
 * Who may delete clients and pets (decision 9, P2-01 clients/pets, U23).
 *
 * Mirrors the database rule so the Delete button shows exactly when the delete would be allowed:
 * the delete policies use `is_business_manager(business_id)` (20261009120000_staff_rls_rewrite.sql), which is true for
 * a super admin, a profile with role manager/super_admin, or a staff row with access_role admin/manager in that
 * business (`caller_staff_access_role_for_business`) while that staff row is active (U30,
 * 20261010240000_manager_requires_active_staff.sql). Profile managers and super admins don't depend on staff status.
 */

/** The fields of the signed-in user's own staff row that the rule needs. */
export type OwnStaffRow = {
  id: string;
  business_id?: string | null;
  access_role?: string | null;
};

/**
 * The caller's staff access_role in `businessId`, like `caller_staff_access_role_for_business`:
 * when the profile links a staff row (`profiles.staff_id`) only that row counts; otherwise the row linked by
 * `staff.user_id`. `ownStaff` is the user's own row (by user_id); if the profile links a different row we do not
 * have it, so the result is null (button hidden; the database stays the authority).
 */
export function ownStaffAccessRoleForBusiness(args: {
  businessId: string | null | undefined;
  profileStaffId: string | null | undefined;
  ownStaff: OwnStaffRow | null | undefined;
}): string | null {
  const { businessId, profileStaffId, ownStaff } = args;
  if (!businessId || !ownStaff) return null;
  if (profileStaffId && ownStaff.id !== profileStaffId) return null;
  if (ownStaff.business_id !== businessId) return null;
  return ownStaff.access_role ?? null;
}

const MANAGER_PROFILE_ROLES = new Set(['manager', 'super_admin']);
const MANAGER_ACCESS_ROLES = new Set(['admin', 'manager']);

/** True when the Delete buttons for clients and pets should be shown. */
export function canDeleteClientsAndPets(args: {
  role: string | null | undefined;
  isSuperAdmin: boolean;
  staffAccessRole: string | null | undefined;
  /**
   * Status of the staff row `staffAccessRole` came from. 'inactive' (anything but 'active') removes the access_role
   * path, like the database. Missing (not loaded) is not treated as inactive; `useStaff` always loads it.
   */
  staffStatus?: string | null;
  /** Public demo workspace: deletes only change local state, never the database. */
  demoBrowseOnly: boolean;
}): boolean {
  const { role, isSuperAdmin, staffAccessRole, staffStatus, demoBrowseOnly } = args;
  if (demoBrowseOnly || isSuperAdmin) return true;
  if (role && MANAGER_PROFILE_ROLES.has(role)) return true;
  if (staffStatus && staffStatus !== 'active') return false;
  return !!staffAccessRole && MANAGER_ACCESS_ROLES.has(staffAccessRole);
}
