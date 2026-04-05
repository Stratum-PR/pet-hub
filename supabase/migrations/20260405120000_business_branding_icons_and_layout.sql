-- Optional icon URLs (light/dark) and JSON layout for logo/icon display contexts.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_icon_url_light TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_icon_url_dark TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS business_branding_layout JSONB;

COMMENT ON COLUMN public.settings.business_icon_url_light IS 'Small brand mark for collapsed sidebar and mobile; falls back to logo if null.';
COMMENT ON COLUMN public.settings.business_icon_url_dark IS 'Dark-theme icon; falls back to light icon then logo if null.';
COMMENT ON COLUMN public.settings.business_branding_layout IS 'Logo/icon zoom and dimensions per context (sidebar expanded, kiosk, collapsed, mobile).';

-- Employee RPC: expose new fields for kiosk geometry and icons.
CREATE OR REPLACE FUNCTION public.get_employee_portal_settings(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    'allow_employee_mobile_punch', s.allow_employee_mobile_punch
  )
  INTO j
  FROM public.settings s
  WHERE s.business_id = p_business_id;

  RETURN j;
END;
$$;
