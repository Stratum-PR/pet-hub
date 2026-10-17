-- Automations v2: per-business automations (templates + builder), coupons (gifts and discount codes,
-- usable at checkout and when booking online) and the grooming follow-up call list.
--
-- Expand-only: new columns (nullable or with defaults), new tables, new functions, wider CHECK lists.
-- One policy is narrowed: managers could read every automation row; now they read Grumi's (business_id IS NULL)
-- plus their own business's. Before this migration no business rows exist, so nothing visible today changes.
-- Requires 20261010200000_automations.sql.

-- ---------------------------------------------------------------------------
-- 1) automations: business-owned rules, schedule, conditions
-- ---------------------------------------------------------------------------
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_cursor timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check CHECK (trigger_type IN (
  'schedule', 'pet_birthday', 'client_inactive', 'grooming_due', 'appointment_before', 'appointment_after',
  'appointment_status', 'booking_request', 'new_client', 'new_pet', 'sale_completed', 'refund_issued',
  'payment_failed', 'low_stock', 'off_schedule_clock_in', 'missed_clock_out', 'shift_change_request',
  'time_edit_request', 'staff_birthday',
  'trial_ending', 'subscription_past_due', 'business_inactive', 'onboarding_incomplete'
));

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_action_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_action_type_check CHECK (action_type IN (
  'email_owner', 'message_client', 'email_team', 'notify_team', 'send_report', 'email_business'
));

-- Grumi-only triggers can't be used by a business.
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_platform_triggers_only_for_grumi;
ALTER TABLE public.automations ADD CONSTRAINT automations_platform_triggers_only_for_grumi CHECK (
  business_id IS NULL
  OR (trigger_type NOT IN ('trial_ending', 'subscription_past_due', 'business_inactive', 'onboarding_incomplete')
      AND action_type <> 'email_business')
);

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_name_length;
ALTER TABLE public.automations ADD CONSTRAINT automations_name_length CHECK (length(name) BETWEEN 1 AND 120);

CREATE INDEX IF NOT EXISTS automations_business ON public.automations (business_id) WHERE business_id IS NOT NULL;

-- Who may build automations, coupons and reports for a business: managers and staff with access role manager/admin.
CREATE OR REPLACE FUNCTION public.can_manage_automations(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR (
      p_business_id IS NOT NULL
      AND public.get_my_business_id() = p_business_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager', 'super_admin'))
        OR coalesce(public.caller_staff_access_role_for_business(p_business_id), '') IN ('manager', 'admin')
      )
    );
