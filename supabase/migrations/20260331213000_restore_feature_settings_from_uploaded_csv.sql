-- Restore feature settings back to uploaded CSV mapping.
-- Use this after accidental overwrite from early draft-state save.

WITH seed(feature_name, roles_label, env_label, subscription_label) AS (
  VALUES
    ('Dashboard', 'All roles', 'Production', 'pro'),
    ('Clients', 'All roles', 'Production', 'pro'),
    ('Pets', 'All roles', 'Production', 'pro'),
    ('Appointments', 'All roles', 'Development', 'pro'),
    ('Appointment Book', 'All roles', 'Development', 'pro'),
    ('Public Self-Booking', 'All roles', 'Development', 'pro'),
    ('Services Catalog', 'All roles', 'Production', 'pro'),
    ('Inventory', 'All roles', 'Development', 'pro'),
    ('Checkout', 'All roles', 'Development', 'pro'),
    ('Payments', 'All roles', 'Development', 'pro'),
    ('Transactions List', 'Manager, Admin, Super Admin', 'Staging', 'pro'),
    ('Transaction Create', 'All roles', 'Staging', 'pro'),
    ('Transaction Detail', 'Manager, Admin, Super Admin', 'Staging', 'pro'),
    ('Notifications', 'All roles', 'Staging', 'pro'),
    ('Help Center', 'All roles', 'Production', 'pro'),
    ('Account Settings', 'All roles', 'Production', 'pro'),
    ('Employee Time Tracking (logged-in)', 'All roles', 'Production', 'pro'),
    ('Time Kiosk (PIN Punch Clock)', 'All roles', 'Production', 'pro'),
    ('Kiosk Lock Mode', 'All roles', 'Production', 'pro'),
    ('Schedule / My Schedule', 'All roles', 'Production', 'pro'),
    ('Employee Payroll View', 'Manager, Admin, Super Admin', 'Production', 'pro'),
    ('Employee Timesheet View', 'Manager, Admin, Super Admin', 'Production', 'pro'),
    ('Employee Management', 'Manager, Admin, Super Admin', 'Production', 'pro'),
    ('Payroll Admin', 'Manager, Admin, Super Admin', 'Production', 'pro'),
    ('Time Edit Approval', 'Manager, Admin, Super Admin', 'Production', 'pro'),
    ('Reports', 'Admin, Super Admin', 'Production', 'pro'),
    ('Business Reports / Analytics', 'Admin, Super Admin', 'Production', 'pro'),
    ('Business Settings', 'Admin, Super Admin', 'Production', 'pro'),
    ('Booking Settings', 'Admin, Super Admin', 'Production', 'pro'),
    ('Kiosk Manager PIN Management', 'Admin, Super Admin', 'Production', 'pro'),
    ('Geofencing Settings', 'Admin, Super Admin', 'Development', 'pro'),
    ('Time Entry Location Display', 'All roles', 'Development', 'pro'),
    ('Admin Dashboard (global)', 'Super Admin', 'Production', 'pro'),
    ('Admin Business List / Tenant Management', 'Super Admin', 'Production', 'pro'),
    ('Impersonation (token-based)', 'Super Admin', 'Production', 'pro'),
    ('Support Begin User Session', 'Super Admin', 'Production', 'pro'),
    ('Support Session Banner / Exit', 'Super Admin', 'Production', 'pro'),
    ('Feature Tier Preview Control (Dev/Staged/Prod toggles)', 'Super Admin', 'Production', 'pro'),
    ('Role Management (admin_set_profile_role flow)', 'Super Admin', 'Production', 'pro'),
    ('Barcode Lookup', 'All roles', 'Development', 'pro'),
    ('Password Reset (rate-limited flow)', 'All roles', 'Production', 'pro')
),
normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    feature_name,
    public.resolve_feature_roles_from_label(roles_label) AS roles,
    ARRAY[lower(trim(subscription_label))]::text[] AS subscription_tiers,
    CASE lower(trim(env_label))
      WHEN 'production' THEN 'production'
      WHEN 'staging' THEN 'staged'
      ELSE 'development'
    END AS min_tier
  FROM seed
)
INSERT INTO public.feature_catalog (feature_key, display_name)
SELECT feature_key, feature_name FROM normalized
ON CONFLICT (feature_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    updated_at = now();

WITH normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    CASE lower(trim(env_label))
      WHEN 'production' THEN 'production'
      WHEN 'staging' THEN 'staged'
      ELSE 'development'
    END AS min_tier
  FROM (VALUES
    ('Dashboard', 'Production'),
    ('Clients', 'Production'),
    ('Pets', 'Production'),
    ('Appointments', 'Development'),
    ('Appointment Book', 'Development'),
    ('Public Self-Booking', 'Development'),
    ('Services Catalog', 'Production'),
    ('Inventory', 'Development'),
    ('Checkout', 'Development'),
    ('Payments', 'Development'),
    ('Transactions List', 'Staging'),
    ('Transaction Create', 'Staging'),
    ('Transaction Detail', 'Staging'),
    ('Notifications', 'Staging'),
    ('Help Center', 'Production'),
    ('Account Settings', 'Production'),
    ('Employee Time Tracking (logged-in)', 'Production'),
    ('Time Kiosk (PIN Punch Clock)', 'Production'),
    ('Kiosk Lock Mode', 'Production'),
    ('Schedule / My Schedule', 'Production'),
    ('Employee Payroll View', 'Production'),
    ('Employee Timesheet View', 'Production'),
    ('Employee Management', 'Production'),
    ('Payroll Admin', 'Production'),
    ('Time Edit Approval', 'Production'),
    ('Reports', 'Production'),
    ('Business Reports / Analytics', 'Production'),
    ('Business Settings', 'Production'),
    ('Booking Settings', 'Production'),
    ('Kiosk Manager PIN Management', 'Production'),
    ('Geofencing Settings', 'Development'),
    ('Time Entry Location Display', 'Development'),
    ('Admin Dashboard (global)', 'Production'),
    ('Admin Business List / Tenant Management', 'Production'),
    ('Impersonation (token-based)', 'Production'),
    ('Support Begin User Session', 'Production'),
    ('Support Session Banner / Exit', 'Production'),
    ('Feature Tier Preview Control (Dev/Staged/Prod toggles)', 'Production'),
    ('Role Management (admin_set_profile_role flow)', 'Production'),
    ('Barcode Lookup', 'Development'),
    ('Password Reset (rate-limited flow)', 'Production')
  ) AS s(feature_name, env_label)
)
INSERT INTO public.feature_rollout(feature_key, min_tier)
SELECT feature_key, min_tier FROM normalized
ON CONFLICT (feature_key) DO UPDATE
SET min_tier = excluded.min_tier, updated_at = now();

