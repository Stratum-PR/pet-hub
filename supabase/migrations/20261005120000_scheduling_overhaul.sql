-- Scheduling overhaul (appointment book)
--   1. Appointment requests: status 'pending', who decided (stored, never shown to the client), source.
--   2. Multi-service appointments: service_ids[] (service_id stays as the primary service).
--   3. Per-groomer service price / duration overrides: staff_service_rates.
--   4. Client contact preference for notifications (email | sms | none).
--   5. Notification log (what was sent, through which channel, success or failure).
--   6. Public booking RPCs for the client-facing /{slug}/reservar page (SECURITY DEFINER, no direct table access).
-- All changes are additive; existing columns and rows are untouched apart from the service_ids backfill.
-- ID columns differ between environments (production stores appointments/pets/services ids as TEXT,
-- older migrations create UUID), so new columns that reference them copy the referenced column's type,
-- and the functions compare ids as text.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Appointment requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (
    status IN (
      'pending',
      'scheduled',
      'confirmed',
      'in_progress',
      'in-progress',
      'completed',
      'cancelled',
      'canceled',
      'no_show',
      'no-show'
    )
  );

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  -- Fallback when the person deciding has no staff row (e.g. an owner or super admin).
  ADD COLUMN IF NOT EXISTS decided_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_note TEXT;

-- service_ids has the same element type as service_id (TEXT in production, UUID elsewhere).
DO $$
DECLARE v_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
  FROM pg_attribute a WHERE a.attrelid = 'public.appointments'::regclass AND a.attname = 'service_id';
  EXECUTE format('ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_ids %s[] NOT NULL DEFAULT ''{}''', v_type);
END $$;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_booking_source_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_booking_source_check
  CHECK (booking_source IN ('staff', 'online', 'portal'));

COMMENT ON COLUMN public.appointments.decided_by_staff_id IS
  'Staff member who confirmed or declined an online request. Internal audit only; never sent to the client.';
COMMENT ON COLUMN public.appointments.decision_note IS
  'Reason given when an online request is declined or a different time is proposed (sent to the client).';
COMMENT ON COLUMN public.appointments.service_ids IS
  'All services in the booking. service_id remains the primary (first) service for legacy reads.';

UPDATE public.appointments
SET service_ids = ARRAY[service_id]
WHERE service_id IS NOT NULL
  AND (service_ids IS NULL OR cardinality(service_ids) = 0);

CREATE INDEX IF NOT EXISTS idx_appointments_business_status
  ON public.appointments (business_id, status);

-- ---------------------------------------------------------------------------
-- 2. Client contact preference
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_preference TEXT NOT NULL DEFAULT 'email';
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_contact_preference_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_contact_preference_check
  CHECK (contact_preference IN ('email', 'sms', 'none'));

-- ---------------------------------------------------------------------------
-- 3. Per-groomer price / duration overrides
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
  FROM pg_attribute a WHERE a.attrelid = 'public.services'::regclass AND a.attname = 'id';
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS public.staff_service_rates (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
      service_id %s NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
      price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
      duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes > 0 AND duration_minutes <= 720)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (staff_id, service_id)
    )$sql$, v_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_service_rates_business ON public.staff_service_rates (business_id);

DROP TRIGGER IF EXISTS update_staff_service_rates_updated_at ON public.staff_service_rates;
CREATE TRIGGER update_staff_service_rates_updated_at
  BEFORE UPDATE ON public.staff_service_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.staff_service_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business members read staff service rates" ON public.staff_service_rates;
CREATE POLICY "Business members read staff service rates"
  ON public.staff_service_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR business_id IN (
      SELECT p.business_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.business_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Demo workspace read staff service rates" ON public.staff_service_rates;
CREATE POLICY "Demo workspace read staff service rates"
  ON public.staff_service_rates FOR SELECT
  USING (business_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS "Managers manage staff service rates" ON public.staff_service_rates;
CREATE POLICY "Managers manage staff service rates"
  ON public.staff_service_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Notification log (written by the notify-appointment Edge Function with the service role)
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
  FROM pg_attribute a WHERE a.attrelid = 'public.appointments'::regclass AND a.attname = 'id';
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS public.appointment_notifications (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      appointment_id %s NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('request_received', 'confirmed', 'declined', 'proposed_time', 'rescheduled', 'canceled')),
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'none')),
      status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )$sql$, v_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_appointment_notifications_appointment
  ON public.appointment_notifications (appointment_id, created_at DESC);

ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business members read appointment notifications" ON public.appointment_notifications;
CREATE POLICY "Business members read appointment notifications"
  ON public.appointment_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR business_id IN (
      SELECT p.business_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.business_id IS NOT NULL
    )
  );