$$;
REVOKE ALL ON FUNCTION public.can_manage_automations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_automations(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS automations_managers_read ON public.automations;
CREATE POLICY automations_managers_read ON public.automations
  FOR SELECT TO authenticated
  USING (
    (business_id IS NULL AND public.profile_is_manager_or_super_admin(auth.uid()))
    OR (business_id IS NOT NULL AND public.can_manage_automations(business_id))
  );

DROP POLICY IF EXISTS automations_business_manage ON public.automations;
CREATE POLICY automations_business_manage ON public.automations
  FOR ALL TO authenticated
  USING (business_id IS NOT NULL AND public.can_manage_automations(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.can_manage_automations(business_id));

-- Run log: generic subject key (pet, client, appointment, sale, product…) and business visibility.
ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS subject_key text;

ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_status_check;
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_status_check
  CHECK (status IN ('sent', 'failed', 'test', 'skipped'));

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_once_per_subject
  ON public.automation_runs (automation_id, subject_key, occurrence_key)
  WHERE status = 'sent' AND subject_key IS NOT NULL;

DROP POLICY IF EXISTS automation_runs_business_read ON public.automation_runs;
CREATE POLICY automation_runs_business_read ON public.automation_runs
  FOR SELECT TO authenticated
  USING (business_id IS NOT NULL AND public.can_manage_automations(business_id));

-- ---------------------------------------------------------------------------
-- 2) Coupons
-- ---------------------------------------------------------------------------
-- An offer the business defines (10% off, $5 off, a free bath, a free product), with either one shared code
-- the business chooses (e.g. CUMPLE10) or unique per-client codes issued by automations.
CREATE TABLE IF NOT EXISTS public.coupon_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('percent', 'amount', 'free_service', 'free_product')),
  value numeric(10, 2),
  service_id text,
  product_id uuid REFERENCES public.inventory(id) ON DELETE SET NULL,
  code_mode text NOT NULL DEFAULT 'unique' CHECK (code_mode IN ('unique', 'shared')),
  shared_code text,
  valid_days integer CHECK (valid_days IS NULL OR valid_days BETWEEN 1 AND 365),
  starts_on date,
  expires_on date,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  one_per_client boolean NOT NULL DEFAULT true,
  online_booking boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupon_offers_value_by_kind CHECK (
    (kind = 'percent' AND value > 0 AND value <= 100)
    OR (kind = 'amount' AND value > 0 AND value <= 10000)
    OR (kind = 'free_service' AND service_id IS NOT NULL)
    OR (kind = 'free_product' AND product_id IS NOT NULL)
  ),
  CONSTRAINT coupon_offers_shared_code CHECK (
    (code_mode = 'unique' AND shared_code IS NULL)
    OR (code_mode = 'shared' AND shared_code ~ '^[A-Z0-9-]{3,20}$')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_offers_shared_code_unique
  ON public.coupon_offers (business_id, shared_code) WHERE shared_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupon_offers_business ON public.coupon_offers (business_id);

-- Unique codes issued to one client (by an automation or by staff).
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.coupon_offers(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{4,24}$'),
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'void')),
  redeemed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (business_id, code)
);
CREATE INDEX IF NOT EXISTS coupons_client ON public.coupons (business_id, client_id);
CREATE INDEX IF NOT EXISTS coupons_offer ON public.coupons (offer_id);

