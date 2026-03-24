-- Daily digest for managers: active staff without email (activate account / invites).

CREATE OR REPLACE FUNCTION public.dispatch_staff_missing_email_reminders(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
  v_tz text;
  v_local_date date;
  names text;
  r_mgr record;
  v_message text;
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

  SELECT COALESCE(nullif(trim(s.timezone), ''), 'America/New_York')
  INTO v_tz
  FROM public.businesses b
  LEFT JOIN public.settings s ON s.business_id = b.id
  WHERE b.id = p_business_id
  LIMIT 1;
  IF v_tz IS NULL THEN
    v_tz := 'America/New_York';
  END IF;

  v_local_date := (timezone(v_tz, now()))::date;

  SELECT string_agg(s.name, ', ' ORDER BY s.name)
  INTO names
  FROM public.staff s
  WHERE s.business_id = p_business_id
    AND s.status = 'active'
    AND (s.email IS NULL OR btrim(s.email) = '');

  IF names IS NULL OR names = '' THEN
    RETURN 0;
  END IF;

  v_message := 'Reminder: add work email for team members so they can activate their accounts: ' || names;

  FOR r_mgr IN
    SELECT p.id AS uid
    FROM public.profiles p
    WHERE p.business_id = p_business_id
      AND p.role IN ('manager', 'super_admin')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r_mgr.uid
        AND n.business_id = p_business_id
        AND n.notification_type = 'general'
        AND (n.metadata ->> 'kind') = 'staff_missing_email_reminder'
        AND (timezone(v_tz, n.created_at))::date = v_local_date
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (
      user_id, business_id, message, read, notification_type, metadata
    ) VALUES (
      r_mgr.uid,
      p_business_id,
      v_message,
      false,
      'general',
      jsonb_build_object('kind', 'staff_missing_email_reminder', 'staff_names', names)
    );
    inserted := inserted + 1;
  END LOOP;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_staff_missing_email_reminders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_staff_missing_email_reminders(uuid) TO authenticated;
