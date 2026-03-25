-- First business owner (signup staff row): access_role admin (not manager).
-- Enforce access_role changes: only admin + manager; managers cannot assign admin.
-- clock_in_out: treat admin like manager for auto-approved time entries.

-- 1) Promote existing business owners who were still manager-tier
UPDATE public.staff s
SET access_role = 'admin'
FROM public.businesses b
WHERE b.id = s.business_id
  AND s.user_id = b.owner_id
  AND s.access_role = 'manager';

-- 2) Signup: owner staff row is admin (job title column `role` stays manager for UI)
CREATE OR REPLACE FUNCTION public.complete_manager_signup(
  p_business_name TEXT,
  p_subscription_tier TEXT DEFAULT 'basic'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_full_name TEXT;
  v_slug TEXT;
  v_base_slug TEXT;
  v_suffix INT := 0;
  v_short_code TEXT;
  v_tier TEXT;
  v_status TEXT;
  v_new_business_id UUID;
  v_profile RECORD;
  v_staff_id UUID;
  v_pin TEXT;
  v_tries INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'complete_manager_signup: not authenticated';
  END IF;

  SELECT email, full_name, business_id INTO v_profile
  FROM public.profiles WHERE id = v_uid;

  IF v_profile.business_id IS NOT NULL THEN
    RETURN;
  END IF;

  v_email := COALESCE(v_profile.email, (SELECT email FROM auth.users WHERE id = v_uid));
  v_full_name := v_profile.full_name;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_uid, v_email, v_full_name, 'client')
  ON CONFLICT (id) DO NOTHING;

  v_tier := CASE WHEN p_subscription_tier IN ('basic', 'growth', 'pro') THEN p_subscription_tier ELSE 'basic' END;
  v_status := 'trialing';

  v_base_slug := public.slugify_business_name(trim(p_business_name));
  IF v_base_slug IS NULL OR v_base_slug = '' THEN
    v_base_slug := 'negocio';
  END IF;

  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  END LOOP;

  LOOP
    v_short_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE short_code = v_short_code);
  END LOOP;

  INSERT INTO public.businesses (
    name, slug, short_code, email, owner_id, subscription_tier, subscription_status, onboarding_completed
  ) VALUES (
    trim(p_business_name), v_slug, v_short_code, v_email, v_uid, v_tier, v_status, true
  )
  RETURNING id INTO v_new_business_id;

  INSERT INTO public.subscriptions (business_id, profile_id, subscription_tier, subscription_status)
  VALUES (v_new_business_id, v_uid, v_tier, v_status);

  PERFORM public.set_profile_business_id(v_uid, v_new_business_id);

  v_pin := '0000';
  v_tries := 0;
  WHILE v_tries < 500 LOOP
    v_tries := v_tries + 1;
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.staff WHERE business_id = v_new_business_id AND pin = v_pin
    );
  END LOOP;

  INSERT INTO public.staff (
    business_id, name, email, phone, pin, hourly_rate, role, status, access_role, user_id,
    created_at, updated_at
  ) VALUES (
    v_new_business_id,
    COALESCE(nullif(trim(v_full_name), ''), 'Manager'),
    v_email,
    '',
    v_pin,
    15,
    'manager',
    'active',
    'admin',
    v_uid,
    now(),
    now()
  )
  RETURNING id INTO v_staff_id;

  UPDATE public.profiles SET staff_id = v_staff_id WHERE id = v_uid;
END;
$$;

