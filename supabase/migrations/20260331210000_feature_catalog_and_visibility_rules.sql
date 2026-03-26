-- Generic feature settings model:
-- - feature_catalog: canonical feature registry
-- - feature_rollout: environment tier activation
-- - feature_visibility_rules: role/subscription visibility
-- Seeded from feature_tags.csv provided by product.

CREATE OR REPLACE FUNCTION public.normalize_feature_key(p_display_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '_' FROM regexp_replace(lower(coalesce(p_display_name, '')), '[^a-z0-9]+', '_', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.feature_catalog (
  feature_key text PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_rollout
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rollout keys (ex: legacy geofencing row) before FK creation.
INSERT INTO public.feature_catalog(feature_key, display_name)
SELECT fr.feature_key, initcap(replace(fr.feature_key, '_', ' '))
FROM public.feature_rollout fr
LEFT JOIN public.feature_catalog fc ON fc.feature_key = fr.feature_key
WHERE fc.feature_key IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_rollout_feature_key_fk'
  ) THEN
    ALTER TABLE public.feature_rollout
      ADD CONSTRAINT feature_rollout_feature_key_fk
      FOREIGN KEY (feature_key) REFERENCES public.feature_catalog(feature_key)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.feature_visibility_rules (
  feature_key text PRIMARY KEY REFERENCES public.feature_catalog(feature_key) ON DELETE CASCADE,
  roles text[] NOT NULL DEFAULT ARRAY['super_admin']::text[],
  subscription_tiers text[] NOT NULL DEFAULT ARRAY['standard']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (array_length(roles, 1) IS NOT NULL),
  CHECK (array_length(subscription_tiers, 1) IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_catalog_set_updated_at ON public.feature_catalog;
CREATE TRIGGER feature_catalog_set_updated_at
BEFORE UPDATE ON public.feature_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS feature_rollout_set_updated_at ON public.feature_rollout;
CREATE TRIGGER feature_rollout_set_updated_at
BEFORE UPDATE ON public.feature_rollout
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS feature_visibility_rules_set_updated_at ON public.feature_visibility_rules;
CREATE TRIGGER feature_visibility_rules_set_updated_at
BEFORE UPDATE ON public.feature_visibility_rules
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.feature_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_visibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_catalog_select_authenticated ON public.feature_catalog;
CREATE POLICY feature_catalog_select_authenticated
ON public.feature_catalog
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS feature_catalog_manage_super_admin ON public.feature_catalog;
CREATE POLICY feature_catalog_manage_super_admin
ON public.feature_catalog
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

DROP POLICY IF EXISTS feature_visibility_rules_select_authenticated ON public.feature_visibility_rules;
CREATE POLICY feature_visibility_rules_select_authenticated
ON public.feature_visibility_rules
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS feature_visibility_rules_manage_super_admin ON public.feature_visibility_rules;
CREATE POLICY feature_visibility_rules_manage_super_admin
ON public.feature_visibility_rules
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

DROP POLICY IF EXISTS feature_rollout_manage_super_admin ON public.feature_rollout;
CREATE POLICY feature_rollout_manage_super_admin
ON public.feature_rollout
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true));

CREATE OR REPLACE FUNCTION public.resolve_feature_roles_from_label(p_roles_label text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_label text := coalesce(p_roles_label, '');
  v_roles text[] := ARRAY[]::text[];
BEGIN
  IF lower(trim(v_label)) = 'all roles' THEN
    RETURN ARRAY['*']::text[];
  END IF;

  IF position('Manager' IN v_label) > 0 THEN
    v_roles := array_append(v_roles, 'manager');
  END IF;
  -- "Admin" from CSV maps to existing app role enum ("manager").
  IF position('Admin' IN v_label) > 0 THEN
    v_roles := array_append(v_roles, 'manager');
  END IF;
  IF position('Super Admin' IN v_label) > 0 THEN
    v_roles := array_append(v_roles, 'super_admin');
  END IF;
  IF position('Employee' IN v_label) > 0 THEN
    v_roles := array_append(v_roles, 'employee');
  END IF;
  IF position('Client' IN v_label) > 0 THEN
    v_roles := array_append(v_roles, 'client');
  END IF;

  v_roles := (SELECT ARRAY(SELECT DISTINCT unnest(v_roles)));
  IF array_length(v_roles, 1) IS NULL THEN
    RETURN ARRAY['super_admin']::text[];
  END IF;
  RETURN v_roles;
END;
$$;

CREATE OR REPLACE FUNCTION public.feature_role_visible(p_feature_key text, p_role text, p_is_super_admin boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN vr.roles IS NULL THEN false
    WHEN '*' = ANY(vr.roles) THEN true
    WHEN coalesce(p_is_super_admin, false) AND 'super_admin' = ANY(vr.roles) THEN true
    ELSE coalesce(p_role, 'client') = ANY(vr.roles)
  END
  FROM public.feature_visibility_rules vr
  WHERE vr.feature_key = p_feature_key;
$$;

CREATE OR REPLACE FUNCTION public.feature_subscription_visible(p_feature_key text, p_subscription_tier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN vr.subscription_tiers IS NULL THEN false
    WHEN '*' = ANY(vr.subscription_tiers) THEN true
    ELSE lower(trim(coalesce(p_subscription_tier, 'standard'))) = ANY(vr.subscription_tiers)
  END
  FROM public.feature_visibility_rules vr
  WHERE vr.feature_key = p_feature_key;
$$;

CREATE OR REPLACE FUNCTION public.feature_is_visible(p_feature_key text, p_viewer_tier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_viewer_tier, 'production')))
    WHEN 'production' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') = 'production'
    WHEN 'staged' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') IN ('production', 'staged')
    WHEN 'development' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') IN ('production', 'staged', 'development')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.feature_is_active(p_feature_key text, p_viewer_tier text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.feature_is_visible(p_feature_key, p_viewer_tier);
$$;

CREATE OR REPLACE FUNCTION public.feature_is_available_for_session(
  p_feature_key text,
  p_viewer_tier text,
  p_role text,
  p_is_super_admin boolean DEFAULT false,
  p_subscription_tier text DEFAULT 'standard'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.feature_is_visible(p_feature_key, p_viewer_tier)
    AND COALESCE(public.feature_role_visible(p_feature_key, p_role, p_is_super_admin), false)
    AND COALESCE(public.feature_subscription_visible(p_feature_key, p_subscription_tier), false);
$$;

WITH seed(feature_name, roles_label, env_label) AS (
  VALUES
    ('Dashboard', 'All roles', 'Production'),
    ('Clients', 'All roles', 'Production'),
    ('Pets', 'All roles', 'Production'),
    ('Appointments', 'All roles', 'Development'),
    ('Appointment Book', 'All roles', 'Development'),
    ('Public Self-Booking', 'All roles', 'Development'),
    ('Services Catalog', 'All roles', 'Production'),
    ('Inventory', 'All roles', 'Development'),
    ('Checkout', 'All roles', 'Development'),
    ('Payments', 'All roles', 'Development'),
    ('Transactions List', 'Manager, Admin, Super Admin', 'Staging'),
    ('Transaction Create', 'All roles', 'Staging'),
    ('Transaction Detail', 'Manager, Admin, Super Admin', 'Staging'),
    ('Notifications', 'All roles', 'Staging'),
    ('Help Center', 'All roles', 'Production'),
    ('Account Settings', 'All roles', 'Production'),
    ('Employee Time Tracking (logged-in)', 'All roles', 'Production'),
    ('Time Kiosk (PIN Punch Clock)', 'All roles', 'Production'),
    ('Kiosk Lock Mode', 'All roles', 'Production'),
    ('Schedule / My Schedule', 'All roles', 'Production'),
    ('Employee Payroll View', 'Manager, Admin, Super Admin', 'Production'),
    ('Employee Timesheet View', 'Manager, Admin, Super Admin', 'Production'),
    ('Employee Management', 'Manager, Admin, Super Admin', 'Production'),
    ('Payroll Admin', 'Manager, Admin, Super Admin', 'Production'),
    ('Time Edit Approval', 'Manager, Admin, Super Admin', 'Production'),
    ('Reports', 'Admin, Super Admin', 'Production'),
    ('Business Reports / Analytics', 'Admin, Super Admin', 'Production'),
    ('Business Settings', 'Admin, Super Admin', 'Production'),
    ('Booking Settings', 'Admin, Super Admin', 'Production'),
    ('Kiosk Manager PIN Management', 'Admin, Super Admin', 'Production'),
    ('Geofencing Settings', 'Admin, Super Admin', 'Development'),
    ('Time Entry Location Display', 'All roles', 'Development'),
    ('Admin Dashboard (global)', 'Super Admin', 'Production'),
    ('Admin Business List / Tenant Management', 'Super Admin', 'Production'),
    ('Impersonation (token-based)', 'Super Admin', 'Production'),
    ('Support Begin User Session', 'Super Admin', 'Production'),
    ('Support Session Banner / Exit', 'Super Admin', 'Production'),
    ('Feature Tier Preview Control (Dev/Staged/Prod toggles)', 'Super Admin', 'Production'),
    ('Role Management (admin_set_profile_role flow)', 'Super Admin', 'Production'),
    ('Barcode Lookup', 'All roles', 'Development'),
    ('Password Reset (rate-limited flow)', 'All roles', 'Production')
), normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    feature_name,
    public.resolve_feature_roles_from_label(roles_label) AS roles,
    ARRAY['standard']::text[] AS subscription_tiers,
    CASE lower(trim(env_label))
      WHEN 'production' THEN 'production'
      WHEN 'staging' THEN 'staged'
      ELSE 'development'
    END AS min_tier
  FROM seed
)
INSERT INTO public.feature_catalog(feature_key, display_name)
SELECT feature_key, feature_name
FROM normalized
ON CONFLICT (feature_key) DO UPDATE
SET display_name = excluded.display_name, updated_at = now();

WITH normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    public.resolve_feature_roles_from_label(roles_label) AS roles,
    ARRAY['standard']::text[] AS subscription_tiers,
    CASE lower(trim(env_label))
      WHEN 'production' THEN 'production'
      WHEN 'staging' THEN 'staged'
      ELSE 'development'
    END AS min_tier
  FROM (VALUES
    ('Dashboard', 'All roles', 'Production'),
    ('Clients', 'All roles', 'Production'),
    ('Pets', 'All roles', 'Production'),
    ('Appointments', 'All roles', 'Development'),
    ('Appointment Book', 'All roles', 'Development'),
    ('Public Self-Booking', 'All roles', 'Development'),
    ('Services Catalog', 'All roles', 'Production'),
    ('Inventory', 'All roles', 'Development'),
    ('Checkout', 'All roles', 'Development'),
    ('Payments', 'All roles', 'Development'),
    ('Transactions List', 'Manager, Admin, Super Admin', 'Staging'),
    ('Transaction Create', 'All roles', 'Staging'),
    ('Transaction Detail', 'Manager, Admin, Super Admin', 'Staging'),
    ('Notifications', 'All roles', 'Staging'),
    ('Help Center', 'All roles', 'Production'),
    ('Account Settings', 'All roles', 'Production'),
    ('Employee Time Tracking (logged-in)', 'All roles', 'Production'),
    ('Time Kiosk (PIN Punch Clock)', 'All roles', 'Production'),
    ('Kiosk Lock Mode', 'All roles', 'Production'),
    ('Schedule / My Schedule', 'All roles', 'Production'),
    ('Employee Payroll View', 'Manager, Admin, Super Admin', 'Production'),
    ('Employee Timesheet View', 'Manager, Admin, Super Admin', 'Production'),
    ('Employee Management', 'Manager, Admin, Super Admin', 'Production'),
    ('Payroll Admin', 'Manager, Admin, Super Admin', 'Production'),
    ('Time Edit Approval', 'Manager, Admin, Super Admin', 'Production'),
    ('Reports', 'Admin, Super Admin', 'Production'),
    ('Business Reports / Analytics', 'Admin, Super Admin', 'Production'),
    ('Business Settings', 'Admin, Super Admin', 'Production'),
    ('Booking Settings', 'Admin, Super Admin', 'Production'),
    ('Kiosk Manager PIN Management', 'Admin, Super Admin', 'Production'),
    ('Geofencing Settings', 'Admin, Super Admin', 'Development'),
    ('Time Entry Location Display', 'All roles', 'Development'),
    ('Admin Dashboard (global)', 'Super Admin', 'Production'),
    ('Admin Business List / Tenant Management', 'Super Admin', 'Production'),
    ('Impersonation (token-based)', 'Super Admin', 'Production'),
    ('Support Begin User Session', 'Super Admin', 'Production'),
    ('Support Session Banner / Exit', 'Super Admin', 'Production'),
    ('Feature Tier Preview Control (Dev/Staged/Prod toggles)', 'Super Admin', 'Production'),
    ('Role Management (admin_set_profile_role flow)', 'Super Admin', 'Production'),
    ('Barcode Lookup', 'All roles', 'Development'),
    ('Password Reset (rate-limited flow)', 'All roles', 'Production')
  ) AS s(feature_name, roles_label, env_label)
)
INSERT INTO public.feature_rollout(feature_key, min_tier)
SELECT feature_key, min_tier FROM normalized
ON CONFLICT (feature_key) DO UPDATE
SET min_tier = excluded.min_tier, updated_at = now();

WITH normalized AS (
  SELECT
    public.normalize_feature_key(feature_name) AS feature_key,
    public.resolve_feature_roles_from_label(roles_label) AS roles,
    ARRAY['standard']::text[] AS subscription_tiers
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
SET roles = excluded.roles, subscription_tiers = excluded.subscription_tiers, updated_at = now();

-- Keep compatibility with previous single-key geofencing rollout.
INSERT INTO public.feature_catalog(feature_key, display_name)
VALUES ('geofencing', 'Geofencing')
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.feature_visibility_rules(feature_key, roles, subscription_tiers)
VALUES ('geofencing', ARRAY['manager', 'super_admin']::text[], ARRAY['standard']::text[])
ON CONFLICT (feature_key) DO NOTHING;
