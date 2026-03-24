-- ============================================
-- Staff terminology: employees → staff, employee_id → staff_id,
-- access_role (manager vs team), manager staff row on signup, RPC updates.
-- Demo RLS policies on the old table name move with the table rename in PostgreSQL.
-- ============================================

-- 1) Permission tier (job title stays in column "role": groomer, manager, receptionist, …)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'staff';

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_access_role_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_access_role_check
  CHECK (access_role IN ('manager', 'staff', 'admin', 'contractor'));

UPDATE public.employees SET access_role = 'manager' WHERE role = 'manager';
UPDATE public.employees SET access_role = 'staff' WHERE role IS DISTINCT FROM 'manager';

CREATE INDEX IF NOT EXISTS idx_employees_access_role ON public.employees(access_role);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id) WHERE user_id IS NOT NULL;

-- 2) Rename primary table
ALTER TABLE public.employees RENAME TO staff;

DO $$
BEGIN
  ALTER TABLE public.staff RENAME CONSTRAINT employees_pkey TO staff_pkey;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.staff RENAME CONSTRAINT employees_birth_year_range TO staff_birth_year_range;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  ALTER INDEX idx_employees_business_id RENAME TO idx_staff_business_id;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER INDEX idx_employees_pin_set_at RENAME TO idx_staff_pin_set_at;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER INDEX idx_employees_birthday_lookup RENAME TO idx_staff_birthday_lookup;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 3) Foreign keys: rename child columns
DROP INDEX IF EXISTS idx_time_entries_employee_clock_in;
ALTER TABLE public.time_entries RENAME COLUMN employee_id TO staff_id;
CREATE INDEX IF NOT EXISTS idx_time_entries_staff_clock_in
  ON public.time_entries(staff_id, clock_in DESC);

ALTER TABLE public.time_entry_edit_requests RENAME COLUMN employee_id TO staff_id;
DROP INDEX IF EXISTS idx_time_entry_edit_requests_employee_id;
CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_staff_id
  ON public.time_entry_edit_requests(staff_id);

ALTER TABLE public.profiles RENAME COLUMN employee_id TO staff_id;
DROP INDEX IF EXISTS idx_profiles_employee_id;
CREATE INDEX IF NOT EXISTS idx_profiles_staff_id ON public.profiles(staff_id);

ALTER TABLE public.notifications RENAME COLUMN employee_id TO staff_id;

ALTER TABLE public.appointments RENAME COLUMN employee_id TO staff_id;

ALTER TABLE public.employee_shifts RENAME TO staff_shifts;
ALTER TABLE public.staff_shifts RENAME COLUMN employee_id TO staff_id;

DO $$
BEGIN
  ALTER INDEX idx_employee_shifts_employee_id RENAME TO idx_staff_shifts_staff_id;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER INDEX idx_employee_shifts_business_id RENAME TO idx_staff_shifts_business_id;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER INDEX idx_employee_shifts_start_end RENAME TO idx_staff_shifts_start_end;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_employee_shifts_updated_at ON public.staff_shifts;
CREATE TRIGGER update_staff_shifts_updated_at
  BEFORE UPDATE ON public.staff_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS: time_entry_edit_requests
DROP POLICY IF EXISTS "Employees can view their own edit requests" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Staff can view their own edit requests" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Employees can create edit requests for own entries" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Staff can create edit requests for own entries" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Managers can update edit requests in their business" ON public.time_entry_edit_requests;

CREATE POLICY "Staff can view their own edit requests"
  ON public.time_entry_edit_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Staff can create edit requests for own entries"
  ON public.time_entry_edit_requests FOR INSERT
  WITH CHECK (
    staff_id::text IN (
      SELECT s.id::text FROM public.staff s
      INNER JOIN public.profiles p ON p.staff_id = s.id
      WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id::text = time_entry_edit_requests.time_entry_id::text
        AND te.staff_id::text = time_entry_edit_requests.staff_id::text
    )
  );

