-- P2-01 (businesses), SECURITY_RISKS S-7a (decided 2026-10-10): only managers/admins update the business row, and the
-- billing columns change only through the service role.
--
-- Before, one UPDATE policy on public.businesses:
--   "Businesses update"  FOR UPDATE TO public  any profile whose business_id is the row (employees, and client profiles
--                                              that carry a business_id) or a super admin
-- so every member could rename the business, change its public slug, store any qr_code (U25's stored XSS), change
-- geofencing and the kiosk manager PIN, and set subscription_tier / subscription_status / stripe_* / trial_ends_at.
--
-- After:
--   businesses_update_managers  FOR UPDATE TO authenticated  is_business_manager(id) (USING and WITH CHECK)
--     is_business_manager (P2-01 staff, 20261009120000) = super admin, profile role manager/super_admin of that
--     business, or staff access_role admin/manager in it. Every manager and super admin who could update before still can.
--   trigger businesses_lock_billing_columns (BEFORE UPDATE): raises 42501 when subscription_tier, subscription_status,
--     trial_ends_at, subscription_ends_at or any stripe_* column changes, unless the request is the service role.
--     Writing the current value again is not a change. INSERT is not touched (complete_manager_signup sets the plan).
--
-- "Service role" = the API request's JWT role (request.jwt.claims ->> 'role', what auth.role() reads) is 'service_role'
-- (edge functions and scripts with the service key). A SECURITY DEFINER function runs as its owner but keeps the
-- caller's JWT, so a user calling a definer function is still 'authenticated' and still blocked; no definer function
-- called by users writes billing columns (complete_manager_signup INSERTs; set_kiosk_manager_pin writes only
-- kiosk_manager_pin). Sessions with no API request at all (SQL editor, migrations, pg_cron: no JWT claims and
-- current_user not anon/authenticated) are also allowed, so the owner can still fix billing by hand.
--
-- Writers of businesses (main, dev, remediation), all still allowed: BusinessSettingsPage (name/slug/phone/maps, QR),
-- GeofencingSettings, BusinessBrandingAssets (logo), KioskManagerPinSettings / KioskManagerPinResetDialog (main: direct
-- update; remediation: set_kiosk_manager_pin, fallback direct update) — all on screens shown only to managers; Register.tsx
-- post-signup QR (new owner: staff access_role admin from complete_manager_signup); service-role scripts and seeds.
-- None writes billing columns. The admin portal only reads businesses.
--
-- Who loses UPDATE: profiles linked to the business that are not managers (employees with access_role staff/contractor,
-- client profiles with a business_id). Their updates now match 0 rows (no error), as RLS does. Super admins lose only
-- billing-column changes through the API (no screen makes them).
--
-- Not changed: SELECT / INSERT / DELETE policies, the updated_at and kiosk-PIN-hash triggers. No slug CHECK here: the
-- production slugs could not be verified from the repo (FIX_LOG has the read-only query).
--
-- Requires 20261009120000_staff_rls_rewrite.sql (is_business_manager). Idempotent.

DO $$
BEGIN
  IF to_regprocedure('public.is_business_manager(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_business_manager(uuid) is missing: apply 20261009120000_staff_rls_rewrite.sql first';
  END IF;
END
$$;

-- ---------- update: managers only ----------

DROP POLICY IF EXISTS "Businesses update" ON public.businesses;
DROP POLICY IF EXISTS businesses_update_managers ON public.businesses;
CREATE POLICY businesses_update_managers ON public.businesses AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.is_business_manager(id))
  WITH CHECK (public.is_business_manager(id));

-- ---------- billing columns: service role only ----------

CREATE OR REPLACE FUNCTION public.businesses_lock_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_changed text;
BEGIN
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
  IF v_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- No API request (SQL editor, migrations, cron): allowed unless the session itself is an API role.
  IF v_role IS NULL AND current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  SELECT string_agg(n.key, ', ' ORDER BY n.key) INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) AS n(key, value)
  WHERE (n.key IN ('subscription_tier', 'subscription_status', 'trial_ends_at', 'subscription_ends_at')
         OR n.key LIKE 'stripe\_%')
    AND n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);

  IF v_changed IS NOT NULL THEN
    RAISE EXCEPTION 'billing columns can only be changed by the billing service (%)', v_changed
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.businesses_lock_billing_columns() IS
  'P2-01 businesses (S-7a): subscription_tier, subscription_status, trial_ends_at, subscription_ends_at and stripe_* change only with the service role (or outside the API).';

REVOKE ALL ON FUNCTION public.businesses_lock_billing_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS businesses_lock_billing_columns ON public.businesses;
CREATE TRIGGER businesses_lock_billing_columns
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.businesses_lock_billing_columns();
