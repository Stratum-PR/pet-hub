-- Employee full DOB (year), notification metadata, and server-side birthday dispatch for all team profiles.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS birth_year integer;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_birth_year_range;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year >= 1940 AND birth_year <= 2010));

CREATE INDEX IF NOT EXISTS idx_employees_birthday_lookup
  ON public.employees (business_id, birth_month, birth_day)
  WHERE status = 'active' AND birth_month IS NOT NULL AND birth_day IS NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_leap_year(y integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (y % 4 = 0 AND y % 100 <> 0) OR (y % 400 = 0);
$$;

CREATE OR REPLACE FUNCTION public.employee_birthday_matches_today(
  p_birth_month integer,
  p_birth_day integer,
  p_local_date date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_birth_month IS NULL OR p_birth_day IS NULL THEN false
    WHEN p_birth_month = EXTRACT(MONTH FROM p_local_date)::integer
     AND p_birth_day = EXTRACT(DAY FROM p_local_date)::integer THEN true
    WHEN p_birth_month = 2 AND p_birth_day = 29
     AND EXTRACT(MONTH FROM p_local_date)::integer = 2
     AND EXTRACT(DAY FROM p_local_date)::integer = 28
     AND NOT public.is_leap_year(EXTRACT(YEAR FROM p_local_date)::integer)
    THEN true
    ELSE false
  END;
$$;

-- ---------------------------------------------------------------------------
-- Dispatch employee birthday notifications to every profile in the business.
-- Uses business timezone from settings (default America/New_York).
-- Call from app on load (or schedule via pg_cron if available).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dispatch_employee_birthdays_for_business(p_business_id uuid)
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
    WHERE p.id = auth.uid()
      AND p.business_id = p_business_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT
    COALESCE(NULLIF(trim(s.timezone), ''), 'America/New_York'),
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
    SELECT e.id, e.name, e.birth_month, e.birth_day, e.business_id
    FROM public.employees e
    WHERE e.business_id = p_business_id
      AND e.status = 'active'
      AND e.birth_month IS NOT NULL
      AND e.birth_day IS NOT NULL
  LOOP
    IF NOT public.employee_birthday_matches_today(r_emp.birth_month, r_emp.birth_day, v_local_date) THEN
      CONTINUE;
    END IF;

    v_first_name := NULLIF(trim(split_part(trim(r_emp.name), ' ', 1)), '');

    FOR r_profile IN
      SELECT p.id AS uid, p.employee_id
      FROM public.profiles p
      WHERE p.business_id = p_business_id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = r_profile.uid
          AND n.business_id = p_business_id
          AND n.employee_id = r_emp.id
          AND n.notification_type IN ('birthday_team', 'birthday_celebration')
          AND (timezone(v_tz, n.created_at))::date = v_local_date
      ) THEN
        CONTINUE;
      END IF;

      IF r_profile.employee_id IS NOT NULL AND r_profile.employee_id = r_emp.id THEN
        v_celeb_message := '🎂 Happy Birthday! It''s your special day! Click to see your birthday wishes';
        v_meta_celeb := jsonb_build_object(
          'kind', 'employee_birthday_celebration',
          'first_name', COALESCE(v_first_name, r_emp.name),
          'business_name', v_business_name
        );
        INSERT INTO public.notifications (
          user_id, business_id, message, read, notification_type, employee_id, metadata
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
          user_id, business_id, message, read, notification_type, employee_id, metadata
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

REVOKE ALL ON FUNCTION public.dispatch_employee_birthdays_for_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_employee_birthdays_for_business(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_leap_year(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leap_year(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.employee_birthday_matches_today(integer, integer, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_birthday_matches_today(integer, integer, date) TO authenticated;

-- Optional (Supabase Pro / pg_cron): run daily at 9:00 America/New_York
-- select cron.schedule(
--   'employee-birthdays',
--   '0 14 * * *',
--   $$ select public.dispatch_employee_birthdays_for_business(b.id) from public.businesses b; $$
-- );