CREATE POLICY "Managers can update edit requests in their business"
  ON public.time_entry_edit_requests FOR UPDATE
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- 5) RPC: overtime
CREATE OR REPLACE FUNCTION public.calculate_overtime_hours(
  p_employee_id uuid,
  p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_week_end date;
  v_total_hours numeric(10, 2);
  v_regular_hours numeric(10, 2);
  v_overtime_hours numeric(10, 2);
  v_result jsonb;
BEGIN
  v_week_end := p_week_start + interval '7 days';
  SELECT COALESCE(
    SUM(
      EXTRACT(epoch FROM (
        COALESCE(te.rounded_clock_out, te.clock_out) -
        COALESCE(te.rounded_clock_in, te.clock_in)
      )) / 3600.0
    ),
    0
  )
  INTO v_total_hours
  FROM public.time_entries te
  WHERE te.staff_id = p_employee_id
    AND te.clock_in >= p_week_start::timestamptz
    AND te.clock_in < v_week_end::timestamptz
    AND te.clock_out IS NOT NULL
    AND te.status = 'active';

  IF v_total_hours > 40 THEN
    v_regular_hours := 40;
    v_overtime_hours := v_total_hours - 40;
  ELSE
    v_regular_hours := v_total_hours;
    v_overtime_hours := 0;
  END IF;

  v_result := jsonb_build_object(
    'total_hours', round(v_total_hours, 2),
    'regular_hours', round(v_regular_hours, 2),
    'overtime_hours', round(v_overtime_hours, 2),
    'week_start', p_week_start,
    'week_end', v_week_end
  );
  RETURN v_result;
END;
$$;

-- 6) RPC: schedule check
CREATE OR REPLACE FUNCTION public.check_employee_schedule(
  p_employee_id uuid,
  p_clock_time timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_shift record;
  v_result jsonb;
BEGIN
  SELECT ss.id, ss.start_time, ss.end_time
  INTO v_shift
  FROM public.staff_shifts ss
  WHERE ss.staff_id = p_employee_id
    AND ss.start_time <= (p_clock_time + interval '30 minutes')
    AND ss.end_time >= (p_clock_time - interval '30 minutes')
  ORDER BY abs(extract(epoch FROM (ss.start_time - p_clock_time)))
  LIMIT 1;

  IF v_shift.id IS NOT NULL THEN
    v_result := jsonb_build_object(
      'is_scheduled', true,
      'shift_id', v_shift.id,
      'shift_start', v_shift.start_time,
      'shift_end', v_shift.end_time,
      'warning', null
    );
  ELSE
    SELECT ss.id, ss.start_time, ss.end_time
    INTO v_shift
    FROM public.staff_shifts ss
    WHERE ss.staff_id = p_employee_id
      AND ss.start_time >= p_clock_time::date
      AND ss.start_time < (p_clock_time::date + interval '1 day')
    ORDER BY abs(extract(epoch FROM (ss.start_time - p_clock_time)))
    LIMIT 1;

    v_result := jsonb_build_object(
      'is_scheduled', false,
      'shift_id', COALESCE(v_shift.id::text, null::text),
      'shift_start', COALESCE(v_shift.start_time::text, null::text),
      'shift_end', COALESCE(v_shift.end_time::text, null::text),
      'warning', 'off_schedule'
    );
  END IF;
  RETURN v_result;
END;
$$;

-- 7) RPC: clock in/out
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
    v_entry_status := CASE WHEN v_staff.access_role = 'manager' THEN 'approved' ELSE 'active' END;

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
      'auto_approved', (v_staff.access_role = 'manager')
    );
  END IF;

  RETURN v_result;
END;
$$;

-- 8) Birthday dispatch (replaces dispatch_employee_birthdays_for_business)
DROP FUNCTION IF EXISTS public.dispatch_employee_birthdays_for_business(uuid);

