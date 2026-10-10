import { describe, expect, it } from 'vitest';
import { canDeleteClientsAndPets, ownStaffAccessRoleForBusiness } from './deletePermissions';

const BIZ = 'biz-1';
const OTHER = 'biz-2';

describe('ownStaffAccessRoleForBusiness (mirrors caller_staff_access_role_for_business)', () => {
  it('returns null without a staff row or business', () => {
    expect(ownStaffAccessRoleForBusiness({ businessId: BIZ, profileStaffId: null, ownStaff: null })).toBeNull();
    expect(
      ownStaffAccessRoleForBusiness({
        businessId: null,
        profileStaffId: null,
        ownStaff: { id: 's1', business_id: BIZ, access_role: 'manager' },
      }),
    ).toBeNull();
  });

  it("uses the profile's linked staff row when it is in this business", () => {
    expect(
      ownStaffAccessRoleForBusiness({
        businessId: BIZ,
        profileStaffId: 's1',
        ownStaff: { id: 's1', business_id: BIZ, access_role: 'admin' },
      }),
    ).toBe('admin');
  });

  it("returns null when the profile links a different staff row than the user's own row", () => {
    expect(
      ownStaffAccessRoleForBusiness({
        businessId: BIZ,
        profileStaffId: 's2',
        ownStaff: { id: 's1', business_id: BIZ, access_role: 'manager' },
      }),
    ).toBeNull();
  });

  it('falls back to the staff row linked by user_id when the profile has no staff_id', () => {
    expect(
      ownStaffAccessRoleForBusiness({
        businessId: BIZ,
        profileStaffId: null,
        ownStaff: { id: 's1', business_id: BIZ, access_role: 'manager' },
      }),
    ).toBe('manager');
  });

  it('ignores a staff row in another business', () => {
    expect(
      ownStaffAccessRoleForBusiness({
        businessId: BIZ,
        profileStaffId: 's1',
        ownStaff: { id: 's1', business_id: OTHER, access_role: 'admin' },
      }),
    ).toBeNull();
  });
});

describe('canDeleteClientsAndPets (mirrors is_business_manager)', () => {
  const base = { role: 'employee' as const, isSuperAdmin: false, staffAccessRole: null, demoBrowseOnly: false };

  it('allows super admins', () => {
    expect(canDeleteClientsAndPets({ ...base, isSuperAdmin: true })).toBe(true);
  });

  it('allows profile role manager and super_admin', () => {
    expect(canDeleteClientsAndPets({ ...base, role: 'manager' })).toBe(true);
    expect(canDeleteClientsAndPets({ ...base, role: 'super_admin' })).toBe(true);
  });

  it('allows employees whose staff access_role is manager or admin', () => {
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'manager' })).toBe(true);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'admin' })).toBe(true);
  });

  it('refuses employees whose staff access_role is staff, contractor or unknown', () => {
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'staff' })).toBe(false);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'contractor' })).toBe(false);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: null })).toBe(false);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'Manager' })).toBe(false);
  });

  it('refuses client profiles and an unknown role', () => {
    expect(canDeleteClientsAndPets({ ...base, role: 'client' })).toBe(false);
    expect(canDeleteClientsAndPets({ ...base, role: undefined })).toBe(false);
  });

  it('allows the public demo workspace (deletes stay local there)', () => {
    expect(canDeleteClientsAndPets({ ...base, role: undefined, demoBrowseOnly: true })).toBe(true);
  });

  it('refuses staff with access_role manager or admin whose staff row is inactive (U30)', () => {
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'manager', staffStatus: 'inactive' })).toBe(false);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'admin', staffStatus: 'inactive' })).toBe(false);
  });

  it('allows active staff with access_role manager or admin (U30)', () => {
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'manager', staffStatus: 'active' })).toBe(true);
    expect(canDeleteClientsAndPets({ ...base, staffAccessRole: 'admin', staffStatus: 'active' })).toBe(true);
  });

  it('keeps profile managers and super admins whose own staff row is inactive (U30)', () => {
    expect(canDeleteClientsAndPets({ ...base, role: 'manager', staffAccessRole: 'admin', staffStatus: 'inactive' })).toBe(true);
    expect(canDeleteClientsAndPets({ ...base, isSuperAdmin: true, staffAccessRole: 'staff', staffStatus: 'inactive' })).toBe(true);
  });
});