-- No INSERT/UPDATE/DELETE policies: only the service role (Edge Function) writes.

-- ---------------------------------------------------------------------------
-- 5. Public booking: read-only options for a business (no client data)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_public_business_id(p_slug TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT b.id FROM public.businesses b WHERE lower(b.slug) = lower(trim(p_slug)) LIMIT 1),
    (SELECT a.business_id FROM public.business_slug_aliases a WHERE lower(a.old_slug) = lower(trim(p_slug)) LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.resolve_public_business_id(TEXT) FROM PUBLIC, anon, authenticated;

-- Same rule as the app (src/lib/groomerAvailability.ts → bookableStaff): active staff with an explicit
-- service menu or a grooming job title; if nobody matches, every active staff member.
CREATE OR REPLACE FUNCTION public.bookable_staff_ids(p_business_id UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active AS (
    SELECT st.id, st.offered_service_ids, lower(COALESCE(st.role, '')) AS role
    FROM public.staff st
    WHERE st.business_id = p_business_id AND st.status = 'active'
  ), matches AS (
    SELECT a.id FROM active a
    WHERE cardinality(COALESCE(a.offered_service_ids, '{}')) > 0
       OR a.role ~ '(groom|bath|bañ|estilist|stylist|peluquer)'
  )
  SELECT m.id FROM matches m
  UNION ALL
  SELECT a.id FROM active a WHERE NOT EXISTS (SELECT 1 FROM matches);
$$;

REVOKE ALL ON FUNCTION public.bookable_staff_ids(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_booking_options(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.resolve_public_business_id(p_slug);
  v_result JSONB;
BEGIN
  IF v_business_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'business', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'phone', b.phone,
      'address', b.address
    ),
    'business_hours', s.business_hours,
    'timezone', COALESCE(NULLIF(s.timezone, ''), 'America/Puerto_Rico'),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'description', sv.description,
        'price', sv.price, 'duration_minutes', sv.duration_minutes
      ) ORDER BY sv.name)
      FROM public.services sv
      WHERE sv.business_id = b.id AND COALESCE(sv.is_active, true)
    ), '[]'::jsonb),
    'groomers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', st.id,
        -- First name + last initial only: enough to choose, nothing more.
        'display_name', trim(COALESCE(NULLIF(st.first_name, ''), split_part(st.name, ' ', 1)) || ' ' ||
                        COALESCE(left(NULLIF(st.last_name, ''), 1) || '.', '')),
        'offered_service_ids', COALESCE(st.offered_service_ids, '{}'),
        'rates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'service_id', r.service_id, 'price', r.price, 'duration_minutes', r.duration_minutes))
          FROM public.staff_service_rates r WHERE r.staff_id = st.id
        ), '[]'::jsonb)
      ) ORDER BY st.name)
      FROM public.staff st
      WHERE st.id IN (SELECT bs.id FROM public.bookable_staff_ids(b.id) bs)
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.businesses b
  LEFT JOIN public.settings s ON s.business_id = b.id
  WHERE b.id = v_business_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_booking_options(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_booking_options(TEXT) TO anon, authenticated;

-- Busy time blocks and shifts for one day: times only, never who the client is.
CREATE OR REPLACE FUNCTION public.get_public_day_availability(p_slug TEXT, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.resolve_public_business_id(p_slug);
  v_tz TEXT;
BEGIN
  IF v_business_id IS NULL OR p_date IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_date < (now() AT TIME ZONE 'UTC')::date - 1 OR p_date > (now() AT TIME ZONE 'UTC')::date + 180 THEN
    RETURN jsonb_build_object('busy', '[]'::jsonb, 'shifts', '[]'::jsonb, 'uses_shifts', false);
  END IF;

  SELECT COALESCE(NULLIF(s.timezone, ''), 'America/Puerto_Rico') INTO v_tz
  FROM public.settings s WHERE s.business_id = v_business_id;
  v_tz := COALESCE(v_tz, 'America/Puerto_Rico');

  RETURN jsonb_build_object(
    'busy', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', a.staff_id,
        'start_time', to_char(a.start_time, 'HH24:MI'),
        'end_time', to_char(a.end_time, 'HH24:MI')
      ))
      FROM public.appointments a
      WHERE a.business_id = v_business_id
        AND a.appointment_date = p_date
        AND a.start_time IS NOT NULL
        AND lower(replace(a.status, '_', '-')) NOT IN ('canceled', 'cancelled', 'no-show', 'completed')
    ), '[]'::jsonb),
    'shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', sh.staff_id,
        'start', to_char(sh.start_time AT TIME ZONE v_tz, 'HH24:MI'),
        'end', to_char(sh.end_time AT TIME ZONE v_tz, 'HH24:MI')
      ))
      FROM public.staff_shifts sh
      WHERE sh.business_id = v_business_id
        AND (sh.start_time AT TIME ZONE v_tz)::date = p_date
    ), '[]'::jsonb),
    'uses_shifts', EXISTS (
      SELECT 1 FROM public.staff_shifts sh
      WHERE sh.business_id = v_business_id
        AND (sh.start_time AT TIME ZONE v_tz)::date BETWEEN p_date - EXTRACT(DOW FROM p_date)::int
                                                         AND p_date - EXTRACT(DOW FROM p_date)::int + 6
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_day_availability(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_day_availability(TEXT, DATE) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Public booking: submit a request (always status 'pending')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_booking_request(
  p_slug TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_contact_preference TEXT,
  p_pet_name TEXT,
  p_pet_species TEXT,
  p_pet_breed TEXT,
  p_service_ids UUID[],
  p_staff_id UUID,
  p_date DATE,
  p_start_time TEXT,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.resolve_public_business_id(p_slug);
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  v_pref TEXT := COALESCE(NULLIF(p_contact_preference, ''), 'email');
  v_tz TEXT;
  v_client_id UUID;
  v_pet_id TEXT;
  v_appointment_id UUID := gen_random_uuid();
  v_start TIME;
  v_duration INT := 0;
  v_price NUMERIC := 0;
  v_names TEXT;
  v_end TIME;
  v_recent INT;
BEGIN
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'business_not_found' USING ERRCODE = 'P0001';
  END IF;
  -- The public demo workspace is read-only: never write anonymous requests into it.
  IF v_business_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'demo_readonly' USING ERRCODE = 'P0001';
  END IF;
  IF length(trim(COALESCE(p_first_name, ''))) = 0 OR length(trim(COALESCE(p_last_name, ''))) = 0
     OR length(trim(COALESCE(p_pet_name, ''))) = 0 THEN
    RAISE EXCEPTION 'missing_fields' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_phone) = 11 AND left(v_phone, 1) = '1' THEN
    v_phone := substr(v_phone, 2);
  END IF;
  IF length(v_phone) <> 10 THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = 'P0001';
  END IF;
  IF v_pref NOT IN ('email', 'sms', 'none') THEN
    v_pref := 'email';
  END IF;
  IF v_pref = 'email' AND v_email IS NULL THEN
    v_pref := 'sms';
  END IF;
  IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 10 THEN
    RAISE EXCEPTION 'missing_services' USING ERRCODE = 'P0001';
  END IF;
  IF length(COALESCE(p_notes, '')) > 1000 OR length(p_first_name) > 80 OR length(p_last_name) > 80
     OR length(p_pet_name) > 80 OR length(COALESCE(p_pet_breed, '')) > 80 THEN
    RAISE EXCEPTION 'too_long' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_start := p_start_time::time;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_time' USING ERRCODE = 'P0001';
  END;

  SELECT COALESCE(NULLIF(s.timezone, ''), 'America/Puerto_Rico') INTO v_tz
  FROM public.settings s WHERE s.business_id = v_business_id;
  v_tz := COALESCE(v_tz, 'America/Puerto_Rico');

  IF p_date IS NULL OR p_date < (now() AT TIME ZONE v_tz)::date OR p_date > (now() AT TIME ZONE v_tz)::date + 180 THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = 'P0001';
  END IF;
  IF (p_date + v_start) < (now() AT TIME ZONE v_tz) THEN
    RAISE EXCEPTION 'time_in_past' USING ERRCODE = 'P0001';
  END IF;

  -- Abuse guard: at most 3 open requests per phone per business.
  SELECT count(*) INTO v_recent
  FROM public.appointments a
  JOIN public.clients c ON c.id = a.client_id
  WHERE a.business_id = v_business_id
    AND a.status = 'pending'
    AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone;
  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'too_many_requests' USING ERRCODE = 'P0001';
  END IF;

  -- Services must belong to the business and be active. Price/duration use the groomer's override when present.
  SELECT
    COALESCE(sum(COALESCE(r.duration_minutes, sv.duration_minutes, 60)), 0),
    COALESCE(sum(COALESCE(r.price, sv.price, 0)), 0),
    string_agg(sv.name, ', ' ORDER BY array_position(p_service_ids::text[], sv.id::text))
  INTO v_duration, v_price, v_names
  FROM public.services sv
  LEFT JOIN public.staff_service_rates r ON r.service_id = sv.id AND r.staff_id = p_staff_id
  WHERE sv.business_id = v_business_id
    AND sv.id::text = ANY (p_service_ids::text[])
    AND COALESCE(sv.is_active, true);
  IF v_names IS NULL OR (SELECT count(*) FROM public.services sv WHERE sv.business_id = v_business_id AND sv.id::text = ANY (p_service_ids::text[])) <> cardinality(p_service_ids) THEN
    RAISE EXCEPTION 'invalid_services' USING ERRCODE = 'P0001';
  END IF;
  v_duration := GREATEST(v_duration, 15);
  v_end := v_start + make_interval(mins => v_duration);

  IF p_staff_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.staff st
      WHERE st.id = p_staff_id AND st.business_id = v_business_id AND st.status = 'active'
    ) THEN
      RAISE EXCEPTION 'invalid_groomer' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.business_id = v_business_id
        AND a.appointment_date = p_date
        AND (a.staff_id::text = p_staff_id::text OR a.staff_id IS NULL)
        AND lower(replace(a.status, '_', '-')) NOT IN ('canceled', 'cancelled', 'no-show', 'completed')
        AND a.start_time < v_end
        AND COALESCE(a.end_time, a.start_time + interval '60 minutes') > v_start
    ) THEN
      RAISE EXCEPTION 'slot_taken' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Match an existing client of this business by phone; otherwise create one.
  SELECT c.id INTO v_client_id
  FROM public.clients c
  WHERE c.business_id = v_business_id
    AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (id, business_id, first_name, last_name, email, phone, contact_preference)
    VALUES (gen_random_uuid(), v_business_id, trim(p_first_name), trim(p_last_name), v_email, v_phone, v_pref)
    RETURNING id INTO v_client_id;
  ELSE
    -- Only fill gaps; never overwrite what the business already has on file.
    UPDATE public.clients
    SET email = COALESCE(email, v_email)
    WHERE id = v_client_id;
  END IF;

  SELECT p.id INTO v_pet_id
  FROM public.pets p
  WHERE p.client_id = v_client_id
    AND lower(trim(p.name)) = lower(trim(p_pet_name))
  LIMIT 1;

  IF v_pet_id IS NULL THEN
    INSERT INTO public.pets (id, business_id, client_id, name, species, breed, weight)
    VALUES (
      gen_random_uuid(), v_business_id, v_client_id, trim(p_pet_name),
      CASE WHEN p_pet_species IN ('dog', 'cat', 'other') THEN p_pet_species ELSE 'dog' END,
      COALESCE(NULLIF(trim(COALESCE(p_pet_breed, '')), ''), 'Unknown'),
      0
    )
    RETURNING id INTO v_pet_id;
  END IF;

  INSERT INTO public.appointments (
    id, business_id, client_id, pet_id, service_id, service_ids, staff_id,
    appointment_date, start_time, end_time, scheduled_date,
    service_type, status, total_price, price, notes, booking_source
  ) VALUES (
    v_appointment_id, v_business_id, v_client_id, v_pet_id::uuid, p_service_ids[1], p_service_ids, p_staff_id,
    p_date, v_start, v_end, (p_date + v_start) AT TIME ZONE v_tz,
    v_names, 'pending', v_price, v_price, NULLIF(trim(COALESCE(p_notes, '')), ''), 'online'
  );

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'status', 'pending',
    'start_time', to_char(v_start, 'HH24:MI'),
    'end_time', to_char(v_end, 'HH24:MI'),
    'total_price', v_price
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_booking_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], UUID, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[], UUID, DATE, TEXT, TEXT) TO anon, authenticated;

COMMIT;