WITH normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    public.resolve_feature_roles_from_label(roles_label) AS roles,
    ARRAY['pro']::text[] AS subscription_tiers
  FROM (VALUES
    ('Dashboard', 'All roles'),
    ('Clients', 'All roles'),
    ('Pets', 'All roles'),
    ('Appointments', 'All roles'),
    ('Appointment Book', 'All roles'),
    ('Public Self-Booking', 'All roles'),
    ('Services Catalog', 'All roles'),
    ('Inventory', 'All roles'),
    ('Checkout', 'All roles'),
    ('Payments', 'All roles'),
    ('Transactions List', 'Manager, Admin, Super Admin'),
    ('Transaction Create', 'All roles'),
    ('Transaction Detail', 'Manager, Admin, Super Admin'),
    ('Notifications', 'All roles'),
    ('Help Center', 'All roles'),
    ('Account Settings', 'All roles'),
    ('Employee Time Tracking (logged-in)', 'All roles'),
    ('Time Kiosk (PIN Punch Clock)', 'All roles'),
    ('Kiosk Lock Mode', 'All roles'),
    ('Schedule / My Schedule', 'All roles'),
    ('Employee Payroll View', 'Manager, Admin, Super Admin'),
    ('Employee Timesheet View', 'Manager, Admin, Super Admin'),
    ('Employee Management', 'Manager, Admin, Super Admin'),
    ('Payroll Admin', 'Manager, Admin, Super Admin'),
    ('Time Edit Approval', 'Manager, Admin, Super Admin'),
    ('Reports', 'Admin, Super Admin'),
    ('Business Reports / Analytics', 'Admin, Super Admin'),
    ('Business Settings', 'Admin, Super Admin'),
    ('Booking Settings', 'Admin, Super Admin'),
    ('Kiosk Manager PIN Management', 'Admin, Super Admin'),
    ('Geofencing Settings', 'Admin, Super Admin'),
    ('Time Entry Location Display', 'All roles'),
    ('Admin Dashboard (global)', 'Super Admin'),
    ('Admin Business List / Tenant Management', 'Super Admin'),
    ('Impersonation (token-based)', 'Super Admin'),
    ('Support Begin User Session', 'Super Admin'),
    ('Support Session Banner / Exit', 'Super Admin'),
    ('Feature Tier Preview Control (Dev/Staged/Prod toggles)', 'Super Admin'),
    ('Role Management (admin_set_profile_role flow)', 'Super Admin'),
    ('Barcode Lookup', 'All roles'),
    ('Password Reset (rate-limited flow)', 'All roles')
  ) AS s(feature_name, roles_label)
)
INSERT INTO public.feature_visibility_rules(feature_key, roles, subscription_tiers)
SELECT feature_key, roles, subscription_tiers FROM normalized
ON CONFLICT (feature_key) DO UPDATE
SET roles = excluded.roles,
    subscription_tiers = excluded.subscription_tiers,
    updated_at = now();
