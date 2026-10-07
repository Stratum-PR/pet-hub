-- Business setting: show groomer photos when booking (staff dialog + public booking page). On by default.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS booking_show_staff_photos TEXT NOT NULL DEFAULT 'true';

-- Employees read settings through this RPC; include the new key.
CREATE OR REPLACE FUNCTION public.get_employee_portal_settings(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  j jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.business_id = p_business_id
      AND p.role = 'employee'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'business_id', s.business_id,
    'business_name', s.business_name,
    'business_hours', s.business_hours,
    'primary_color', s.primary_color,
    'secondary_color', s.secondary_color,
    'business_logo_url', s.business_logo_url,
    'business_logo_url_light', s.business_logo_url_light,
    'business_logo_url_dark', s.business_logo_url_dark,
    'business_icon_url_light', s.business_icon_url_light,
    'business_icon_url_dark', s.business_icon_url_dark,
    'business_branding_layout', s.business_branding_layout,
    'navbar_logo_mode', s.navbar_logo_mode,
    'navbar_logo_size_px', s.navbar_logo_size_px,
    'timezone', s.timezone,
    'default_low_stock_threshold', s.default_low_stock_threshold,
    'pay_schedule_anchor_date', s.pay_schedule_anchor_date,
    'pay_schedule_cadence_weeks', s.pay_schedule_cadence_weeks,
    'notify_appointment_unbilled', s.notify_appointment_unbilled,
    'notify_inventory_low_stock', s.notify_inventory_low_stock,
    'notify_payment_overdue', s.notify_payment_overdue,
    'notify_birthdays', s.notify_birthdays,
    'notify_general', s.notify_general,
    'payroll_pdf_include_logo', s.payroll_pdf_include_logo,
    'kiosk_warn_off_schedule', s.kiosk_warn_off_schedule,
    'allow_employee_mobile_punch', s.allow_employee_mobile_punch,
    'booking_show_staff_photos', s.booking_show_staff_photos
  )
  INTO j
  FROM public.settings s
  WHERE s.business_id = p_business_id;

  RETURN j;
END;
$function$;

-- Public booking options: groomer photo only when the business allows it.
CREATE OR REPLACE FUNCTION public.get_public_booking_options(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        'photo_url', CASE WHEN COALESCE(s.booking_show_staff_photos, 'true') = 'true'
                            AND st.photo_url LIKE 'http%' THEN st.photo_url ELSE NULL END,
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
$function$;

REVOKE ALL ON FUNCTION public.get_public_booking_options(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_booking_options(TEXT) TO anon, authenticated;