CREATE OR REPLACE FUNCTION public.dispatch_staff_birthdays_for_business(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
  v_tz text;
  v_notify text;
  v_business_name text;
  v_local_date date;
  r_emp record;
  r_profile record;
  v_team_message text;
  v_celeb_message text;
  v_meta_team jsonb;
  v_meta_celeb jsonb;
  v_first_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.business_id = p_business_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT
    COALESCE(nullif(trim(s.timezone), ''), 'America/New_York'),
    COALESCE(s.notify_birthdays, 'true'),
    b.name
  INTO v_tz, v_notify, v_business_name
  FROM public.businesses b
  LEFT JOIN public.settings s ON s.business_id = b.id
  WHERE b.id = p_business_id
  LIMIT 1;

  IF v_notify = 'false' THEN
    RETURN 0;
  END IF;

  v_business_name := COALESCE(v_business_name, 'Your team');
  v_local_date := (timezone(v_tz, now()))::date;

  FOR r_emp IN
    SELECT s.id, s.name, s.birth_month, s.birth_day, s.business_id
    FROM public.staff s
    WHERE s.business_id = p_business_id
      AND s.status = 'active'
      AND s.birth_month IS NOT NULL
      AND s.birth_day IS NOT NULL
  LOOP
    IF NOT public.employee_birthday_matches_today(r_emp.birth_month, r_emp.birth_day, v_local_date) THEN
      CONTINUE;
    END IF;

    v_first_name := nullif(trim(split_part(trim(r_emp.name), ' ', 1)), '');

    FOR r_profile IN
      SELECT p.id AS uid, p.staff_id
      FROM public.profiles p
      WHERE p.business_id = p_business_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = r_profile.uid
          AND n.business_id = p_business_id
          AND n.staff_id = r_emp.id
          AND n.notification_type IN ('birthday_team', 'birthday_celebration')
          AND (timezone(v_tz, n.created_at))::date = v_local_date
      ) THEN
        CONTINUE;
      END IF;

      IF r_profile.staff_id IS NOT NULL AND r_profile.staff_id = r_emp.id THEN
        v_celeb_message := '🎂 Happy Birthday! It''s your special day! Click to see your birthday wishes';
        v_meta_celeb := jsonb_build_object(
          'kind', 'employee_birthday_celebration',
          'first_name', COALESCE(v_first_name, r_emp.name),
          'business_name', v_business_name
        );
        INSERT INTO public.notifications (
          user_id, business_id, message, read, notification_type, staff_id, metadata
        ) VALUES (
          r_profile.uid,
          p_business_id,
          v_celeb_message,
          false,
          'birthday_celebration',
          r_emp.id,
          v_meta_celeb
        );
        inserted := inserted + 1;
      ELSE
        v_team_message := '🎉 Birthday Today! ' || r_emp.name || '''s birthday is today!';
        v_meta_team := jsonb_build_object(
          'kind', 'employee_birthday_team',
          'employee_name', r_emp.name
        );
        INSERT INTO public.notifications (
          user_id, business_id, message, read, notification_type, staff_id, metadata
        ) VALUES (
          r_profile.uid,
          p_business_id,
          v_team_message,
          false,
          'birthday_team',
          r_emp.id,
          v_meta_team
        );
        inserted := inserted + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_staff_birthdays_for_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_staff_birthdays_for_business(uuid) TO authenticated;

-- 9) complete_manager_signup: manager staff row + profile.staff_id
CREATE OR REPLACE FUNCTION public.complete_manager_signup(
  p_business_name text,
  p_subscription_tier text DEFAULT 'basic'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_slug text;
  v_base_slug text;
  v_suffix int := 0;
  v_short_code text;
  v_tier text;
  v_status text;
  v_new_business_id uuid;
  v_profile record;
  v_staff_id uuid;
  v_pin text;
  v_tries int := 0;
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

  v_base_slug := lower(regexp_replace(
    regexp_replace(
      translate(trim(p_business_name), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ), '-+', '-', 'g'
  ));
  v_base_slug := trim(both '-' from v_base_slug);
  IF v_base_slug = '' THEN
    v_base_slug := 'negocio';
  END IF;

  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  LOOP
    v_short_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
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
    hire_date, created_at, updated_at
  ) VALUES (
    v_new_business_id,
    COALESCE(nullif(trim(v_full_name), ''), 'Manager'),
    v_email,
    '',
    v_pin,
    15,
    'manager',
    'active',
    'manager',
    v_uid,
    now(),
    now(),
    now()
  )
  RETURNING id INTO v_staff_id;

  UPDATE public.profiles SET staff_id = v_staff_id WHERE id = v_uid;
END;
$$;

-- 10) Backfill manager profile → staff row
DO $$
DECLARE
  r record;
  v_pin text;
  v_tries int;
  v_ok boolean;
  v_new_staff uuid;
BEGIN
  FOR r IN
    SELECT p.id AS uid, p.business_id AS bid, p.full_name AS fn, p.email AS em
    FROM public.profiles p
    WHERE p.role = 'manager'
      AND p.business_id IS NOT NULL
      AND p.staff_id IS NULL
  LOOP
    v_ok := false;
    v_tries := 0;
    WHILE v_tries < 500 AND NOT v_ok LOOP
      v_tries := v_tries + 1;
      v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
      IF NOT EXISTS (SELECT 1 FROM public.staff WHERE business_id = r.bid AND pin = v_pin) THEN
        v_ok := true;
      END IF;
    END LOOP;
    IF NOT v_ok THEN
      CONTINUE;
    END IF;

    INSERT INTO public.staff (
      business_id, name, email, phone, pin, hourly_rate, role, status, access_role, user_id,
      hire_date, created_at, updated_at
    ) VALUES (
      r.bid,
      COALESCE(nullif(trim(r.fn), ''), 'Manager'),
      r.em,
      '',
      v_pin,
      15,
      'manager',
      'active',
      'manager',
      r.uid,
      now(),
      now(),
      now()
    )
    RETURNING id INTO v_new_staff;

    UPDATE public.profiles SET staff_id = v_new_staff WHERE id = r.uid;
  END LOOP;
END $$;