-- Every use of a coupon (unique or shared), with the sale it discounted.
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.coupon_offers(id) ON DELETE CASCADE,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  appointment_id text,
  code text NOT NULL,
  discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_one_per_coupon
  ON public.coupon_redemptions (coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupon_redemptions_offer ON public.coupon_redemptions (offer_id, client_id);

-- A code typed when booking online is kept on the appointment; it is redeemed at checkout.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_offer_id uuid REFERENCES public.coupon_offers(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS coupon_offers_touch ON public.coupon_offers;
CREATE TRIGGER coupon_offers_touch BEFORE UPDATE ON public.coupon_offers
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch_updated_at();

ALTER TABLE public.coupon_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Everyone in the business can see offers and codes (checkout); only automation managers create or change them.
DROP POLICY IF EXISTS coupon_offers_read ON public.coupon_offers;
CREATE POLICY coupon_offers_read ON public.coupon_offers
  FOR SELECT TO authenticated USING (public.can_access_business(business_id));
DROP POLICY IF EXISTS coupon_offers_manage ON public.coupon_offers;
CREATE POLICY coupon_offers_manage ON public.coupon_offers
  FOR ALL TO authenticated
  USING (public.can_manage_automations(business_id))
  WITH CHECK (public.can_manage_automations(business_id));

DROP POLICY IF EXISTS coupons_read ON public.coupons;
CREATE POLICY coupons_read ON public.coupons
  FOR SELECT TO authenticated USING (public.can_access_business(business_id));
DROP POLICY IF EXISTS coupons_manage ON public.coupons;
CREATE POLICY coupons_manage ON public.coupons
  FOR ALL TO authenticated
  USING (public.can_manage_automations(business_id))
  WITH CHECK (public.can_manage_automations(business_id) AND status IN ('active', 'void'));

DROP POLICY IF EXISTS coupon_redemptions_read ON public.coupon_redemptions;
CREATE POLICY coupon_redemptions_read ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (public.can_access_business(business_id));
-- No direct writes: redemptions go through redeem_coupon().

REVOKE ALL ON public.coupon_offers, public.coupons, public.coupon_redemptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupon_redemptions TO authenticated;

-- Shared validation. Returns jsonb: { ok, reason?, offer_id, coupon_id, code, kind, value, service_id, product_id,
-- name, service_name, product_name, expires }. reason: invalid | used | used_up | expired | not_started | inactive |
-- not_yours | not_online. Not callable directly.
CREATE OR REPLACE FUNCTION public.coupon_lookup(
  p_business_id uuid,
  p_code text,
  p_client_id uuid,
  p_phone text,
  p_online boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_tz text;
  v_today date;
  v_client uuid := p_client_id;
  c public.coupons%ROWTYPE;
  o public.coupon_offers%ROWTYPE;
  v_uses integer;
  v_info jsonb;
BEGIN
  IF p_business_id IS NULL OR length(v_code) < 3 OR length(v_code) > 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT coalesce(nullif(s.timezone, ''), 'America/Puerto_Rico') INTO v_tz FROM public.settings s WHERE s.business_id = p_business_id;
  v_today := (now() AT TIME ZONE coalesce(v_tz, 'America/Puerto_Rico'))::date;

  -- Client from phone (public booking) when no id was given.
  IF v_client IS NULL AND length(v_phone) = 10 THEN
    SELECT cl.id INTO v_client FROM public.clients cl
    WHERE cl.business_id = p_business_id
      AND right(regexp_replace(coalesce(cl.phone, ''), '\D', '', 'g'), 10) = v_phone
      AND cl.merged_into_client_id IS NULL
    ORDER BY cl.created_at ASC LIMIT 1;
  END IF;

  SELECT * INTO c FROM public.coupons WHERE business_id = p_business_id AND code = v_code;
  IF FOUND THEN
    SELECT * INTO o FROM public.coupon_offers WHERE id = c.offer_id;
  ELSE
    SELECT * INTO o FROM public.coupon_offers
    WHERE business_id = p_business_id AND code_mode = 'shared' AND shared_code = v_code;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;
  END IF;

  v_info := jsonb_build_object(
    'offer_id', o.id,
    'coupon_id', c.id,
    'code', v_code,
    'kind', o.kind,
    'value', o.value,
    'service_id', o.service_id,
    'product_id', o.product_id,
    'name', o.name,
    'service_name', (SELECT sv.name FROM public.services sv WHERE sv.id::text = o.service_id AND sv.business_id = p_business_id),
    'product_name', (SELECT i.product_name FROM public.inventory i WHERE i.id = o.product_id AND i.business_id = p_business_id),
    'expires', coalesce(to_char(c.expires_at AT TIME ZONE coalesce(v_tz, 'America/Puerto_Rico'), 'YYYY-MM-DD'), o.expires_on::text)
  );

  IF NOT o.active THEN
    RETURN v_info || jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;
  IF p_online AND NOT o.online_booking THEN
    RETURN v_info || jsonb_build_object('ok', false, 'reason', 'not_online');
  END IF;
  IF o.starts_on IS NOT NULL AND v_today < o.starts_on THEN
    RETURN v_info || jsonb_build_object('ok', false, 'reason', 'not_started');
  END IF;
  IF o.expires_on IS NOT NULL AND v_today > o.expires_on THEN
    RETURN v_info || jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF c.id IS NOT NULL THEN
    IF c.status = 'redeemed' THEN
      RETURN v_info || jsonb_build_object('ok', false, 'reason', 'used');
    ELSIF c.status <> 'active' THEN
      RETURN v_info || jsonb_build_object('ok', false, 'reason', 'invalid');
    END IF;
    IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
      RETURN v_info || jsonb_build_object('ok', false, 'reason', 'expired');
    END IF;
    -- A personal code only works for its client.
    IF c.client_id IS NOT NULL AND (v_client IS NULL OR v_client <> c.client_id) THEN
      RETURN v_info || jsonb_build_object('ok', false, 'reason', 'not_yours');
    END IF;
  ELSE
    IF o.max_uses IS NOT NULL THEN
      SELECT count(*) INTO v_uses FROM public.coupon_redemptions r WHERE r.offer_id = o.id;
      IF v_uses >= o.max_uses THEN
        RETURN v_info || jsonb_build_object('ok', false, 'reason', 'used_up');
      END IF;
    END IF;
    IF o.one_per_client AND v_client IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.coupon_redemptions r WHERE r.offer_id = o.id AND r.client_id = v_client
    ) THEN
      RETURN v_info || jsonb_build_object('ok', false, 'reason', 'used');
    END IF;
  END IF;

  RETURN v_info || jsonb_build_object('ok', true, 'client_id', v_client);
END;
$$;
REVOKE ALL ON FUNCTION public.coupon_lookup(uuid, text, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coupon_lookup(uuid, text, uuid, text, boolean) TO service_role;

-- Public booking page: show the coupon field only when the business has an offer usable online.
CREATE OR REPLACE FUNCTION public.booking_coupons_enabled(p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coupon_offers o
    WHERE o.business_id = public.resolve_public_business_id(p_slug)
      AND o.active AND o.online_booking
  );
$$;
REVOKE ALL ON FUNCTION public.booking_coupons_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_coupons_enabled(text) TO anon, authenticated;

-- Public booking page: check a code (personal codes need the phone of the client they were issued to).
-- Returns only what the page shows: { valid, reason?, kind, value, name, service_name, product_name, expires }.
CREATE OR REPLACE FUNCTION public.check_booking_coupon(p_slug text, p_code text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid := public.resolve_public_business_id(p_slug);
  r jsonb;
BEGIN
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;
  r := public.coupon_lookup(v_business_id, p_code, NULL, p_phone, true);
  IF coalesce((r->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('valid', true, 'kind', r->'kind', 'value', r->'value', 'name', r->'name',
      'service_name', r->'service_name', 'product_name', r->'product_name', 'expires', r->'expires');
  END IF;
  -- Don't reveal details of codes that aren't usable by this person.
  RETURN jsonb_build_object('valid', false, 'reason', CASE WHEN r->>'reason' IN ('expired', 'used', 'used_up') THEN r->>'reason' ELSE 'invalid' END);
END;
$$;
REVOKE ALL ON FUNCTION public.check_booking_coupon(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_booking_coupon(text, text, text) TO anon, authenticated;

-- Public booking page: right after submit_booking_request, keep a valid code on the new appointment.
CREATE OR REPLACE FUNCTION public.attach_booking_coupon(p_slug text, p_appointment_id text, p_code text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid := public.resolve_public_business_id(p_slug);
  v_phone text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_client uuid;
  r jsonb;
BEGIN
  IF v_business_id IS NULL OR p_appointment_id IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'reason', 'invalid');
  END IF;
  SELECT a.client_id INTO v_client
  FROM public.appointments a
  JOIN public.clients cl ON cl.id = a.client_id
  WHERE a.id = p_appointment_id
    AND a.business_id = v_business_id
    AND a.booking_source = 'online'
    AND a.status = 'pending'
    AND a.coupon_code IS NULL
    AND a.created_at > now() - interval '15 minutes'
    AND right(regexp_replace(coalesce(cl.phone, ''), '\D', '', 'g'), 10) = v_phone;
  IF v_client IS NULL THEN
    RETURN jsonb_build_object('attached', false, 'reason', 'invalid');
  END IF;
  r := public.coupon_lookup(v_business_id, p_code, v_client, NULL, true);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('attached', false, 'reason', coalesce(r->>'reason', 'invalid'));
  END IF;
  UPDATE public.appointments
  SET coupon_code = r->>'code', coupon_offer_id = (r->>'offer_id')::uuid
  WHERE id = p_appointment_id;
  RETURN jsonb_build_object('attached', true);
END;
$$;
REVOKE ALL ON FUNCTION public.attach_booking_coupon(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_booking_coupon(text, text, text, text) TO anon, authenticated;

-- Checkout: check a code for this business (and client, if chosen). Full details for staff.
CREATE OR REPLACE FUNCTION public.check_coupon(p_code text, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid := public.get_my_business_id();
BEGIN
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  RETURN public.coupon_lookup(v_business_id, p_code, p_client_id, NULL, false);
END;
$$;
REVOKE ALL ON FUNCTION public.check_coupon(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_coupon(text, uuid) TO authenticated;

-- Checkout: record the use of a code on a saved sale. Validates again and locks the code, so it can't be used twice.
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code text,
  p_client_id uuid,
  p_transaction_id uuid,
  p_appointment_id text,
  p_discount_cents bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid := public.get_my_business_id();
  r jsonb;
  v_coupon uuid;
BEGIN
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF p_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.id = p_transaction_id AND t.business_id = v_business_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- Serialize uses of the same code.
  PERFORM pg_advisory_xact_lock(hashtext(v_business_id::text || ':' || upper(coalesce(p_code, ''))));
  r := public.coupon_lookup(v_business_id, p_code, p_client_id, NULL, false);
  IF NOT coalesce((r->>'ok')::boolean, false) THEN
    RETURN r;
  END IF;
  v_coupon := nullif(r->>'coupon_id', '')::uuid;

  INSERT INTO public.coupon_redemptions (business_id, offer_id, coupon_id, client_id, transaction_id, appointment_id, code, discount_cents, redeemed_by)
  VALUES (v_business_id, (r->>'offer_id')::uuid, v_coupon, coalesce(p_client_id, nullif(r->>'client_id', '')::uuid),
          p_transaction_id, p_appointment_id, r->>'code', greatest(0, coalesce(p_discount_cents, 0)), auth.uid());

  IF v_coupon IS NOT NULL THEN
    UPDATE public.coupons SET status = 'redeemed', redeemed_at = now() WHERE id = v_coupon;
  END IF;
  RETURN r || jsonb_build_object('ok', true, 'redeemed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_coupon(text, uuid, uuid, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid, text, bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) Grooming follow-up call list
-- ---------------------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS follow_up_weeks smallint NOT NULL DEFAULT 6;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_follow_up_weeks_range;
ALTER TABLE public.settings ADD CONSTRAINT settings_follow_up_weeks_range CHECK (follow_up_weeks BETWEEN 1 AND 52);

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS grooming_interval_weeks smallint;
ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_grooming_interval_weeks_range;
ALTER TABLE public.pets ADD CONSTRAINT pets_grooming_interval_weeks_range
  CHECK (grooming_interval_weeks IS NULL OR grooming_interval_weeks BETWEEN 1 AND 52);

-- Each call attempt staff log for a pet due for grooming.
CREATE TABLE IF NOT EXISTS public.client_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  pet_id text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('booked', 'call_back', 'no_answer', 'not_interested')),
  call_back_on date,
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_follow_ups_pet ON public.client_follow_ups (business_id, pet_id, created_at DESC);

ALTER TABLE public.client_follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_follow_ups_read ON public.client_follow_ups;
CREATE POLICY client_follow_ups_read ON public.client_follow_ups
  FOR SELECT TO authenticated USING (public.can_access_business(business_id));
DROP POLICY IF EXISTS client_follow_ups_insert ON public.client_follow_ups;
CREATE POLICY client_follow_ups_insert ON public.client_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_business(business_id) AND created_by = auth.uid());
REVOKE ALL ON public.client_follow_ups FROM anon;
GRANT SELECT, INSERT ON public.client_follow_ups TO authenticated;

-- Pets due for their next grooming with no upcoming appointment, minus those staff already handled recently.
-- SECURITY INVOKER: the caller's RLS applies (business members see their business; the Edge Function uses the service role).
CREATE OR REPLACE FUNCTION public.follow_up_candidates(p_business_id uuid)
RETURNS TABLE (
  pet_id text,
  pet_name text,
  species text,
  breed text,
  client_id uuid,
  client_name text,
  phone text,
  email text,
  contact_preference text,
  last_visit date,
  weeks_since integer,
  interval_weeks integer,
  usual_service text,
  usual_groomer text,
  last_outcome text,
  last_contact_at timestamptz,
  call_back_on date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH biz AS (
    SELECT
      (now() AT TIME ZONE coalesce((SELECT nullif(s.timezone, '') FROM public.settings s WHERE s.business_id = p_business_id), 'America/Puerto_Rico'))::date AS today,
      coalesce((SELECT s.follow_up_weeks FROM public.settings s WHERE s.business_id = p_business_id), 6)::int AS default_weeks
  ),
  visits AS (
    SELECT a.pet_id, max(a.appointment_date) AS last_date,
           mode() WITHIN GROUP (ORDER BY a.service_type) AS usual_service,
           mode() WITHIN GROUP (ORDER BY a.staff_id) AS usual_staff
    FROM public.appointments a
    WHERE a.business_id = p_business_id
      AND a.status = 'completed'
      AND a.pet_id IS NOT NULL
      AND a.appointment_date IS NOT NULL
    GROUP BY a.pet_id
  ),
  upcoming AS (
    SELECT DISTINCT a.pet_id
    FROM public.appointments a, biz
    WHERE a.business_id = p_business_id
      AND a.appointment_date >= biz.today
      AND lower(replace(a.status, '-', '_')) NOT IN ('canceled', 'cancelled', 'no_show', 'completed')
  ),
  last_fu AS (
    SELECT DISTINCT ON (f.pet_id) f.pet_id, f.outcome, f.created_at, f.call_back_on
    FROM public.client_follow_ups f
    WHERE f.business_id = p_business_id
    ORDER BY f.pet_id, f.created_at DESC
  )
  SELECT
    p.id, p.name, p.species, p.breed,
    c.id, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
    c.phone, c.email, coalesce(c.contact_preference, 'email'),
    v.last_date,
    ((biz.today - v.last_date) / 7)::int,
    coalesce(p.grooming_interval_weeks, biz.default_weeks)::int,
    v.usual_service,
    (SELECT st.name FROM public.staff st WHERE st.id::text = v.usual_staff AND st.business_id = p_business_id),
    lf.outcome, lf.created_at, lf.call_back_on
  FROM public.pets p
  JOIN visits v ON v.pet_id = p.id
  JOIN public.clients c ON c.id = p.client_id
  CROSS JOIN biz
  LEFT JOIN last_fu lf ON lf.pet_id = p.id
  WHERE p.business_id = p_business_id
    AND c.merged_into_client_id IS NULL
    AND v.last_date + (coalesce(p.grooming_interval_weeks, biz.default_weeks) * 7) <= biz.today
    AND NOT EXISTS (SELECT 1 FROM upcoming u WHERE u.pet_id = p.id)
    -- (coalesce: pets never contacted have no last_fu row)
    AND NOT coalesce(lf.outcome = 'not_interested' AND lf.created_at > now() - interval '180 days', false)
    AND NOT coalesce(lf.outcome = 'booked' AND lf.created_at > now() - interval '14 days', false)
    AND NOT coalesce(lf.outcome = 'no_answer' AND lf.created_at > now() - interval '3 days', false)
    AND NOT coalesce(lf.outcome = 'call_back' AND lf.call_back_on > biz.today, false)
    AND NOT coalesce(lf.outcome = 'call_back' AND lf.call_back_on IS NULL AND lf.created_at > now() - interval '2 days', false)
  ORDER BY v.last_date ASC;
$$;
REVOKE ALL ON FUNCTION public.follow_up_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_candidates(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Feature switch (admin portal → Funciones): hidden (Dev, super admins) until turned Live.
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_catalog (feature_key, display_name)
VALUES ('automations', 'Automatizaciones, cupones y seguimiento')
ON CONFLICT (feature_key) DO NOTHING;
INSERT INTO public.feature_rollout (feature_key, min_tier)
VALUES ('automations', 'development')
ON CONFLICT (feature_key) DO NOTHING;
INSERT INTO public.feature_visibility_rules (feature_key, roles, subscription_tiers)
VALUES ('automations', ARRAY['super_admin', 'manager', 'employee'], ARRAY['standard'])
ON CONFLICT (feature_key) DO NOTHING;