-- 3) clock_in_out: admin auto-approved like manager
CREATE OR REPLACE FUNCTION public.clock_in_out(
  p_employee_pin text,
  p_business_id uuid,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_location_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
  v_active_entry record;
  v_clock_time timestamptz;
  v_rounded_clock_time timestamptz;
  v_schedule_check jsonb;
  v_geofence_check jsonb;
  v_time_entry_id text;
  v_result jsonb;
  v_entry_status text;
  v_mgr_tier boolean;
BEGIN
  v_clock_time := now();
  v_rounded_clock_time := public.round_time_to_interval(v_clock_time, 15);

  SELECT id, name, status, pin_required, pin_set_at, pin, access_role
  INTO v_staff
  FROM public.staff
  WHERE pin = p_employee_pin
    AND business_id = p_business_id
    AND status = 'active';

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_pin',
      'message', 'Invalid PIN or staff member not found'
    );
  END IF;

  IF v_staff.pin_required = true AND (v_staff.pin IS NULL OR v_staff.pin = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'pin_not_set',
      'message', 'A PIN must be set before clocking in. Please contact your manager.'
    );
  END IF;

  SELECT id, clock_in, rounded_clock_in
  INTO v_active_entry
  FROM public.time_entries
  WHERE staff_id::text = v_staff.id::text
    AND clock_out IS NULL
    AND status = 'active'
  ORDER BY clock_in DESC
  LIMIT 1;

  IF v_active_entry.id IS NOT NULL THEN
    UPDATE public.time_entries
    SET
      clock_out = v_clock_time,
      rounded_clock_out = v_rounded_clock_time,
      location_longitude = COALESCE(p_longitude, location_longitude),
      location_latitude = COALESCE(p_latitude, location_latitude),
      location_name = COALESCE(p_location_name, location_name)
    WHERE id = v_active_entry.id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_out',
      'time_entry_id', v_active_entry.id,
      'clock_out', v_clock_time,
      'rounded_clock_out', v_rounded_clock_time,
      'warning', null
    );
  ELSE
    v_geofence_check := public.check_geofence(p_business_id, p_latitude, p_longitude);
    IF (v_geofence_check->>'within_fence')::boolean = false THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', v_geofence_check->>'error',
        'message', CASE
          WHEN v_geofence_check->>'error' = 'outside_geofence' THEN
            'You must be at the store location to clock in. You are ' ||
            round((v_geofence_check->>'distance_meters')::numeric / 1000, 2) ||
            ' km away from the store.'
          WHEN v_geofence_check->>'error' = 'employee_location_required' THEN
            'Location is required for clock in. Please enable location services.'
          WHEN v_geofence_check->>'error' = 'geofence_location_not_set' THEN
            'Geofencing is enabled but store location is not set. Please contact your manager.'
          ELSE 'Location validation failed'
        END,
        'geofence_info', v_geofence_check
      );
    END IF;

    v_schedule_check := public.check_employee_schedule(v_staff.id, v_clock_time);
    v_mgr_tier := v_staff.access_role IN ('manager', 'admin');
    v_entry_status := CASE WHEN v_mgr_tier THEN 'approved' ELSE 'active' END;

    INSERT INTO public.time_entries (
      id,
      staff_id,
      business_id,
      clock_in,
      rounded_clock_in,
      location_latitude,
      location_longitude,
      location_name,
      is_off_schedule,
      status
    )
    VALUES (
      gen_random_uuid()::text,
      v_staff.id::text,
      p_business_id,
      v_clock_time,
      v_rounded_clock_time,
      p_latitude,
      p_longitude,
      p_location_name,
      NOT (v_schedule_check->>'is_scheduled')::boolean,
      v_entry_status
    )
    RETURNING id INTO v_time_entry_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'clock_in',
      'time_entry_id', v_time_entry_id,
      'clock_in', v_clock_time,
      'rounded_clock_in', v_rounded_clock_time,
      'warning', v_schedule_check->>'warning',
      'is_off_schedule', NOT (v_schedule_check->>'is_scheduled')::boolean,
      'schedule_info', v_schedule_check,
      'auto_approved', v_mgr_tier
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 4) access_role mutation guard
CREATE OR REPLACE FUNCTION public.caller_staff_access_role_for_business(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_staff_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.staff_id INTO v_staff_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.business_id = p_business_id;

  IF v_staff_id IS NOT NULL THEN
    SELECT s.access_role INTO v_role
    FROM public.staff s
    WHERE s.id = v_staff_id AND s.business_id = p_business_id;
    RETURN v_role;
  END IF;

  SELECT s.access_role INTO v_role
  FROM public.staff s
  WHERE s.business_id = p_business_id AND s.user_id = auth.uid()
  ORDER BY s.created_at ASC
  LIMIT 1;

  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_enforce_access_role_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Signup: profile not linked yet, row is for session user (complete_manager_signup).
    IF (SELECT p.staff_id FROM public.profiles p WHERE p.id = auth.uid()) IS NULL
       AND NEW.user_id IS NOT NULL
       AND NEW.user_id = auth.uid()
       AND NEW.business_id = (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid()) THEN
      RETURN NEW;
    END IF;

    IF NEW.access_role = 'staff' THEN
      RETURN NEW;
    END IF;

    v_caller := public.caller_staff_access_role_for_business(NEW.business_id);
    IF v_caller IS NULL OR v_caller NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'insufficient_privilege_to_set_access_role' USING ERRCODE = '42501';
    END IF;
    IF v_caller = 'manager' AND NEW.access_role = 'admin' THEN
      RAISE EXCEPTION 'managers_cannot_assign_admin' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.access_role IS NOT DISTINCT FROM NEW.access_role THEN
      RETURN NEW;
    END IF;

    v_caller := public.caller_staff_access_role_for_business(OLD.business_id);
    IF v_caller IS NULL OR v_caller NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'insufficient_privilege_to_set_access_role' USING ERRCODE = '42501';
    END IF;
    IF v_caller = 'manager' AND NEW.access_role = 'admin' THEN
      RAISE EXCEPTION 'managers_cannot_assign_admin' USING ERRCODE = '42501';
    END IF;

    IF OLD.access_role = 'admin' AND NEW.access_role IS DISTINCT FROM 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.staff s2
        WHERE s2.business_id = OLD.business_id
          AND s2.status = 'active'
          AND s2.access_role = 'admin'
          AND s2.id <> OLD.id
      ) THEN
        RAISE EXCEPTION 'cannot_remove_last_admin' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_enforce_access_role_mutations ON public.staff;
CREATE TRIGGER staff_enforce_access_role_mutations
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_enforce_access_role_mutations();
