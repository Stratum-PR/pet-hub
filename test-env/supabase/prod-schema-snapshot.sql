-- Grumi production schema snapshot (public schema + auth.users triggers), structure only, no data.
-- Generated 2026-10-07 from the hosted project's catalog (pg_get_functiondef, pg_get_constraintdef, pg_policies...).
-- Why: the repo's migration history can't be replayed from scratch (production has 54 of 136 files recorded and
-- the first file references tables created later), so the local test stack starts from this snapshot and then
-- applies only repo migrations newer than it (scripts/test-env.mjs). Refresh it when production's schema changes.
-- Local test stack only: never apply this to the hosted project.

SET check_function_bodies = false;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


-- ---------- sequences ----------
CREATE SEQUENCE IF NOT EXISTS public.transaction_display_seq;

-- ---------- tables ----------
CREATE TABLE public.admin_impersonation_tokens (
  id uuid NOT NULL,
  admin_id uuid NOT NULL,
  business_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.appointment_notifications (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  appointment_id text NOT NULL,
  kind text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  detail text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.appointments (
  id text NOT NULL,
  pet_id text,
  staff_id text,
  scheduled_date timestamp with time zone,
  service_type text,
  status text,
  price bigint,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  business_id uuid,
  customer_id uuid,
  service_id text,
  appointment_date date,
  start_time time without time zone,
  end_time time without time zone,
  total_price numeric,
  client_id uuid,
  transaction_id uuid,
  billed boolean NOT NULL,
  booked_by_staff_id uuid,
  reminder_sent_at timestamp with time zone,
  booking_source text NOT NULL,
  decided_at timestamp with time zone,
  decided_by_staff_id uuid,
  decided_by_profile_id uuid,
  decision_note text,
  service_ids text[] NOT NULL
);

CREATE TABLE public.athm_sim_businesses (
  public_token text NOT NULL,
  private_token text NOT NULL,
  name text NOT NULL,
  owner_business_id uuid NOT NULL,
  webhook jsonb,
  daily_count integer NOT NULL
);

CREATE TABLE public.athm_sim_payments (
  ecommerce_id text NOT NULL,
  auth_token text NOT NULL,
  public_token text NOT NULL,
  reference_number text,
  status text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.breeds (
  id uuid NOT NULL,
  name text NOT NULL,
  species text NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE public.business_client_links (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  status text NOT NULL,
  approved_by text,
  approved_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.business_payment_secrets (
  business_id uuid NOT NULL,
  athmovil_public_token text,
  athmovil_private_token text,
  athmovil_sim_public_token text,
  athmovil_sim_private_token text,
  webhook_key text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.business_payment_settings (
  business_id uuid NOT NULL,
  athmovil_mode text NOT NULL,
  athmovil_public_token_last4 text,
  athmovil_webhook_subscribed boolean NOT NULL,
  stripe_account_id text,
  stripe_charges_enabled boolean NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.business_slug_aliases (
  old_slug text NOT NULL,
  business_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.businesses (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  website text,
  logo_url text,
  subscription_tier text NOT NULL,
  subscription_status text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamp with time zone,
  subscription_ends_at timestamp with time zone,
  onboarding_completed boolean NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  slug text,
  owner_id uuid,
  short_code text NOT NULL,
  kiosk_manager_pin text,
  geofencing_enabled boolean,
  geofencing_latitude numeric(10,8),
  geofencing_longitude numeric(11,8),
  geofencing_radius_meters integer,
  geofencing_location_name text,
  enable_employee_clockin boolean NOT NULL,
  qr_code text,
  qr_generated_at timestamp with time zone,
  maps_embed_url text
);

CREATE TABLE public.client_business_notes (
  id uuid NOT NULL,
  client_id uuid NOT NULL,
  business_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.client_confirmation_sends (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL,
  sent_at timestamp with time zone NOT NULL
);

CREATE TABLE public.client_payment_methods (
  id uuid NOT NULL,
  profile_id uuid NOT NULL,
  provider text NOT NULL,
  external_id text,
  brand text,
  last4 text,
  exp_month smallint,
  exp_year smallint,
  is_default boolean NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.clients (
  id uuid NOT NULL,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  business_id uuid,
  first_name text,
  last_name text,
  city text,
  state text,
  zip_code text,
  marketing_email_opt_in boolean NOT NULL,
  marketing_sms_opt_in boolean NOT NULL,
  profile_id uuid,
  merged_into_client_id uuid,
  contact_preference text NOT NULL
);

CREATE TABLE public.clock_pin_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  business_id uuid NOT NULL,
  client_ip text,
  attempted_at timestamp with time zone NOT NULL
);

CREATE TABLE public.cookie_consents (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL,
  anonymous_id uuid NOT NULL,
  user_id uuid,
  policy_version text NOT NULL,
  preferences boolean NOT NULL,
  analytics boolean NOT NULL,
  marketing boolean NOT NULL,
  locale text
);

CREATE TABLE public.employee_invitations (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.feature_catalog (
  feature_key text NOT NULL,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.feature_rollout (
  feature_key text NOT NULL,
  min_tier text NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.feature_visibility_rules (
  feature_key text NOT NULL,
  roles text[] NOT NULL,
  subscription_tiers text[] NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.guest_bookings (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL,
  guest_email text,
  business_id uuid,
  appointment_date timestamp with time zone
);

CREATE TABLE public.inventory (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  sku character varying(100),
  product_name character varying(255) NOT NULL,
  description text,
  category character varying(100),
  brand character varying(100),
  cost_price numeric(10,2),
  retail_price numeric(10,2) NOT NULL,
  sale_price numeric(10,2),
  quantity_on_hand integer,
  reorder_level integer,
  reorder_quantity integer,
  unit_of_measure character varying(50),
  barcode character varying(100),
  supplier character varying(255),
  notes text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  folder_id uuid,
  photo_url text,
  custom_fields jsonb,
  target_species text
);

CREATE TABLE public.inventory_folders (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  sort_order integer NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);

CREATE TABLE public.inventory_stock_movements (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  movement_type text NOT NULL,
  supplier text,
  notes text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.nav_order (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  order_json text NOT NULL,
  updated_at timestamp with time zone
);

CREATE TABLE public.notifications (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  message text NOT NULL,
  product_id uuid,
  read boolean NOT NULL,
  created_at timestamp with time zone NOT NULL,
  service_id uuid,
  staff_id uuid,
  notification_type text,
  appointment_id uuid,
  pet_id uuid,
  transaction_id uuid,
  metadata jsonb NOT NULL
);

CREATE TABLE public.payment_audit_log (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE public.payment_secrets (
  payment_id uuid NOT NULL,
  auth_token text
);

CREATE TABLE public.payments (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  provider text NOT NULL,
  mode text NOT NULL,
  provider_payment_id text,
  status text NOT NULL,
  amount_cents integer NOT NULL,
  amount_paid_cents integer,
  fee_cents integer,
  receipt_reference text,
  phone_last4 text,
  appointment_id text,
  customer_id uuid,
  transaction_id uuid,
  created_by uuid,
  expires_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.pet_business_notes (
  id uuid NOT NULL,
  pet_id text NOT NULL,
  business_id uuid NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.pets (
  id text NOT NULL,
  client_id uuid NOT NULL,
  name text,
  species text,
  breed text,
  weight bigint,
  notes text,
  vaccination_status text,
  last_grooming_date text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  business_id uuid,
  special_instructions text,
  birth_month integer,
  birth_year integer,
  last_vaccination_date date,
  photo_url text,
  breed_id uuid
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  is_super_admin boolean NOT NULL,
  business_id uuid,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  role text,
  phone text,
  avatar_url text,
  is_active boolean,
  staff_id uuid,
  prefer_admin_dashboard_on_login boolean NOT NULL
);

CREATE TABLE public.receipt_settings (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  header_text text,
  footer_text text,
  logo_url text,
  tagline text,
  return_policy text,
  thank_you_message text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  receipt_phone text,
  receipt_location text
);

CREATE TABLE public.services (
  id text NOT NULL,
  name text,
  description text,
  price bigint,
  duration_minutes bigint,
  created_at timestamp with time zone,
  is_active boolean,
  business_id uuid NOT NULL,
  color text
);

CREATE TABLE public.settings (
  business_id uuid NOT NULL,
  business_name text,
  business_hours text,
  primary_color text,
  secondary_color text,
  default_low_stock_threshold text,
  pay_schedule_anchor_date text,
  pay_schedule_cadence_weeks text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  business_logo_url text,
  business_logo_url_light text,
  business_logo_url_dark text,
  navbar_logo_mode text,
  navbar_logo_size_px integer,
  timezone text,
  pay_schedule_mode text,
  pay_schedule_custom_start text,
  pay_schedule_custom_end text,
  notify_appointment_unbilled text,
  notify_inventory_low_stock text,
  notify_payment_overdue text,
  notify_birthdays text,
  notify_general text,
  kiosk_warn_off_schedule text NOT NULL,
  business_icon_url_light text,
  business_icon_url_dark text,
  business_branding_layout jsonb,
  booking_show_staff_photos text NOT NULL,
  payroll_pdf_include_logo text,
  allow_employee_mobile_punch text NOT NULL
);

CREATE TABLE public.staff (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  pin text NOT NULL,
  hourly_rate numeric NOT NULL,
  role text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  business_id uuid,
  pin_set_at timestamp with time zone,
  pin_required boolean,
  auth_user_id uuid,
  invite_status text NOT NULL,
  birth_month integer,
  birth_day integer,
  birth_year integer,
  access_role text NOT NULL,
  user_id uuid,
  photo_url text,
  compensation_type text NOT NULL,
  commission_rate numeric,
  bank_routing_number text,
  bank_account_number text,
  bank_name text,
  payment_method text,
  payment_notes text,
  offered_service_ids uuid[] NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  job_title_id uuid,
  staff_address text,
  ssn text,
  bank_account_type text
);

CREATE TABLE public.staff_invites (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone
);

CREATE TABLE public.staff_job_titles (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.staff_private (
  staff_id uuid NOT NULL,
  business_id uuid NOT NULL,
  staff_address text,
  ssn text,
  bank_routing_number text,
  bank_account_type text,
  bank_account_number text,
  bank_name text,
  payment_notes text,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.staff_service_rates (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  service_id text NOT NULL,
  price numeric(10,2),
  duration_minutes integer,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.staff_shift_change_requests (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  staff_shift_id uuid,
  request_kind text NOT NULL,
  proposed_start_time timestamp with time zone,
  proposed_end_time timestamp with time zone,
  reason text NOT NULL,
  status text NOT NULL,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.staff_shifts (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.subscriptions (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL,
  business_id uuid,
  subscription_tier text,
  profile_id uuid,
  subscription_status text,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.support_impersonation_audit (
  id uuid NOT NULL,
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  business_id uuid,
  created_at timestamp with time zone NOT NULL,
  ip_address text,
  user_agent text
);

CREATE TABLE public.tax_settings (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  label text NOT NULL,
  rate numeric NOT NULL,
  enabled boolean NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  region text,
  applies_to text NOT NULL
);

CREATE TABLE public.time_entries (
  id text NOT NULL,
  staff_id text,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  notes text,
  created_at timestamp with time zone,
  business_id uuid,
  location_latitude numeric(10,8),
  location_longitude numeric(11,8),
  location_name text,
  is_off_schedule boolean,
  rounded_clock_in timestamp with time zone,
  rounded_clock_out timestamp with time zone,
  status text,
  edit_request_id uuid,
  lunch_deduction_hours numeric NOT NULL
);

CREATE TABLE public.time_entry_edit_requests (
  id uuid NOT NULL,
  time_entry_id text NOT NULL,
  staff_id uuid NOT NULL,
  business_id uuid NOT NULL,
  requested_by uuid,
  requested_changes jsonb NOT NULL,
  reason text NOT NULL,
  status text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE public.transaction_history (
  id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  business_id uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL,
  changed_by_user_id uuid,
  change_summary jsonb NOT NULL
);

CREATE TABLE public.transaction_line_items (
  id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  type text NOT NULL,
  reference_id text,
  name text NOT NULL,
  quantity numeric NOT NULL,
  unit_price bigint NOT NULL,
  line_total bigint NOT NULL
);

CREATE TABLE public.transaction_refunds (
  id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  amount bigint NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL,
  staff_id uuid,
  restock_applied boolean NOT NULL
);

CREATE TABLE public.transactions (
  id uuid NOT NULL,
  business_id uuid NOT NULL,
  customer_id uuid,
  appointment_id text,
  staff_id uuid,
  created_at timestamp with time zone NOT NULL,
  status text NOT NULL,
  payment_method text NOT NULL,
  payment_method_secondary text,
  subtotal bigint NOT NULL,
  discount_amount bigint NOT NULL,
  discount_label text,
  tax_snapshot jsonb,
  tip_amount bigint NOT NULL,
  total bigint NOT NULL,
  amount_tendered bigint,
  change_given bigint,
  notes text,
  transaction_number integer,
  updated_at timestamp with time zone,
  is_test boolean NOT NULL
);

CREATE TABLE public.waitlist (
  id uuid NOT NULL,
  email text NOT NULL,
  source text NOT NULL,
  locale text NOT NULL,
  confirmed boolean NOT NULL,
  confirm_token uuid NOT NULL,
  signed_up_at timestamp with time zone NOT NULL,
  confirmed_at timestamp with time zone,
  referral_code text,
  referred_by uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb NOT NULL,
  survey_token uuid,
  referred_by_code text,
  admin_notify_at timestamp with time zone,
  admin_notify_sent_at timestamp with time zone,
  signup_notify_deadline_at timestamp with time zone,
  survey_skipped_at timestamp with time zone
);

CREATE TABLE public.waitlist_survey (
  id uuid NOT NULL,
  waitlist_id uuid NOT NULL,
  business_name text,
  groomer_count text,
  current_tools text,
  biggest_pain text,
  wants_ath_movil boolean,
  wants_nomina_pr boolean,
  wants_spanish_ui boolean,
  wants_online_booking boolean,
  submitted_at timestamp with time zone NOT NULL,
  tools_selected jsonb NOT NULL,
  tools_other text,
  wants_costo boolean NOT NULL,
  wants_staff_management boolean NOT NULL,
  wants_charge_online boolean NOT NULL,
  wants_inventory boolean NOT NULL,
  wants_advanced_reports boolean NOT NULL
);

-- ---------- functions ----------
CREATE OR REPLACE FUNCTION public.admin_set_profile_role(p_profile_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_caller AND p.is_super_admin = true) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('super_admin', 'manager', 'employee', 'client') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET role = p_role, updated_at = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_staff_access_role(p_profile_id uuid, p_access_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_target_business_id uuid;
  v_updated_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_caller AND p.is_super_admin = true) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_access_role IS NULL OR p_access_role NOT IN ('admin', 'manager', 'staff', 'contractor') THEN
    RAISE EXCEPTION 'invalid_access_role' USING ERRCODE = '22023';
  END IF;

  SELECT p.business_id
  INTO v_target_business_id
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF v_target_business_id IS NULL THEN
    RAISE EXCEPTION 'profile_has_no_business' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.staff s
  SET access_role = p_access_role,
      updated_at = now()
  WHERE s.user_id = p_profile_id
    AND s.business_id = v_target_business_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'staff_not_found_for_profile' USING ERRCODE = 'P0002';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.appointments_pet_matches_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client UUID;
BEGIN
  IF NEW.client_id IS NULL OR NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.client_id INTO v_client
  FROM public.pets p
  WHERE p.id = NEW.pet_id;

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'appointments.pet_id does not exist';
  END IF;

  IF v_client <> NEW.client_id THEN
    RAISE EXCEPTION 'appointments.pet_id must belong to appointments.client_id';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_email_is_stratum_staff(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND lower(trim(coalesce(u.email, ''))) LIKE '%@stratumpr.com'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.auth_email_super_admin_allowlisted(p_email text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT lower(trim(coalesce(p_email, ''))) = 'jovanielrodriguez4@gmail.com';
$function$
;

CREATE OR REPLACE FUNCTION public.bookable_staff_ids(p_business_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_distance_meters(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  earth_radius DECIMAL := 6371000; -- Earth radius in meters
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Convert degrees to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN earth_radius * c;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_overtime_hours(p_employee_id uuid, p_week_start date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_pet_age(p_birth_month integer, p_birth_year integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER;
  current_year INTEGER;
  age_years INTEGER;
BEGIN
  IF p_birth_month IS NULL OR p_birth_year IS NULL THEN
    RETURN NULL;
  END IF;
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  age_years := current_year - p_birth_year;
  IF current_month < p_birth_month OR
     (current_month = p_birth_month AND EXTRACT(DAY FROM CURRENT_DATE) < 1) THEN
    age_years := age_years - 1;
  END IF;
  RETURN GREATEST(0, age_years);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_vaccination_status(p_last_vaccination_date date)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_last_vaccination_date IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF p_last_vaccination_date >= CURRENT_DATE - INTERVAL '12 months' THEN
    RETURN 'up_to_date';
  ELSE
    RETURN 'out_of_date';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.caller_staff_access_role_for_business(p_business_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.can_access_business(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    public.is_super_admin() 
    OR public.get_my_business_id() = p_business_id;
$function$
;

CREATE OR REPLACE FUNCTION public.can_manage_staff_private(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
      AND (
        public.profile_is_manager_or_super_admin(auth.uid())
        OR COALESCE(public.caller_staff_access_role_for_business(p_business_id), '') IN ('admin', 'manager')
      )
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.check_employee_schedule(p_employee_id uuid, p_clock_time timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_geofence(p_business_id uuid, p_latitude numeric, p_longitude numeric, p_support_feature_tier text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business RECORD;
  v_distance DECIMAL;
  v_result JSONB;
  v_viewer text;
BEGIN
  v_viewer := public.resolve_support_feature_viewer_tier(p_support_feature_tier);

  IF NOT public.feature_is_active('geofencing', v_viewer) THEN
    RETURN jsonb_build_object(
      'within_fence', true,
      'distance_meters', NULL,
      'radius_meters', NULL,
      'error', NULL
    );
  END IF;

  SELECT
    geofencing_enabled,
    geofencing_latitude,
    geofencing_longitude,
    geofencing_radius_meters,
    geofencing_location_name
  INTO v_business
  FROM public.businesses
  WHERE id = p_business_id;

  IF NOT v_business.geofencing_enabled THEN
    RETURN jsonb_build_object(
      'within_fence', true,
      'distance_meters', NULL,
      'radius_meters', NULL,
      'error', NULL
    );
  END IF;

  IF v_business.geofencing_latitude IS NULL OR v_business.geofencing_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'geofence_location_not_set'
    );
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL THEN
    RETURN jsonb_build_object(
      'within_fence', false,
      'distance_meters', NULL,
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'employee_location_required'
    );
  END IF;

  v_distance := public.calculate_distance_meters(
    v_business.geofencing_latitude,
    v_business.geofencing_longitude,
    p_latitude,
    p_longitude
  );

  IF v_distance <= v_business.geofencing_radius_meters THEN
    v_result := jsonb_build_object(
      'within_fence', true,
      'distance_meters', ROUND(v_distance, 2),
      'radius_meters', v_business.geofencing_radius_meters,
      'error', NULL
    );
  ELSE
    v_result := jsonb_build_object(
      'within_fence', false,
      'distance_meters', ROUND(v_distance, 2),
      'radius_meters', v_business.geofencing_radius_meters,
      'error', 'outside_geofence'
    );
  END IF;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_client_confirmation_send(p_email text, p_business_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_business_name TEXT;
  v_recent INT;
BEGIN
  SELECT b.name INTO v_business_name
  FROM public.businesses b
  WHERE b.id = public.resolve_public_business_id(p_business_slug);
  IF v_business_name IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'business_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(u.email) = v_email
      AND u.email_confirmed_at IS NULL
      AND u.created_at > now() - interval '1 hour'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_pending_signup');
  END IF;

  DELETE FROM public.client_confirmation_sends WHERE sent_at < now() - interval '1 day';
  SELECT count(*) INTO v_recent FROM public.client_confirmation_sends
  WHERE email = v_email AND sent_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'too_many');
  END IF;

  INSERT INTO public.client_confirmation_sends (email) VALUES (v_email);
  RETURN jsonb_build_object('allowed', true, 'business_name', v_business_name);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.client_has_appointment_for_business(p_client_id text, p_business_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.client_id::text = p_client_id
      AND a.business_id::text = p_business_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.clock_in_out(p_employee_pin text, p_business_id uuid, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_location_name text DEFAULT NULL::text, p_support_feature_tier text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_headers json;
  v_ip text;
  v_ip_failures int;
  v_business_failures int;
  v_result jsonb;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;
  v_ip := NULLIF(trim(split_part(COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1)), '');

  -- Old rows are only needed for the 15-minute window.
  DELETE FROM public.clock_pin_attempts WHERE attempted_at < now() - interval '1 day';

  SELECT
    count(*) FILTER (WHERE v_ip IS NOT NULL AND client_ip = v_ip),
    count(*)
  INTO v_ip_failures, v_business_failures
  FROM public.clock_pin_attempts
  WHERE business_id = p_business_id
    AND attempted_at > now() - interval '15 minutes';

  IF v_ip_failures >= 8 OR v_business_failures >= 40 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'too_many_attempts',
      'message', 'Demasiados intentos con PIN incorrecto. Espera 15 minutos o pide ayuda a tu gerente. / Too many wrong PINs. Wait 15 minutes or ask your manager.'
    );
  END IF;

  v_result := public.clock_in_out_unthrottled(
    p_employee_pin, p_business_id, p_latitude, p_longitude, p_location_name, p_support_feature_tier
  );

  IF v_result->>'error' = 'invalid_pin' THEN
    INSERT INTO public.clock_pin_attempts (business_id, client_ip) VALUES (p_business_id, v_ip);
  END IF;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clock_in_out_unthrottled(p_employee_pin text, p_business_id uuid, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_location_name text DEFAULT NULL::text, p_support_feature_tier text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND status IN ('active', 'approved')
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
    v_geofence_check := public.check_geofence(
      p_business_id,
      p_latitude,
      p_longitude,
      p_support_feature_tier
    );
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
$function$
;

CREATE OR REPLACE FUNCTION public.complete_employee_signup(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_hash TEXT;
  v_inv public.employee_invitations%ROWTYPE;
  v_auth_email TEXT;
  v_emp_email TEXT;
  v_existing_business UUID;
  v_existing_role TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_token');
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.employee_invitations
  WHERE token_hash = v_hash
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_token');
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = v_uid;
  SELECT email INTO v_emp_email FROM public.employees WHERE id = v_inv.employee_id;

  IF v_emp_email IS NULL OR trim(v_emp_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'employee_missing_email');
  END IF;

  IF lower(trim(v_auth_email)) IS DISTINCT FROM lower(trim(v_emp_email)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_uid
      AND p.business_id = v_inv.business_id
      AND p.employee_id = v_inv.employee_id
      AND p.role = 'employee'
  ) THEN
    UPDATE public.employee_invitations SET accepted_at = now() WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', true, 'business_id', v_inv.business_id, 'employee_id', v_inv.employee_id, 'already_linked', true);
  END IF;

  SELECT business_id, role INTO v_existing_business, v_existing_role
  FROM public.profiles WHERE id = v_uid;

  IF v_existing_business IS NOT NULL AND v_existing_business IS DISTINCT FROM v_inv.business_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_linked_other_business');
  END IF;

  IF v_existing_role IS NOT NULL AND v_existing_role NOT IN ('client', 'employee') THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_role_conflict');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, business_id, employee_id, updated_at)
  VALUES (
    v_uid,
    v_auth_email,
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_uid), ''),
    'employee',
    v_inv.business_id,
    v_inv.employee_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    role = 'employee',
    employee_id = EXCLUDED.employee_id,
    email = EXCLUDED.email,
    updated_at = now();

  UPDATE public.employee_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'business_id', v_inv.business_id, 'employee_id', v_inv.employee_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_manager_signup(p_business_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  user_email text;
  new_business_id uuid;
  trimmed_name text;
  short_code_val text;
  slug_val text;
  updated_count integer;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  trimmed_name := NULLIF(TRIM(p_business_name), '');
  IF trimmed_name IS NULL OR LENGTH(trimmed_name) < 1 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  -- Only run for profiles that have no business_id (new OAuth signup or legacy account)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND business_id IS NOT NULL) THEN
    RETURN;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid LIMIT 1;

  -- Ensure profile row exists (handle_new_user may not have run for some OAuth/sso flows)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    uid,
    COALESCE(user_email, ''),
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = uid LIMIT 1), ''),
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  short_code_val := lower(substring(regexp_replace(trimmed_name, '[^a-zA-Z0-9]', '', 'g') from 1 for 12));
  IF short_code_val IS NULL OR short_code_val = '' THEN
    short_code_val := 'b' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 7);
  ELSE
    short_code_val := short_code_val || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4);
  END IF;

  -- Slug for URL /:slug/dashboard (same logic as authRouting.slugify)
  slug_val := lower(trim(trimmed_name));
  slug_val := regexp_replace(slug_val, '[''"]', '', 'g');
  slug_val := regexp_replace(slug_val, '[^a-z0-9]+', '-', 'g');
  slug_val := regexp_replace(slug_val, '-+', '-', 'g');
  slug_val := trim(both '-' from slug_val);
  IF slug_val IS NULL OR slug_val = '' THEN
    slug_val := 'business-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
  END IF;

  INSERT INTO public.businesses (name, email, subscription_tier, subscription_status, short_code, slug)
  VALUES (trimmed_name, COALESCE(user_email, ''), 'basic', 'trialing', short_code_val, slug_val)
  RETURNING id INTO new_business_id;

  updated_count := public.set_profile_business_id(uid, new_business_id);
  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Failed to link profile to business (updated % rows for user %)', updated_count, uid;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_manager_signup(p_business_name text, p_subscription_tier text DEFAULT 'basic'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.dispatch_staff_birthdays_for_business(p_business_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.employee_birthday_matches_today(p_birth_month integer, p_birth_day integer, p_local_date date)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_super_admin_domain()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_caller_is_super_admin boolean := false;
BEGIN
  -- During UPDATEs, if the caller is already a super admin, allow the mutation
  -- without enforcing the target email domain restriction.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_super_admin = true
    )
    INTO v_caller_is_super_admin;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
     AND (NEW.is_super_admin IS TRUE OR NEW.role = 'super_admin') THEN
    IF TG_OP = 'UPDATE' AND v_caller_is_super_admin THEN
      RETURN NEW;
    END IF;

    SELECT lower(trim(coalesce(u.email, '')))
    INTO v_email
    FROM auth.users u
    WHERE u.id = NEW.id;

    IF v_email IS NULL OR v_email = '' THEN
      RAISE EXCEPTION 'Super admin requires a linked auth user with an email' USING ERRCODE = 'P0001';
    END IF;

    IF NOT (
      v_email LIKE '%@stratumpr.com'
      OR public.auth_email_super_admin_allowlisted(v_email)
    ) THEN
      RAISE EXCEPTION 'Super admin role is restricted to @stratumpr.com emails only'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.feature_is_active(p_feature_key text, p_viewer_tier text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.feature_is_visible(p_feature_key, p_viewer_tier);
$function$
;

CREATE OR REPLACE FUNCTION public.feature_is_available_for_session(p_feature_key text, p_viewer_tier text, p_role text, p_is_super_admin boolean DEFAULT false, p_subscription_tier text DEFAULT 'standard'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.feature_is_visible(p_feature_key, p_viewer_tier)
    AND COALESCE(public.feature_role_visible(p_feature_key, p_role, p_is_super_admin), false)
    AND COALESCE(public.feature_subscription_visible(p_feature_key, p_subscription_tier), false);
$function$
;

CREATE OR REPLACE FUNCTION public.feature_is_visible(p_feature_key text, p_viewer_tier text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE lower(trim(coalesce(p_viewer_tier, 'production')))
    WHEN 'production' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') = 'production'
    WHEN 'staged' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') IN ('production', 'staged')
    WHEN 'development' THEN
      COALESCE((SELECT min_tier FROM public.feature_rollout WHERE feature_key = p_feature_key), 'development') IN ('production', 'staged', 'development')
    ELSE false
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.feature_role_visible(p_feature_key text, p_role text, p_is_super_admin boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN vr.roles IS NULL THEN false
    WHEN '*' = ANY(vr.roles) THEN true
    WHEN coalesce(p_is_super_admin, false) AND 'super_admin' = ANY(vr.roles) THEN true
    ELSE coalesce(p_role, 'client') = ANY(vr.roles)
  END
  FROM public.feature_visibility_rules vr
  WHERE vr.feature_key = p_feature_key;
$function$
;

CREATE OR REPLACE FUNCTION public.feature_subscription_visible(p_feature_key text, p_subscription_tier text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN vr.subscription_tiers IS NULL THEN false
    WHEN '*' = ANY(vr.subscription_tiers) THEN true
    ELSE lower(trim(coalesce(p_subscription_tier, 'standard'))) = ANY(vr.subscription_tiers)
  END
  FROM public.feature_visibility_rules vr
  WHERE vr.feature_key = p_feature_key;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_impersonation_token(target_business_id uuid)
 RETURNS TABLE(token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_token TEXT;
  token_expires_at TIMESTAMP WITH TIME ZONE;
  current_admin_id UUID;
BEGIN
  current_admin_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_admin_id AND is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only super admins can generate impersonation tokens';
  END IF;

  new_token :=
    md5(random()::text || clock_timestamp()::text || random()::text)
    || md5(random()::text || clock_timestamp()::text || random()::text);

  token_expires_at := now() + INTERVAL '1 hour';

  INSERT INTO public.admin_impersonation_tokens (admin_id, business_id, token, expires_at)
  VALUES (current_admin_id, target_business_id, new_token, token_expires_at);

  RETURN QUERY SELECT new_token, token_expires_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employee_portal_settings(p_business_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_business_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.business_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_staff_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id
  FROM public.staff s
  WHERE s.user_id = auth.uid()
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_booking_options(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_day_availability(p_slug text, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sa boolean :=
    lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com'
    OR public.auth_email_super_admin_allowlisted(NEW.email);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    email = NEW.email,
    is_super_admin = v_sa,
    role = CASE
      WHEN v_sa THEN 'super_admin'
      WHEN NOT v_sa AND role = 'super_admin' THEN
        CASE WHEN business_id IS NOT NULL THEN 'manager' ELSE 'client' END
      ELSE role
    END,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sa boolean :=
    lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com'
    OR public.auth_email_super_admin_allowlisted(NEW.email);
  _invitation record;
  v_full_name text;
BEGIN
  IF v_sa THEN
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      true,
      'super_admin'
    );
    RETURN NEW;
  END IF;

  SELECT si.id, si.business_id, si.staff_id, si.email, s.name AS staff_name
  INTO _invitation
  FROM public.staff_invites si
  INNER JOIN public.staff s ON s.id = si.staff_id
  WHERE lower(trim(si.email)) = lower(trim(NEW.email))
    AND si.status = 'pending'
    AND si.expires_at > now()
  ORDER BY si.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_full_name := COALESCE(
      nullif(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      nullif(trim(_invitation.staff_name), ''),
      ''
    );
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role, business_id, staff_id)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      false,
      'employee',
      _invitation.business_id,
      _invitation.staff_id
    );
    UPDATE public.staff SET user_id = NEW.id WHERE id = _invitation.staff_id;
    UPDATE public.staff_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = _invitation.id;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'manager' THEN
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      false,
      'manager'
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    false,
    'client'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_leap_year(y integer)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE STRICT
AS $function$
  SELECT (y % 4 = 0 AND y % 100 <> 0) OR (y % 400 = 0);
$function$
;

CREATE OR REPLACE FUNCTION public.is_public_business_slug_taken_by_other(p_slug text, p_own_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE lower(trim(b.slug)) = lower(trim(p_slug))
      AND b.id <> p_own_business_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_stratumpr_email(email text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT email ILIKE '%@stratumpr.com';
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_feature_key(p_display_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT trim(both '_' FROM regexp_replace(lower(coalesce(p_display_name, '')), '[^a-z0-9]+', '_', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.pet_has_appointment_for_business(p_pet_id text, p_business_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.pet_id::text = p_pet_id
      AND a.business_id::text = p_business_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.profile_is_manager_or_super_admin(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_uid
      AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.profiles_enforce_super_admin_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grant boolean;
  v_revoke boolean;
  v_caller_stratum boolean;
  v_caller_is_super_admin boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_grant :=
    (NEW.is_super_admin IS TRUE AND OLD.is_super_admin IS NOT TRUE)
    OR (
      NEW.role = 'super_admin'
      AND OLD.role IS DISTINCT FROM 'super_admin'
    );

  v_revoke :=
    (NEW.is_super_admin IS NOT TRUE AND OLD.is_super_admin IS TRUE)
    OR (
      NEW.role IS DISTINCT FROM 'super_admin'
      AND OLD.role = 'super_admin'
    );

  IF NOT (v_grant OR v_revoke) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_caller_stratum := public.auth_email_is_stratum_staff(auth.uid());

  -- "Existing super admin" should be determined from profiles, not email domain,
  -- so allowlisted/non-stratum super admins can still manage others.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_super_admin IS TRUE
  )
  INTO v_caller_is_super_admin;

  IF v_grant THEN
    -- Keep original behavior for Stratum staff
    IF v_caller_stratum THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;

    -- NEW: allow any existing super admin to grant super admin to OTHER users
    IF v_caller_is_super_admin AND NEW.id IS DISTINCT FROM auth.uid() THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;

    -- For self-grant, keep the stricter Stratum staff restriction.
    IF NEW.id = auth.uid() AND public.auth_email_is_stratum_staff(NEW.id) THEN
      NEW.is_super_admin := true;
      IF NEW.role <> 'super_admin' THEN
        NEW.role := 'super_admin';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'only_stratumpr_staff_may_grant_super_admin' USING ERRCODE = '42501';
  END IF;

  IF v_revoke THEN
    -- Keep original behavior for Stratum staff
    IF v_caller_stratum THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;

    -- NEW: allow any existing super admin to revoke super admin from OTHER users
    IF v_caller_is_super_admin AND NEW.id IS DISTINCT FROM auth.uid() THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      RETURN NEW;
    END IF;

    -- For self-revoke, keep the stricter Stratum staff restriction.
    IF NEW.id = auth.uid() THEN
      NEW.is_super_admin := false;
      IF NEW.role = 'super_admin' THEN
        NEW.role := CASE WHEN NEW.business_id IS NOT NULL THEN 'manager' ELSE 'client' END;
      END IF;
      IF public.auth_email_is_stratum_staff(NEW.id) THEN
        RETURN NEW;
      END IF;
    END IF;

    RAISE EXCEPTION 'only_stratumpr_staff_may_revoke_super_admin' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_feature_roles_from_label(p_roles_label text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_public_business_id(p_slug text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT b.id FROM public.businesses b WHERE lower(b.slug) = lower(trim(p_slug)) LIMIT 1),
    (SELECT a.business_id FROM public.business_slug_aliases a WHERE lower(a.old_slug) = lower(trim(p_slug)) LIMIT 1)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_support_feature_viewer_tier(p_support_feature_tier text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'production';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
    RETURN 'production';
  END IF;

  v_normalized := lower(trim(coalesce(p_support_feature_tier, '')));
  IF v_normalized IN ('production', 'staged', 'development') THEN
    RETURN v_normalized;
  END IF;

  RETURN 'production';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.round_time_to_interval(p_timestamp timestamp with time zone, p_interval_minutes integer DEFAULT 15)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_interval_seconds INTEGER;
  v_timestamp_seconds BIGINT;
  v_rounded_seconds BIGINT;
  v_result TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Convert interval to seconds
  v_interval_seconds := p_interval_minutes * 60;
  
  -- Get timestamp as seconds since epoch
  v_timestamp_seconds := EXTRACT(EPOCH FROM p_timestamp)::BIGINT;
  
  -- Round to nearest interval
  v_rounded_seconds := (ROUND(v_timestamp_seconds::NUMERIC / v_interval_seconds) * v_interval_seconds)::BIGINT;
  
  -- Convert back to timestamp
  v_result := to_timestamp(v_rounded_seconds);
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_inventory_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_profile_business_id(p_uid uuid, p_business_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET
    business_id = p_business_id,
    role = CASE WHEN is_super_admin = true THEN 'super_admin' ELSE 'manager' END,
    updated_at = now()
  WHERE id = p_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_profile_business_id: no row updated for uid %', p_uid;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_transaction_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.transaction_number IS NULL THEN
    NEW.transaction_number := nextval('public.transaction_display_seq');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at_now()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.slugify_business_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT NULLIF(
    trim(
      both '-' FROM lower(
        regexp_replace(
          regexp_replace(
            translate(trim(p_name), 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
            '[^a-zA-Z0-9]+', '-', 'g'
          ),
          '-+', '-', 'g'
        )
      )
    ),
    ''
  );
$function$
;

CREATE OR REPLACE FUNCTION public.staff_enforce_access_role_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.staff_move_private_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.staff_address, '') <> '' OR COALESCE(NEW.ssn, '') <> '' OR COALESCE(NEW.bank_routing_number, '') <> ''
     OR COALESCE(NEW.bank_account_type, '') <> '' OR COALESCE(NEW.bank_account_number, '') <> ''
     OR COALESCE(NEW.bank_name, '') <> '' OR COALESCE(NEW.payment_notes, '') <> '' THEN
    IF NEW.business_id IS NOT NULL AND (auth.uid() IS NULL OR public.can_manage_staff_private(NEW.business_id)) THEN
      INSERT INTO public.staff_private (
        staff_id, business_id, staff_address, ssn, bank_routing_number, bank_account_type,
        bank_account_number, bank_name, payment_notes
      ) VALUES (
        NEW.id, NEW.business_id, NULLIF(NEW.staff_address, ''), NULLIF(NEW.ssn, ''), NULLIF(NEW.bank_routing_number, ''),
        NULLIF(NEW.bank_account_type, ''), NULLIF(NEW.bank_account_number, ''), NULLIF(NEW.bank_name, ''),
        NULLIF(NEW.payment_notes, '')
      )
      ON CONFLICT (staff_id) DO UPDATE SET
        staff_address = COALESCE(EXCLUDED.staff_address, staff_private.staff_address),
        ssn = COALESCE(EXCLUDED.ssn, staff_private.ssn),
        bank_routing_number = COALESCE(EXCLUDED.bank_routing_number, staff_private.bank_routing_number),
        bank_account_type = COALESCE(EXCLUDED.bank_account_type, staff_private.bank_account_type),
        bank_account_number = COALESCE(EXCLUDED.bank_account_number, staff_private.bank_account_number),
        bank_name = COALESCE(EXCLUDED.bank_name, staff_private.bank_name),
        payment_notes = COALESCE(EXCLUDED.payment_notes, staff_private.payment_notes),
        updated_at = now();
    END IF;
  END IF;
  -- Never keep these on the widely readable table.
  NEW.staff_address := NULL;
  NEW.ssn := NULL;
  NEW.bank_routing_number := NULL;
  NEW.bank_account_type := NULL;
  NEW.bank_account_number := NULL;
  NEW.bank_name := NULL;
  NEW.payment_notes := NULL;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.staff_move_private_fields_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.staff_address, '') <> '' OR COALESCE(NEW.ssn, '') <> '' OR COALESCE(NEW.bank_routing_number, '') <> ''
     OR COALESCE(NEW.bank_account_type, '') <> '' OR COALESCE(NEW.bank_account_number, '') <> ''
     OR COALESCE(NEW.bank_name, '') <> '' OR COALESCE(NEW.payment_notes, '') <> '' THEN
    -- Re-saving the row runs the BEFORE UPDATE trigger, which moves the values and blanks them.
    UPDATE public.staff SET ssn = NEW.ssn WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.staff_sync_name_and_role_from_parts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  jt TEXT;
BEGIN
  NEW.first_name := COALESCE(trim(NEW.first_name), '');
  NEW.last_name := COALESCE(trim(NEW.last_name), '');

  NEW.name := trim(both FROM concat_ws(' ', NULLIF(NEW.first_name, ''), NULLIF(NEW.last_name, '')));
  IF NEW.name = '' OR NEW.name IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.name := COALESCE(NULLIF(trim(COALESCE(OLD.name, '')), ''), 'Unnamed');
    ELSE
      NEW.name := 'Unnamed';
    END IF;
  END IF;

  IF NEW.job_title_id IS NOT NULL THEN
    SELECT t.title INTO jt
    FROM public.staff_job_titles t
    WHERE t.id = NEW.job_title_id
      AND t.business_id = NEW.business_id;
    IF jt IS NOT NULL THEN
      NEW.role := jt;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_booking_request(p_slug text, p_first_name text, p_last_name text, p_phone text, p_email text, p_contact_preference text, p_pet_name text, p_pet_species text, p_pet_breed text, p_service_ids uuid[], p_staff_id uuid, p_date date, p_start_time text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_staff_job_titles_from_staff_roles(p_business_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'sync_staff_job_titles_from_staff_roles: business_id required' USING ERRCODE = '22004';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.is_super_admin = true
        OR (
          p.business_id = p_business_id
          AND p.role IN ('manager', 'super_admin')
        )
      )
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege_to_sync_job_titles' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_job_titles (business_id, title)
  SELECT DISTINCT s.business_id,
    initcap(lower(trim(s.role)))
  FROM public.staff s
  WHERE s.business_id = p_business_id
    AND NULLIF(trim(s.role), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.staff_job_titles t
      WHERE t.business_id = s.business_id
        AND lower(trim(both from t.title)) = lower(trim(both from s.role))
    );

  UPDATE public.staff s
  SET job_title_id = t.id
  FROM public.staff_job_titles t
  WHERE s.business_id = p_business_id
    AND t.business_id = s.business_id
    AND lower(trim(both from t.title)) = lower(trim(both from s.role));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.transactions_guard_is_test()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_test := false;
    ELSE
      NEW.is_test := OLD.is_test;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_breeds_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_business_client_links_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_vaccination_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.vaccination_status := public.calculate_vaccination_status(NEW.last_vaccination_date);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.use_impersonation_token(impersonation_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  token_record RECORD;
BEGIN
  SELECT * INTO token_record
  FROM public.admin_impersonation_tokens
  WHERE token = impersonation_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid impersonation token';
  END IF;
  IF token_record.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Impersonation token has already been used';
  END IF;
  IF token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Impersonation token has expired';
  END IF;
  UPDATE public.admin_impersonation_tokens
  SET used_at = now()
  WHERE id = token_record.id;
  RETURN token_record.business_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_staff_invite(invite_token text)
 RETURNS TABLE(id uuid, email text, status text, expires_at timestamp with time zone, business_id uuid, business_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.email,
    si.status,
    si.expires_at,
    si.business_id,
    b.name AS business_name
  FROM public.staff_invites si
  INNER JOIN public.businesses b ON b.id = si.business_id
  WHERE si.token = invite_token
    AND si.status = 'pending'
    AND si.expires_at > now()
  LIMIT 1;
END;
$function$
;

-- ---------- defaults, constraints, indexes ----------
ALTER TABLE public.admin_impersonation_tokens ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.admin_impersonation_tokens ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.appointment_notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.appointment_notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.appointments ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE public.appointments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.appointments ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.appointments ALTER COLUMN billed SET DEFAULT false;
ALTER TABLE public.appointments ALTER COLUMN booking_source SET DEFAULT 'staff'::text;
ALTER TABLE public.appointments ALTER COLUMN service_ids SET DEFAULT '{}'::text[];
ALTER TABLE public.athm_sim_businesses ALTER COLUMN daily_count SET DEFAULT 0;
ALTER TABLE public.athm_sim_payments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.breeds ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.breeds ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.breeds ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.business_client_links ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.business_client_links ALTER COLUMN status SET DEFAULT 'approved'::text;
ALTER TABLE public.business_client_links ALTER COLUMN approved_at SET DEFAULT now();
ALTER TABLE public.business_client_links ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.business_client_links ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.business_payment_secrets ALTER COLUMN webhook_key SET DEFAULT (replace((gen_random_uuid())::text, '-'::text, ''::text) || replace((gen_random_uuid())::text, '-'::text, ''::text));
ALTER TABLE public.business_payment_secrets ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.business_payment_settings ALTER COLUMN athmovil_mode SET DEFAULT 'off'::text;
ALTER TABLE public.business_payment_settings ALTER COLUMN athmovil_webhook_subscribed SET DEFAULT false;
ALTER TABLE public.business_payment_settings ALTER COLUMN stripe_charges_enabled SET DEFAULT false;
ALTER TABLE public.business_payment_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.business_slug_aliases ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.businesses ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.businesses ALTER COLUMN subscription_status SET DEFAULT 'trialing'::text;
ALTER TABLE public.businesses ALTER COLUMN onboarding_completed SET DEFAULT false;
ALTER TABLE public.businesses ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.businesses ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.businesses ALTER COLUMN geofencing_enabled SET DEFAULT false;
ALTER TABLE public.businesses ALTER COLUMN geofencing_radius_meters SET DEFAULT 100;
ALTER TABLE public.businesses ALTER COLUMN enable_employee_clockin SET DEFAULT false;
ALTER TABLE public.client_business_notes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.client_business_notes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.client_business_notes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.client_confirmation_sends ALTER COLUMN sent_at SET DEFAULT now();
ALTER TABLE public.client_payment_methods ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.client_payment_methods ALTER COLUMN provider SET DEFAULT 'stripe'::text;
ALTER TABLE public.client_payment_methods ALTER COLUMN is_default SET DEFAULT false;
ALTER TABLE public.client_payment_methods ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.client_payment_methods ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.clients ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.clients ALTER COLUMN marketing_email_opt_in SET DEFAULT false;
ALTER TABLE public.clients ALTER COLUMN marketing_sms_opt_in SET DEFAULT false;
ALTER TABLE public.clients ALTER COLUMN contact_preference SET DEFAULT 'email'::text;
ALTER TABLE public.clock_pin_attempts ALTER COLUMN attempted_at SET DEFAULT now();
ALTER TABLE public.cookie_consents ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.cookie_consents ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.cookie_consents ALTER COLUMN preferences SET DEFAULT false;
ALTER TABLE public.cookie_consents ALTER COLUMN analytics SET DEFAULT false;
ALTER TABLE public.cookie_consents ALTER COLUMN marketing SET DEFAULT false;
ALTER TABLE public.employee_invitations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.employee_invitations ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.feature_catalog ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.feature_catalog ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.feature_rollout ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.feature_visibility_rules ALTER COLUMN roles SET DEFAULT ARRAY['super_admin'::text];
ALTER TABLE public.feature_visibility_rules ALTER COLUMN subscription_tiers SET DEFAULT ARRAY['standard'::text];
ALTER TABLE public.feature_visibility_rules ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.guest_bookings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory ALTER COLUMN quantity_on_hand SET DEFAULT 0;
ALTER TABLE public.inventory ALTER COLUMN reorder_level SET DEFAULT 0;
ALTER TABLE public.inventory ALTER COLUMN reorder_quantity SET DEFAULT 0;
ALTER TABLE public.inventory ALTER COLUMN unit_of_measure SET DEFAULT 'unit'::character varying;
ALTER TABLE public.inventory ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.inventory ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.inventory ALTER COLUMN custom_fields SET DEFAULT '{}'::jsonb;
ALTER TABLE public.inventory_folders ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_folders ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE public.inventory_folders ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.inventory_folders ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.inventory_stock_movements ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.inventory_stock_movements ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.nav_order ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.nav_order ALTER COLUMN order_json SET DEFAULT '[]'::text;
ALTER TABLE public.nav_order ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.notifications ALTER COLUMN notification_type SET DEFAULT 'general'::text;
ALTER TABLE public.notifications ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.payment_audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.payment_audit_log ALTER COLUMN details SET DEFAULT '{}'::jsonb;
ALTER TABLE public.payment_audit_log ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.payments ALTER COLUMN mode SET DEFAULT 'live'::text;
ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.payments ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.payments ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.pet_business_notes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.pet_business_notes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.pet_business_notes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.pets ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE public.profiles ALTER COLUMN is_super_admin SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN prefer_admin_dashboard_on_login SET DEFAULT false;
ALTER TABLE public.receipt_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.receipt_settings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.receipt_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.services ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE public.settings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.settings ALTER COLUMN pay_schedule_mode SET DEFAULT 'cadence'::text;
ALTER TABLE public.settings ALTER COLUMN notify_appointment_unbilled SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN notify_inventory_low_stock SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN notify_payment_overdue SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN notify_birthdays SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN notify_general SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN kiosk_warn_off_schedule SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN booking_show_staff_photos SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN payroll_pdf_include_logo SET DEFAULT 'true'::text;
ALTER TABLE public.settings ALTER COLUMN allow_employee_mobile_punch SET DEFAULT 'false'::text;
ALTER TABLE public.staff ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff ALTER COLUMN hourly_rate SET DEFAULT 15.00;
ALTER TABLE public.staff ALTER COLUMN role SET DEFAULT 'groomer'::text;
ALTER TABLE public.staff ALTER COLUMN status SET DEFAULT 'active'::text;
ALTER TABLE public.staff ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.staff ALTER COLUMN pin_required SET DEFAULT true;
ALTER TABLE public.staff ALTER COLUMN invite_status SET DEFAULT 'not_invited'::text;
ALTER TABLE public.staff ALTER COLUMN access_role SET DEFAULT 'staff'::text;
ALTER TABLE public.staff ALTER COLUMN compensation_type SET DEFAULT 'hourly'::text;
ALTER TABLE public.staff ALTER COLUMN offered_service_ids SET DEFAULT '{}'::uuid[];
ALTER TABLE public.staff_invites ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff_invites ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(32), 'hex'::text);
ALTER TABLE public.staff_invites ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.staff_invites ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff_invites ALTER COLUMN expires_at SET DEFAULT (now() + '7 days'::interval);
ALTER TABLE public.staff_job_titles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff_job_titles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff_job_titles ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.staff_private ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.staff_service_rates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff_service_rates ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff_service_rates ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.staff_shift_change_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff_shift_change_requests ALTER COLUMN reason SET DEFAULT ''::text;
ALTER TABLE public.staff_shift_change_requests ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.staff_shift_change_requests ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff_shift_change_requests ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.staff_shifts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.staff_shifts ALTER COLUMN notes SET DEFAULT ''::text;
ALTER TABLE public.staff_shifts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.staff_shifts ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.subscriptions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.subscriptions ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.support_impersonation_audit ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.support_impersonation_audit ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.tax_settings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.tax_settings ALTER COLUMN enabled SET DEFAULT true;
ALTER TABLE public.tax_settings ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE public.tax_settings ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.tax_settings ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.tax_settings ALTER COLUMN applies_to SET DEFAULT 'both'::text;
ALTER TABLE public.time_entries ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE public.time_entries ALTER COLUMN is_off_schedule SET DEFAULT false;
ALTER TABLE public.time_entries ALTER COLUMN status SET DEFAULT 'active'::text;
ALTER TABLE public.time_entries ALTER COLUMN lunch_deduction_hours SET DEFAULT 0;
ALTER TABLE public.time_entry_edit_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.time_entry_edit_requests ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.time_entry_edit_requests ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.time_entry_edit_requests ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.transaction_history ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.transaction_history ALTER COLUMN changed_at SET DEFAULT now();
ALTER TABLE public.transaction_history ALTER COLUMN change_summary SET DEFAULT '[]'::jsonb;
ALTER TABLE public.transaction_line_items ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.transaction_line_items ALTER COLUMN quantity SET DEFAULT 1;
ALTER TABLE public.transaction_refunds ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.transaction_refunds ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.transaction_refunds ALTER COLUMN restock_applied SET DEFAULT false;
ALTER TABLE public.transactions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.transactions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.transactions ALTER COLUMN status SET DEFAULT 'pending'::text;
ALTER TABLE public.transactions ALTER COLUMN subtotal SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN discount_amount SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN tip_amount SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN total SET DEFAULT 0;
ALTER TABLE public.transactions ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.transactions ALTER COLUMN is_test SET DEFAULT false;
ALTER TABLE public.waitlist ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.waitlist ALTER COLUMN source SET DEFAULT 'website'::text;
ALTER TABLE public.waitlist ALTER COLUMN locale SET DEFAULT 'es'::text;
ALTER TABLE public.waitlist ALTER COLUMN confirmed SET DEFAULT false;
ALTER TABLE public.waitlist ALTER COLUMN confirm_token SET DEFAULT gen_random_uuid();
ALTER TABLE public.waitlist ALTER COLUMN signed_up_at SET DEFAULT now();
ALTER TABLE public.waitlist ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE public.waitlist_survey ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.waitlist_survey ALTER COLUMN submitted_at SET DEFAULT now();
ALTER TABLE public.waitlist_survey ALTER COLUMN tools_selected SET DEFAULT '[]'::jsonb;
ALTER TABLE public.waitlist_survey ALTER COLUMN wants_costo SET DEFAULT false;
ALTER TABLE public.waitlist_survey ALTER COLUMN wants_staff_management SET DEFAULT false;
ALTER TABLE public.waitlist_survey ALTER COLUMN wants_charge_online SET DEFAULT false;
ALTER TABLE public.waitlist_survey ALTER COLUMN wants_inventory SET DEFAULT false;
ALTER TABLE public.waitlist_survey ALTER COLUMN wants_advanced_reports SET DEFAULT false;

ALTER TABLE public.admin_impersonation_tokens ADD CONSTRAINT admin_impersonation_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);
ALTER TABLE public.athm_sim_businesses ADD CONSTRAINT athm_sim_businesses_pkey PRIMARY KEY (public_token);
ALTER TABLE public.athm_sim_payments ADD CONSTRAINT athm_sim_payments_pkey PRIMARY KEY (ecommerce_id);
ALTER TABLE public.breeds ADD CONSTRAINT breeds_pkey PRIMARY KEY (id);
ALTER TABLE public.business_client_links ADD CONSTRAINT business_client_links_pkey PRIMARY KEY (id);
ALTER TABLE public.business_payment_secrets ADD CONSTRAINT business_payment_secrets_pkey PRIMARY KEY (business_id);
ALTER TABLE public.business_payment_settings ADD CONSTRAINT business_payment_settings_pkey PRIMARY KEY (business_id);
ALTER TABLE public.business_slug_aliases ADD CONSTRAINT business_slug_aliases_pkey PRIMARY KEY (old_slug);
ALTER TABLE public.businesses ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);
ALTER TABLE public.client_business_notes ADD CONSTRAINT client_business_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.client_confirmation_sends ADD CONSTRAINT client_confirmation_sends_pkey PRIMARY KEY (id);
ALTER TABLE public.client_payment_methods ADD CONSTRAINT client_payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.clock_pin_attempts ADD CONSTRAINT clock_pin_attempts_pkey PRIMARY KEY (id);
ALTER TABLE public.cookie_consents ADD CONSTRAINT cookie_consents_pkey PRIMARY KEY (id);
ALTER TABLE public.employee_invitations ADD CONSTRAINT employee_invitations_pkey PRIMARY KEY (id);
ALTER TABLE public.feature_catalog ADD CONSTRAINT feature_catalog_pkey PRIMARY KEY (feature_key);
ALTER TABLE public.feature_rollout ADD CONSTRAINT feature_rollout_pkey PRIMARY KEY (feature_key);
ALTER TABLE public.feature_visibility_rules ADD CONSTRAINT feature_visibility_rules_pkey PRIMARY KEY (feature_key);
ALTER TABLE public.guest_bookings ADD CONSTRAINT guest_bookings_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_folders ADD CONSTRAINT inventory_folders_pkey PRIMARY KEY (id);
ALTER TABLE public.inventory_stock_movements ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);
ALTER TABLE public.nav_order ADD CONSTRAINT nav_order_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_audit_log ADD CONSTRAINT payment_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE public.payment_secrets ADD CONSTRAINT payment_secrets_pkey PRIMARY KEY (payment_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.pet_business_notes ADD CONSTRAINT pet_business_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.pets ADD CONSTRAINT pets_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.receipt_settings ADD CONSTRAINT receipt_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.services ADD CONSTRAINT services_pkey PRIMARY KEY (id);
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (business_id);
ALTER TABLE public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (id);
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.staff_job_titles ADD CONSTRAINT staff_job_titles_pkey PRIMARY KEY (id);
ALTER TABLE public.staff_private ADD CONSTRAINT staff_private_pkey PRIMARY KEY (staff_id);
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_pkey PRIMARY KEY (id);
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.staff_shifts ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.support_impersonation_audit ADD CONSTRAINT support_impersonation_audit_pkey PRIMARY KEY (id);
ALTER TABLE public.tax_settings ADD CONSTRAINT tax_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_line_items ADD CONSTRAINT transaction_line_items_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_refunds ADD CONSTRAINT transaction_refunds_pkey PRIMARY KEY (id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);
ALTER TABLE public.waitlist_survey ADD CONSTRAINT waitlist_survey_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_impersonation_tokens ADD CONSTRAINT admin_impersonation_tokens_token_key UNIQUE (token);
ALTER TABLE public.athm_sim_payments ADD CONSTRAINT athm_sim_payments_auth_token_key UNIQUE (auth_token);
ALTER TABLE public.breeds ADD CONSTRAINT breeds_name_key UNIQUE (name);
ALTER TABLE public.business_client_links ADD CONSTRAINT business_client_links_user_id_business_id_key UNIQUE (user_id, business_id);
ALTER TABLE public.business_payment_secrets ADD CONSTRAINT business_payment_secrets_webhook_key_key UNIQUE (webhook_key);
ALTER TABLE public.businesses ADD CONSTRAINT businesses_slug_key UNIQUE (slug);
ALTER TABLE public.businesses ADD CONSTRAINT businesses_stripe_customer_id_key UNIQUE (stripe_customer_id);
ALTER TABLE public.client_business_notes ADD CONSTRAINT client_business_notes_client_id_business_id_key UNIQUE (client_id, business_id);
ALTER TABLE public.employee_invitations ADD CONSTRAINT employee_invitations_token_hash_unique UNIQUE (token_hash);
ALTER TABLE public.nav_order ADD CONSTRAINT nav_order_user_id_key UNIQUE (user_id);
ALTER TABLE public.pet_business_notes ADD CONSTRAINT pet_business_notes_pet_id_business_id_key UNIQUE (pet_id, business_id);
ALTER TABLE public.receipt_settings ADD CONSTRAINT receipt_settings_business_id_key UNIQUE (business_id);
ALTER TABLE public.staff ADD CONSTRAINT staff_user_id_unique UNIQUE (user_id);
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_token_key UNIQUE (token);
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_staff_id_service_id_key UNIQUE (staff_id, service_id);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_referral_code_key UNIQUE (referral_code);
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_survey_token_key UNIQUE (survey_token);
ALTER TABLE public.waitlist_survey ADD CONSTRAINT waitlist_survey_one_per_waitlist UNIQUE (waitlist_id);
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'none'::text])));
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_kind_check CHECK ((kind = ANY (ARRAY['request_received'::text, 'confirmed'::text, 'declined'::text, 'proposed_time'::text, 'rescheduled'::text, 'canceled'::text])));
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'skipped'::text, 'failed'::text])));
ALTER TABLE public.appointments ADD CONSTRAINT appointments_booking_source_check CHECK ((booking_source = ANY (ARRAY['staff'::text, 'online'::text, 'portal'::text])));
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'confirmed'::text, 'in_progress'::text, 'in-progress'::text, 'completed'::text, 'cancelled'::text, 'canceled'::text, 'no_show'::text, 'no-show'::text])));
ALTER TABLE public.breeds ADD CONSTRAINT breeds_species_check CHECK ((species = ANY (ARRAY['dog'::text, 'cat'::text, 'other'::text])));
ALTER TABLE public.business_client_links ADD CONSTRAINT business_client_links_status_check CHECK ((status = ANY (ARRAY['approved'::text, 'revoked'::text])));
ALTER TABLE public.business_payment_settings ADD CONSTRAINT business_payment_settings_athmovil_mode_check CHECK ((athmovil_mode = ANY (ARRAY['off'::text, 'simulator'::text, 'live'::text])));
ALTER TABLE public.businesses ADD CONSTRAINT businesses_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])));
ALTER TABLE public.businesses ADD CONSTRAINT businesses_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['basic'::text, 'growth'::text, 'pro'::text, 'enterprise'::text])));
ALTER TABLE public.clients ADD CONSTRAINT clients_contact_preference_check CHECK ((contact_preference = ANY (ARRAY['email'::text, 'sms'::text, 'none'::text])));
ALTER TABLE public.feature_rollout ADD CONSTRAINT feature_rollout_min_tier_check CHECK ((min_tier = ANY (ARRAY['production'::text, 'staged'::text, 'development'::text])));
ALTER TABLE public.feature_visibility_rules ADD CONSTRAINT feature_visibility_rules_roles_check CHECK ((array_length(roles, 1) IS NOT NULL));
ALTER TABLE public.feature_visibility_rules ADD CONSTRAINT feature_visibility_rules_subscription_tiers_check CHECK ((array_length(subscription_tiers, 1) IS NOT NULL));
ALTER TABLE public.inventory ADD CONSTRAINT inventory_target_species_chk CHECK (((target_species IS NULL) OR (target_species = ANY (ARRAY['dog'::text, 'cat'::text, 'other'::text]))));
ALTER TABLE public.inventory_stock_movements ADD CONSTRAINT inventory_stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['purchase'::text, 'restock'::text, 'sale'::text, 'adjustment'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_cents_check CHECK ((amount_cents > 0));
ALTER TABLE public.payments ADD CONSTRAINT payments_mode_check CHECK ((mode = ANY (ARRAY['live'::text, 'simulator'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_provider_check CHECK ((provider = ANY (ARRAY['athmovil'::text, 'stripe'::text])));
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'awaiting_capture'::text, 'authorizing'::text, 'succeeded'::text, 'canceled'::text, 'expired'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text])));
ALTER TABLE public.pets ADD CONSTRAINT pets_birth_month_check CHECK (((birth_month >= 1) AND (birth_month <= 12)));
ALTER TABLE public.pets ADD CONSTRAINT pets_birth_year_check CHECK (((birth_year >= 1900) AND ((birth_year)::numeric <= EXTRACT(year FROM CURRENT_DATE))));
ALTER TABLE public.pets ADD CONSTRAINT pets_vaccination_status_check CHECK ((vaccination_status = ANY (ARRAY['up_to_date'::text, 'out_of_date'::text, 'unknown'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'manager'::text, 'employee'::text, 'client'::text])));
ALTER TABLE public.staff ADD CONSTRAINT employees_access_role_check CHECK ((access_role = ANY (ARRAY['manager'::text, 'staff'::text, 'admin'::text, 'contractor'::text])));
ALTER TABLE public.staff ADD CONSTRAINT employees_birth_day_check CHECK (((birth_day >= 1) AND (birth_day <= 31)));
ALTER TABLE public.staff ADD CONSTRAINT employees_birth_month_check CHECK (((birth_month >= 1) AND (birth_month <= 12)));
ALTER TABLE public.staff ADD CONSTRAINT employees_invite_status_check CHECK ((invite_status = ANY (ARRAY['not_invited'::text, 'pending'::text, 'active'::text])));
ALTER TABLE public.staff ADD CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));
ALTER TABLE public.staff ADD CONSTRAINT staff_birth_year_range CHECK (((birth_year IS NULL) OR ((birth_year >= 1940) AND (birth_year <= 2010))));
ALTER TABLE public.staff ADD CONSTRAINT staff_compensation_type_check CHECK ((compensation_type = ANY (ARRAY['hourly'::text, 'commission'::text])));
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])));
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_duration_minutes_check CHECK (((duration_minutes IS NULL) OR ((duration_minutes > 0) AND (duration_minutes <= 720))));
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_price_check CHECK (((price IS NULL) OR (price >= (0)::numeric)));
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_request_kind_check CHECK ((request_kind = ANY (ARRAY['new'::text, 'change'::text, 'cancel'::text])));
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_times_check CHECK ((((request_kind = 'cancel'::text) AND (staff_shift_id IS NOT NULL)) OR ((request_kind = 'new'::text) AND (staff_shift_id IS NULL) AND (proposed_start_time IS NOT NULL) AND (proposed_end_time IS NOT NULL) AND (proposed_end_time > proposed_start_time)) OR ((request_kind = 'change'::text) AND (staff_shift_id IS NOT NULL) AND (proposed_start_time IS NOT NULL) AND (proposed_end_time IS NOT NULL) AND (proposed_end_time > proposed_start_time))));
ALTER TABLE public.staff_shifts ADD CONSTRAINT employee_shifts_end_after_start CHECK ((end_time > start_time));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['basic'::text, 'growth'::text, 'pro'::text, 'enterprise'::text])));
ALTER TABLE public.tax_settings ADD CONSTRAINT tax_settings_applies_to_check CHECK ((applies_to = ANY (ARRAY['both'::text, 'service'::text, 'product'::text])));
ALTER TABLE public.tax_settings ADD CONSTRAINT tax_settings_rate_check CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)));
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['active'::text, 'pending_edit'::text, 'approved'::text, 'rejected'::text, 'voided'::text]))));
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.transaction_line_items ADD CONSTRAINT transaction_line_items_quantity_check CHECK ((quantity > (0)::numeric));
ALTER TABLE public.transaction_line_items ADD CONSTRAINT transaction_line_items_type_check CHECK ((type = ANY (ARRAY['product'::text, 'service'::text])));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'ath_movil'::text, 'other'::text])));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_payment_method_secondary_check CHECK (((payment_method_secondary IS NULL) OR (payment_method_secondary = ANY (ARRAY['cash'::text, 'card'::text, 'ath_movil'::text, 'other'::text]))));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'paid'::text, 'partial'::text, 'refunded'::text, 'partial_refund'::text, 'void'::text])));
ALTER TABLE public.admin_impersonation_tokens ADD CONSTRAINT admin_impersonation_tokens_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.admin_impersonation_tokens ADD CONSTRAINT admin_impersonation_tokens_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_notifications ADD CONSTRAINT appointment_notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_booked_by_staff_id_fkey FOREIGN KEY (booked_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_decided_by_profile_id_fkey FOREIGN KEY (decided_by_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_decided_by_staff_id_fkey FOREIGN KEY (decided_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE public.athm_sim_businesses ADD CONSTRAINT athm_sim_businesses_owner_business_id_fkey FOREIGN KEY (owner_business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.athm_sim_payments ADD CONSTRAINT athm_sim_payments_public_token_fkey FOREIGN KEY (public_token) REFERENCES athm_sim_businesses(public_token) ON DELETE CASCADE;
ALTER TABLE public.business_client_links ADD CONSTRAINT business_client_links_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_client_links ADD CONSTRAINT business_client_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.business_payment_secrets ADD CONSTRAINT business_payment_secrets_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_payment_settings ADD CONSTRAINT business_payment_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_slug_aliases ADD CONSTRAINT business_slug_aliases_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.client_business_notes ADD CONSTRAINT client_business_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.client_business_notes ADD CONSTRAINT client_business_notes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_payment_methods ADD CONSTRAINT client_payment_methods_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD CONSTRAINT clients_merged_into_client_id_fkey FOREIGN KEY (merged_into_client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD CONSTRAINT clients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.cookie_consents ADD CONSTRAINT cookie_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employee_invitations ADD CONSTRAINT employee_invitations_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.employee_invitations ADD CONSTRAINT employee_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employee_invitations ADD CONSTRAINT employee_invitations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.feature_rollout ADD CONSTRAINT feature_rollout_feature_key_fk FOREIGN KEY (feature_key) REFERENCES feature_catalog(feature_key) ON DELETE CASCADE;
ALTER TABLE public.feature_visibility_rules ADD CONSTRAINT feature_visibility_rules_feature_key_fkey FOREIGN KEY (feature_key) REFERENCES feature_catalog(feature_key) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES inventory_folders(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_folders ADD CONSTRAINT inventory_folders_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_folders ADD CONSTRAINT inventory_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES inventory_folders(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_stock_movements ADD CONSTRAINT inventory_stock_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_stock_movements ADD CONSTRAINT inventory_stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventory(id) ON DELETE CASCADE;
ALTER TABLE public.nav_order ADD CONSTRAINT nav_order_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventory(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.payment_audit_log ADD CONSTRAINT payment_audit_log_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.payment_secrets ADD CONSTRAINT payment_secrets_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.pet_business_notes ADD CONSTRAINT pet_business_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.pet_business_notes ADD CONSTRAINT pet_business_notes_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;
ALTER TABLE public.pets ADD CONSTRAINT pets_breed_id_fkey FOREIGN KEY (breed_id) REFERENCES breeds(id) ON DELETE SET NULL;
ALTER TABLE public.pets ADD CONSTRAINT pets_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.pets ADD CONSTRAINT pets_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_employee_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.receipt_settings ADD CONSTRAINT receipt_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.services ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.settings ADD CONSTRAINT settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff ADD CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff ADD CONSTRAINT staff_job_title_id_fkey FOREIGN KEY (job_title_id) REFERENCES staff_job_titles(id) ON DELETE SET NULL;
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public.staff_invites ADD CONSTRAINT staff_invites_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.staff_job_titles ADD CONSTRAINT staff_job_titles_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_private ADD CONSTRAINT staff_private_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_private ADD CONSTRAINT staff_private_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE public.staff_service_rates ADD CONSTRAINT staff_service_rates_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.staff_shift_change_requests ADD CONSTRAINT staff_shift_change_requests_staff_shift_id_fkey FOREIGN KEY (staff_shift_id) REFERENCES staff_shifts(id) ON DELETE SET NULL;
ALTER TABLE public.staff_shifts ADD CONSTRAINT employee_shifts_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.staff_shifts ADD CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.support_impersonation_audit ADD CONSTRAINT support_impersonation_audit_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.support_impersonation_audit ADD CONSTRAINT support_impersonation_audit_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE public.support_impersonation_audit ADD CONSTRAINT support_impersonation_audit_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tax_settings ADD CONSTRAINT tax_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_employee_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
ALTER TABLE public.time_entry_edit_requests ADD CONSTRAINT time_entry_edit_requests_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_history ADD CONSTRAINT transaction_history_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_line_items ADD CONSTRAINT transaction_line_items_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_refunds ADD CONSTRAINT transaction_refunds_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_refunds ADD CONSTRAINT transaction_refunds_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES waitlist(id) ON DELETE SET NULL;
ALTER TABLE public.waitlist_survey ADD CONSTRAINT waitlist_survey_waitlist_id_fkey FOREIGN KEY (waitlist_id) REFERENCES waitlist(id) ON DELETE CASCADE;

CREATE INDEX idx_admin_impersonation_tokens_admin_id ON public.admin_impersonation_tokens USING btree (admin_id);
CREATE INDEX idx_admin_impersonation_tokens_business_id ON public.admin_impersonation_tokens USING btree (business_id);
CREATE INDEX idx_impersonation_tokens_expires_at ON public.admin_impersonation_tokens USING btree (expires_at);
CREATE INDEX idx_impersonation_tokens_token ON public.admin_impersonation_tokens USING btree (token);
CREATE INDEX idx_appointment_notifications_appointment ON public.appointment_notifications USING btree (appointment_id, created_at DESC);
CREATE INDEX idx_appointments_booked_by_staff_id ON public.appointments USING btree (booked_by_staff_id) WHERE (booked_by_staff_id IS NOT NULL);
CREATE INDEX idx_appointments_business_client_date ON public.appointments USING btree (business_id, client_id, appointment_date);
CREATE INDEX idx_appointments_business_id ON public.appointments USING btree (business_id);
CREATE INDEX idx_appointments_business_status ON public.appointments USING btree (business_id, status);
CREATE INDEX idx_appointments_client_id ON public.appointments USING btree (client_id);
CREATE INDEX idx_appointments_pet_id ON public.appointments USING btree (pet_id);
CREATE INDEX idx_appointments_transaction_id ON public.appointments USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);
CREATE INDEX athm_sim_payments_ref_idx ON public.athm_sim_payments USING btree (reference_number) WHERE (reference_number IS NOT NULL);
CREATE INDEX athm_sim_payments_token_idx ON public.athm_sim_payments USING btree (public_token, created_at DESC);
CREATE INDEX idx_business_client_links_business_id ON public.business_client_links USING btree (business_id);
CREATE INDEX idx_business_client_links_user_business_status ON public.business_client_links USING btree (user_id, business_id, status);
CREATE INDEX idx_business_client_links_user_id ON public.business_client_links USING btree (user_id);
CREATE INDEX business_slug_aliases_business_id_idx ON public.business_slug_aliases USING btree (business_id);
CREATE INDEX idx_businesses_geofencing_enabled ON public.businesses USING btree (geofencing_enabled);
CREATE INDEX idx_businesses_owner ON public.businesses USING btree (owner_id);
CREATE INDEX idx_businesses_short_code ON public.businesses USING btree (short_code);
CREATE INDEX idx_businesses_slug ON public.businesses USING btree (slug);
CREATE INDEX idx_client_business_notes_business_id ON public.client_business_notes USING btree (business_id);
CREATE INDEX idx_client_business_notes_client_id ON public.client_business_notes USING btree (client_id);
CREATE INDEX idx_client_confirmation_sends_email ON public.client_confirmation_sends USING btree (email, sent_at DESC);
CREATE INDEX idx_client_payment_methods_profile ON public.client_payment_methods USING btree (profile_id);
CREATE UNIQUE INDEX clients_profile_id_unique ON public.clients USING btree (profile_id) WHERE ((profile_id IS NOT NULL) AND (merged_into_client_id IS NULL));
CREATE INDEX idx_clients_business_id ON public.clients USING btree (business_id);
CREATE INDEX idx_clock_pin_attempts_business_time ON public.clock_pin_attempts USING btree (business_id, attempted_at DESC);
CREATE INDEX idx_employee_invitations_business_id ON public.employee_invitations USING btree (business_id);
CREATE INDEX idx_employee_invitations_employee_id ON public.employee_invitations USING btree (employee_id);
CREATE UNIQUE INDEX idx_employee_invitations_one_pending_per_employee ON public.employee_invitations USING btree (employee_id) WHERE (accepted_at IS NULL);
CREATE INDEX idx_guest_bookings_business ON public.guest_bookings USING btree (business_id);
CREATE INDEX idx_guest_bookings_date ON public.guest_bookings USING btree (appointment_date);
CREATE INDEX idx_guest_bookings_email ON public.guest_bookings USING btree (guest_email);
CREATE INDEX idx_inventory_folder_id ON public.inventory USING btree (folder_id);
CREATE UNIQUE INDEX inventory_business_sku_idx ON public.inventory USING btree (business_id, sku);
CREATE INDEX idx_inventory_folders_business_id ON public.inventory_folders USING btree (business_id);
CREATE INDEX idx_inventory_folders_parent_id ON public.inventory_folders USING btree (parent_id);
CREATE INDEX idx_inventory_stock_movements_created_at ON public.inventory_stock_movements USING btree (created_at DESC);
CREATE INDEX idx_inventory_stock_movements_product_id ON public.inventory_stock_movements USING btree (product_id);
CREATE INDEX idx_nav_order_user_id ON public.nav_order USING btree (user_id);
CREATE INDEX idx_notifications_business_id ON public.notifications USING btree (business_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX payment_audit_log_business_idx ON public.payment_audit_log USING btree (business_id, created_at DESC);
CREATE INDEX payments_appointment_idx ON public.payments USING btree (appointment_id) WHERE (appointment_id IS NOT NULL);
CREATE INDEX payments_business_created_idx ON public.payments USING btree (business_id, created_at DESC);
CREATE UNIQUE INDEX payments_provider_payment_uq ON public.payments USING btree (provider, provider_payment_id) WHERE (provider_payment_id IS NOT NULL);
CREATE INDEX idx_pet_business_notes_business_id ON public.pet_business_notes USING btree (business_id);
CREATE INDEX idx_pet_business_notes_pet_id ON public.pet_business_notes USING btree (pet_id);
CREATE INDEX idx_pets_breed_id ON public.pets USING btree (breed_id);
CREATE INDEX idx_pets_business_id ON public.pets USING btree (business_id);
CREATE INDEX idx_pets_client_id ON public.pets USING btree (client_id);
CREATE INDEX idx_profiles_business_id ON public.profiles USING btree (business_id);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_profiles_staff_id ON public.profiles USING btree (staff_id);
CREATE INDEX idx_receipt_settings_business_id ON public.receipt_settings USING btree (business_id);
CREATE INDEX idx_services_business_id ON public.services USING btree (business_id);
CREATE INDEX idx_employees_access_role ON public.staff USING btree (access_role);
CREATE UNIQUE INDEX idx_employees_auth_user_id_unique ON public.staff USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE INDEX idx_employees_business_invite_status ON public.staff USING btree (business_id, invite_status);
CREATE INDEX idx_employees_user_id ON public.staff USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX idx_staff_birthday_lookup ON public.staff USING btree (business_id, birth_month, birth_day) WHERE ((status = 'active'::text) AND (birth_month IS NOT NULL) AND (birth_day IS NOT NULL));
CREATE INDEX idx_staff_business_id ON public.staff USING btree (business_id);
CREATE INDEX idx_staff_pin_set_at ON public.staff USING btree (pin_set_at);
CREATE UNIQUE INDEX staff_business_pin_unique ON public.staff USING btree (business_id, pin) WHERE ((pin IS NOT NULL) AND (btrim(pin) <> ''::text));
CREATE INDEX idx_staff_invites_business ON public.staff_invites USING btree (business_id);
CREATE INDEX idx_staff_invites_email ON public.staff_invites USING btree (email);
CREATE INDEX idx_staff_invites_staff ON public.staff_invites USING btree (staff_id);
CREATE INDEX idx_staff_invites_token ON public.staff_invites USING btree (token);
CREATE UNIQUE INDEX staff_invites_one_pending_per_staff ON public.staff_invites USING btree (staff_id) WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX staff_job_titles_business_title_ci ON public.staff_job_titles USING btree (business_id, lower(TRIM(BOTH FROM title)));
CREATE INDEX idx_staff_private_business ON public.staff_private USING btree (business_id);
CREATE INDEX idx_staff_service_rates_business ON public.staff_service_rates USING btree (business_id);
CREATE INDEX idx_staff_shift_change_requests_business_id ON public.staff_shift_change_requests USING btree (business_id);
CREATE INDEX idx_staff_shift_change_requests_staff_id ON public.staff_shift_change_requests USING btree (staff_id);
CREATE INDEX idx_staff_shift_change_requests_status ON public.staff_shift_change_requests USING btree (status);
CREATE INDEX idx_staff_shifts_business_id ON public.staff_shifts USING btree (business_id);
CREATE INDEX idx_staff_shifts_staff_id ON public.staff_shifts USING btree (staff_id);
CREATE INDEX idx_staff_shifts_start_end ON public.staff_shifts USING btree (start_time, end_time);
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions USING btree (business_id);
CREATE INDEX idx_subscriptions_profile_id ON public.subscriptions USING btree (profile_id);
CREATE INDEX idx_support_impersonation_audit_admin ON public.support_impersonation_audit USING btree (admin_id, created_at DESC);
CREATE INDEX idx_support_impersonation_audit_target ON public.support_impersonation_audit USING btree (target_user_id, created_at DESC);
CREATE INDEX idx_tax_settings_business_id ON public.tax_settings USING btree (business_id);
CREATE INDEX idx_time_entries_business_clock_in ON public.time_entries USING btree (business_id, clock_in DESC);
CREATE INDEX idx_time_entries_edit_request_id ON public.time_entries USING btree (edit_request_id);
CREATE INDEX idx_time_entries_staff_clock_in ON public.time_entries USING btree (staff_id, clock_in DESC);
CREATE INDEX idx_time_entries_status ON public.time_entries USING btree (status);
CREATE INDEX idx_time_entry_edit_requests_business_id ON public.time_entry_edit_requests USING btree (business_id);
CREATE INDEX idx_time_entry_edit_requests_requested_by ON public.time_entry_edit_requests USING btree (requested_by);
CREATE INDEX idx_time_entry_edit_requests_staff_id ON public.time_entry_edit_requests USING btree (staff_id);
CREATE INDEX idx_time_entry_edit_requests_status ON public.time_entry_edit_requests USING btree (status);
CREATE INDEX idx_time_entry_edit_requests_time_entry_id ON public.time_entry_edit_requests USING btree (time_entry_id);
CREATE INDEX idx_transaction_history_business_id ON public.transaction_history USING btree (business_id);
CREATE INDEX idx_transaction_history_transaction_id ON public.transaction_history USING btree (transaction_id);
CREATE INDEX idx_transaction_line_items_transaction_id ON public.transaction_line_items USING btree (transaction_id);
CREATE INDEX idx_transaction_refunds_transaction_id ON public.transaction_refunds USING btree (transaction_id);
CREATE INDEX idx_transactions_business_id ON public.transactions USING btree (business_id);
CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at DESC);
CREATE INDEX idx_transactions_customer_id ON public.transactions USING btree (customer_id);
CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);
CREATE INDEX transactions_business_is_test_idx ON public.transactions USING btree (business_id) WHERE is_test;
CREATE INDEX idx_waitlist_admin_notify_due ON public.waitlist USING btree (admin_notify_at) WHERE ((admin_notify_sent_at IS NULL) AND (admin_notify_at IS NOT NULL));
CREATE INDEX idx_waitlist_confirm_token ON public.waitlist USING btree (confirm_token) WHERE (confirmed = false);
CREATE INDEX idx_waitlist_confirmed ON public.waitlist USING btree (confirmed);
CREATE INDEX idx_waitlist_referred_by_code ON public.waitlist USING btree (referred_by_code) WHERE (referred_by_code IS NOT NULL);
CREATE UNIQUE INDEX waitlist_email_unique ON public.waitlist USING btree (lower(email));
CREATE INDEX idx_waitlist_survey_waitlist_id ON public.waitlist_survey USING btree (waitlist_id);

-- ---------- triggers ----------
CREATE TRIGGER trg_appointments_pet_matches_client BEFORE INSERT OR UPDATE OF client_id, pet_id ON public.appointments FOR EACH ROW EXECUTE FUNCTION appointments_pet_matches_client();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE TRIGGER on_auth_user_email_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_auth_user_email_updated();
CREATE TRIGGER update_breeds_updated_at BEFORE UPDATE ON public.breeds FOR EACH ROW EXECUTE FUNCTION update_breeds_updated_at();
CREATE TRIGGER update_business_client_links_updated_at BEFORE UPDATE ON public.business_client_links FOR EACH ROW EXECUTE FUNCTION update_business_client_links_updated_at();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER feature_catalog_set_updated_at BEFORE UPDATE ON public.feature_catalog FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
CREATE TRIGGER feature_rollout_set_updated_at BEFORE UPDATE ON public.feature_rollout FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
CREATE TRIGGER feature_visibility_rules_set_updated_at BEFORE UPDATE ON public.feature_visibility_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
CREATE TRIGGER set_inventory_updated_at_trigger BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION set_inventory_updated_at();
CREATE TRIGGER trigger_update_vaccination_status BEFORE INSERT OR UPDATE OF last_vaccination_date ON public.pets FOR EACH ROW EXECUTE FUNCTION update_vaccination_status();
CREATE TRIGGER enforce_super_admin_domain_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_domain();
CREATE TRIGGER profiles_enforce_super_admin_mutations BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_enforce_super_admin_mutations();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER staff_enforce_access_role_mutations BEFORE INSERT OR UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION staff_enforce_access_role_mutations();
CREATE TRIGGER staff_move_private_fields_insert AFTER INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION staff_move_private_fields_after_insert();
CREATE TRIGGER staff_move_private_fields_update BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION staff_move_private_fields();
CREATE TRIGGER staff_sync_name_and_role_trigger BEFORE INSERT OR UPDATE OF first_name, last_name, job_title_id ON public.staff FOR EACH ROW EXECUTE FUNCTION staff_sync_name_and_role_from_parts();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_job_titles_updated_at BEFORE UPDATE ON public.staff_job_titles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_service_rates_updated_at BEFORE UPDATE ON public.staff_service_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_shift_change_requests_updated_at BEFORE UPDATE ON public.staff_shift_change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_shifts_updated_at BEFORE UPDATE ON public.staff_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entry_edit_requests_updated_at BEFORE UPDATE ON public.time_entry_edit_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_transaction_number_trigger BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION set_transaction_number();
CREATE TRIGGER transactions_guard_is_test BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION transactions_guard_is_test();

-- ---------- row level security ----------
ALTER TABLE public.admin_impersonation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athm_sim_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athm_sim_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_payment_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_slug_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_business_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_confirmation_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_pin_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_rollout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_visibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_business_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_service_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shift_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_impersonation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_survey ENABLE ROW LEVEL SECURITY;

-- ---------- policies ----------
CREATE POLICY "Super admins can manage impersonation tokens" ON public.admin_impersonation_tokens AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true)))));

CREATE POLICY "Business members read appointment notifications" ON public.appointment_notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY "Appointments delete" ON public.appointments AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Appointments insert" ON public.appointments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Appointments select" ON public.appointments AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Appointments update" ON public.appointments AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Clients can read own appointments" ON public.appointments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = appointments.client_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL) AND ((NOT (c.business_id IS DISTINCT FROM appointments.business_id)) OR ((c.business_id IS NULL) AND (appointments.business_id IS NOT NULL)))))));

CREATE POLICY "Demo workspace read appointments" ON public.appointments AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Users can access appointments from their business" ON public.appointments AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))) OR ((staff_id IS NOT NULL) AND (staff_id IN ( SELECT (s.id)::text AS id
   FROM staff s
  WHERE (s.user_id = auth.uid()))))))));

CREATE POLICY "Users can manage appointments from their business" ON public.appointments AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY "Breeds select" ON public.breeds AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Business can read client links for their business" ON public.business_client_links AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Super admins can update business_client_links" ON public.business_client_links AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))));

CREATE POLICY "Users can insert own business_client_link" ON public.business_client_links AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own business_client_links" ON public.business_client_links AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update own business_client_link" ON public.business_client_links AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Business members read payment settings" ON public.business_payment_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY "Anyone can read business slug aliases" ON public.business_slug_aliases AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Managers can insert aliases for their business" ON public.business_slug_aliases AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE (p.id = auth.uid()))));

CREATE POLICY "Businesses delete" ON public.businesses AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true)))));

CREATE POLICY "Businesses insert" ON public.businesses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

CREATE POLICY "Businesses select" ON public.businesses AS PERMISSIVE FOR SELECT TO public
  USING (((id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Businesses update" ON public.businesses AS PERMISSIVE FOR UPDATE TO public
  USING (((id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Public can read businesses with slug for directory" ON public.businesses AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((slug IS NOT NULL) AND (btrim(slug) <> ''::text)));

CREATE POLICY "Public read demo business row" ON public.businesses AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() IS NULL) AND (id = '00000000-0000-0000-0000-000000000001'::uuid)));

CREATE POLICY "Business members can read client_business_notes" ON public.client_business_notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = client_business_notes.business_id) AND client_has_appointment_for_business((client_business_notes.client_id)::text, (p.business_id)::text)))) OR (EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = client_business_notes.business_id)))))));

CREATE POLICY "Staff can manage client_business_notes" ON public.client_business_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = client_business_notes.business_id) AND (client_has_appointment_for_business((client_business_notes.client_id)::text, (p.business_id)::text) OR (EXISTS ( SELECT 1
           FROM clients cl
          WHERE ((cl.id = client_business_notes.client_id) AND (NOT (cl.business_id IS DISTINCT FROM p.business_id))))))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = client_business_notes.business_id) AND (client_has_appointment_for_business((client_business_notes.client_id)::text, (p.business_id)::text) OR (EXISTS ( SELECT 1
           FROM clients cl
          WHERE ((cl.id = client_business_notes.client_id) AND (NOT (cl.business_id IS DISTINCT FROM p.business_id))))))))))));

CREATE POLICY "Users manage own saved payment methods" ON public.client_payment_methods AS PERMISSIVE FOR ALL TO authenticated
  USING ((profile_id = auth.uid()))
  WITH CHECK ((profile_id = auth.uid()));

CREATE POLICY "Business members can read clients linked by appointments" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND client_has_appointment_for_business((clients.id)::text, (p.business_id)::text)))) OR (EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true))))));

CREATE POLICY "Clients can insert own client profile" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((profile_id = auth.uid()) AND (merged_into_client_id IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::text))))));

CREATE POLICY "Clients can read own client row" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::text))))));

CREATE POLICY "Clients can update own client row" ON public.clients AS PERMISSIVE FOR UPDATE TO public
  USING (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::text))))))
  WITH CHECK (((profile_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'client'::text))))));

CREATE POLICY "Clients delete" ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Clients insert" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Clients select" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Clients update" ON public.clients AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Demo workspace read clients" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Managers can manage clients in their business" ON public.clients AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Users can access clients from their business" ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY clients_delete_managers ON public.clients AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY clients_insert_managers ON public.clients AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY clients_update_managers ON public.clients AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY "Managers can insert employee_invitations for their business" ON public.employee_invitations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Managers can view employee_invitations for their business" ON public.employee_invitations AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY feature_catalog_manage_super_admin ON public.feature_catalog AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))));

CREATE POLICY feature_catalog_select_authenticated ON public.feature_catalog AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY feature_rollout_manage_super_admin ON public.feature_rollout AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))));

CREATE POLICY feature_rollout_select_authenticated ON public.feature_rollout AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY feature_visibility_rules_manage_super_admin ON public.feature_visibility_rules AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))));

CREATE POLICY feature_visibility_rules_select_authenticated ON public.feature_visibility_rules AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Business staff can view guest bookings" ON public.guest_bookings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((business_id = get_my_business_id()) OR is_super_admin()));

CREATE POLICY "Staff can update guest bookings" ON public.guest_bookings AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((business_id = get_my_business_id()));

CREATE POLICY "Users can create guest bookings for their business" ON public.guest_bookings AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Demo workspace read inventory" ON public.inventory AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Inventory delete" ON public.inventory AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Inventory insert" ON public.inventory AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Inventory select" ON public.inventory AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Inventory update" ON public.inventory AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Managers can manage inventory from their business" ON public.inventory AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Users can manage folders for their business" ON public.inventory_folders AS PERMISSIVE FOR ALL TO public
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Business users can manage stock movements" ON public.inventory_stock_movements AS PERMISSIVE FOR ALL TO public
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Users can manage own nav_order" ON public.nav_order AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can manage own notifications" ON public.notifications AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users insert own notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users select own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Users update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Managers read payment audit log" ON public.payment_audit_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY "Business members read payments" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY "Business members can read pet_business_notes" ON public.pet_business_notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = pet_business_notes.business_id) AND pet_has_appointment_for_business(pet_business_notes.pet_id, (p.business_id)::text)))) OR (EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = pet_business_notes.business_id)))))));

CREATE POLICY "Staff can manage pet_business_notes" ON public.pet_business_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = pet_business_notes.business_id) AND (pet_has_appointment_for_business(pet_business_notes.pet_id, (p.business_id)::text) OR (EXISTS ( SELECT 1
           FROM pets pt
          WHERE ((pt.id = pet_business_notes.pet_id) AND (NOT (pt.business_id IS DISTINCT FROM p.business_id))))))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (p.business_id = pet_business_notes.business_id) AND (pet_has_appointment_for_business(pet_business_notes.pet_id, (p.business_id)::text) OR (EXISTS ( SELECT 1
           FROM pets pt
          WHERE ((pt.id = pet_business_notes.pet_id) AND (NOT (pt.business_id IS DISTINCT FROM p.business_id))))))))))));

CREATE POLICY "Business members can read pets linked by appointments" ON public.pets AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND pet_has_appointment_for_business(pets.id, (p.business_id)::text)))) OR (EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true))))));

CREATE POLICY "Clients can delete own pets" ON public.pets AS PERMISSIVE FOR DELETE TO authenticated
  USING (((business_id IS NULL) AND (EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = pets.client_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL))))));

CREATE POLICY "Clients can insert own pets" ON public.pets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IS NULL) AND (EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = pets.client_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL))))));

CREATE POLICY "Clients can read own pets" ON public.pets AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = pets.client_id) AND (c.profile_id = auth.uid()) AND (c.merged_into_client_id IS NULL) AND (p.role = 'client'::text)))));

CREATE POLICY "Clients can update own pets" ON public.pets AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = pets.client_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL)))))
  WITH CHECK (((business_id IS NULL) AND (EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = pets.client_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL))))));

CREATE POLICY "Demo workspace read pets" ON public.pets AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Managers can delete pets for their business" ON public.pets AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND ((NOT (pets.business_id IS DISTINCT FROM p.business_id)) OR pet_has_appointment_for_business(pets.id, (p.business_id)::text))))))));

CREATE POLICY "Managers can insert pets for their business" ON public.pets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND (NOT (pets.business_id IS DISTINCT FROM p.business_id))))))));

CREATE POLICY "Managers can select pets for their business" ON public.pets AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND ((NOT (pets.business_id IS DISTINCT FROM p.business_id)) OR pet_has_appointment_for_business(pets.id, (p.business_id)::text))))))));

CREATE POLICY "Managers can update pets for their business" ON public.pets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND ((NOT (pets.business_id IS DISTINCT FROM p.business_id)) OR pet_has_appointment_for_business(pets.id, (p.business_id)::text))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles sp
  WHERE ((sp.id = auth.uid()) AND (sp.is_super_admin = true)))) OR (profile_is_manager_or_super_admin(auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL) AND ((NOT (pets.business_id IS DISTINCT FROM p.business_id)) OR pet_has_appointment_for_business(pets.id, (p.business_id)::text))))))));

CREATE POLICY "Pets delete" ON public.pets AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Pets insert" ON public.pets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Pets select" ON public.pets AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Pets update" ON public.pets AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY pets_delete_managers ON public.pets AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY pets_insert_managers ON public.pets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY pets_update_managers ON public.pets AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY "Profiles select" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = id) OR is_super_admin()));

CREATE POLICY "Profiles update" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING (((( SELECT auth.uid() AS uid) = id) OR is_super_admin()))
  WITH CHECK (((( SELECT auth.uid() AS uid) = id) OR is_super_admin()));

CREATE POLICY "System can insert profiles" ON public.profiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Business users can manage receipt_settings" ON public.receipt_settings AS PERMISSIVE FOR ALL TO public
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Business members can read services from their business" ON public.services AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY "Demo workspace read services" ON public.services AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Managers can delete services from their business" ON public.services AS PERMISSIVE FOR DELETE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Managers can insert services from their business" ON public.services AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Managers can update services from their business" ON public.services AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Services delete" ON public.services AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Services insert" ON public.services AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Services select" ON public.services AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Services update" ON public.services AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Managers can insert settings for their business" ON public.settings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Managers can read settings for their business" ON public.settings AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Managers can update settings for their business" ON public.settings AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Public read demo settings row" ON public.settings AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() IS NULL) AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid)));

CREATE POLICY "Demo workspace read employees" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Demo workspace read staff" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Employees delete" ON public.staff AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees insert" ON public.staff AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees select" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING ((((( SELECT auth.uid() AS uid) IS NULL) AND ((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text))) OR (business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Employees update" ON public.staff AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Users can access employees from their business" ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))) OR (id IN ( SELECT p.staff_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.staff_id IS NOT NULL))))))));

CREATE POLICY "Users can manage employees from their business" ON public.staff AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY employee_update_own_staff_row ON public.staff AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY employees_delete_managers ON public.staff AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employees_insert_managers ON public.staff AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employees_select_business ON public.staff AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = staff.business_id) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'employee'::text) AND (p.staff_id = staff.id))))))));

CREATE POLICY employees_update_managers ON public.staff AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY managers_manage_staff_invites ON public.staff_invites AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))) OR ((business_id IN ( SELECT p2.business_id
   FROM profiles p2
  WHERE ((p2.id = auth.uid()) AND (p2.business_id IS NOT NULL)))) AND (EXISTS ( SELECT 1
   FROM profiles p3
  WHERE ((p3.id = auth.uid()) AND ((p3.role = ANY (ARRAY['manager'::text, 'super_admin'::text])) OR (p3.is_super_admin = true))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))) OR ((business_id IN ( SELECT p2.business_id
   FROM profiles p2
  WHERE ((p2.id = auth.uid()) AND (p2.business_id IS NOT NULL)))) AND (EXISTS ( SELECT 1
   FROM profiles p3
  WHERE ((p3.id = auth.uid()) AND ((p3.role = ANY (ARRAY['manager'::text, 'super_admin'::text])) OR (p3.is_super_admin = true))))))));

CREATE POLICY "Demo workspace read staff_job_titles" ON public.staff_job_titles AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY staff_job_titles_delete ON public.staff_job_titles AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY staff_job_titles_insert ON public.staff_job_titles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY staff_job_titles_select ON public.staff_job_titles AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY staff_job_titles_update ON public.staff_job_titles AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY "Managers read staff private details" ON public.staff_private AS PERMISSIVE FOR SELECT TO authenticated
  USING (can_manage_staff_private(business_id));

CREATE POLICY "Managers write staff private details" ON public.staff_private AS PERMISSIVE FOR ALL TO authenticated
  USING (can_manage_staff_private(business_id))
  WITH CHECK ((can_manage_staff_private(business_id) AND (EXISTS ( SELECT 1
   FROM staff s
  WHERE ((s.id = staff_private.staff_id) AND (s.business_id = staff_private.business_id))))));

CREATE POLICY "Business members read staff service rates" ON public.staff_service_rates AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL))))));

CREATE POLICY "Demo workspace read staff service rates" ON public.staff_service_rates AS PERMISSIVE FOR SELECT TO public
  USING ((business_id = '00000000-0000-0000-0000-000000000001'::uuid));

CREATE POLICY "Managers manage staff service rates" ON public.staff_service_rates AS PERMISSIVE FOR ALL TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY staff_shift_change_requests_employee_cancel ON public.staff_shift_change_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((requested_by = auth.uid()) AND (status = 'pending'::text) AND (staff_id IN ( SELECT s.id
   FROM staff s
  WHERE (s.user_id = auth.uid())))))
  WITH CHECK (((status = 'cancelled'::text) AND (requested_by = auth.uid())));

CREATE POLICY staff_shift_change_requests_insert_own_staff ON public.staff_shift_change_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((requested_by = auth.uid()) AND (staff_id IN ( SELECT s.id
   FROM staff s
  WHERE (s.user_id = auth.uid()))) AND (business_id IN ( SELECT s.business_id
   FROM staff s
  WHERE (s.id = staff_shift_change_requests.staff_id)))));

CREATE POLICY staff_shift_change_requests_select ON public.staff_shift_change_requests AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (requested_by = auth.uid()) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY staff_shift_change_requests_update_managers ON public.staff_shift_change_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY "Demo workspace read staff_shifts" ON public.staff_shifts AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Users can access employee_shifts from their business" ON public.staff_shifts AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))) OR (staff_id IN ( SELECT s.id
   FROM staff s
  WHERE (s.user_id = auth.uid())))))));

CREATE POLICY "Users can manage employee_shifts in their business" ON public.staff_shifts AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY employee_shifts_delete_managers ON public.staff_shifts AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employee_shifts_select_business ON public.staff_shifts AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = staff_shifts.business_id) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'employee'::text) AND (p.staff_id = staff_shifts.staff_id))))))));

CREATE POLICY employee_shifts_update_managers ON public.staff_shifts AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY employee_shifts_write_managers ON public.staff_shifts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY "Authenticated can insert own subscription record" ON public.subscriptions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((profile_id = auth.uid()));

CREATE POLICY "Subscriptions delete" ON public.subscriptions AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Subscriptions insert" ON public.subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Subscriptions select" ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Subscriptions update" ON public.subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Users can read subscriptions for own business" ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Business users can manage tax_settings" ON public.tax_settings AS PERMISSIVE FOR ALL TO public
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))))
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY "Time entries delete" ON public.time_entries AS PERMISSIVE FOR DELETE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Time entries insert" ON public.time_entries AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Time entries select" ON public.time_entries AS PERMISSIVE FOR SELECT TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Time entries update" ON public.time_entries AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Users can access time_entries from their business" ON public.time_entries AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id IS NOT NULL)))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))) OR ((staff_id IS NOT NULL) AND (staff_id IN ( SELECT (s.id)::text AS id
   FROM staff s
  WHERE (s.user_id = auth.uid()))))))));

CREATE POLICY "Users can manage time_entries from their business" ON public.time_entries AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND ((p.is_super_admin = true) OR (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))));

CREATE POLICY time_entries_delete_managers ON public.time_entries AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY time_entries_insert_managers ON public.time_entries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY time_entries_select_business ON public.time_entries AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.business_id = time_entries.business_id) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'employee'::text) AND ((p.staff_id)::text = time_entries.staff_id))))))));

CREATE POLICY time_entries_update_managers ON public.time_entries AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR (business_id IN ( SELECT p.business_id
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['manager'::text, 'super_admin'::text])))))));

CREATE POLICY "Managers can update edit requests in their business" ON public.time_entry_edit_requests AS PERMISSIVE FOR UPDATE TO public
  USING (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))))
  WITH CHECK (((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true))))));

CREATE POLICY "Staff can create edit requests for own entries" ON public.time_entry_edit_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((staff_id)::text IN ( SELECT (s.id)::text AS id
   FROM (staff s
     JOIN profiles p ON ((p.staff_id = s.id)))
  WHERE (p.id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM time_entries te
  WHERE ((te.id = time_entry_edit_requests.time_entry_id) AND (te.staff_id = (time_entry_edit_requests.staff_id)::text))))));

CREATE POLICY "Staff can view their own edit requests" ON public.time_entry_edit_requests AS PERMISSIVE FOR SELECT TO public
  USING (((requested_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Managers can manage transaction history from their business" ON public.transaction_history AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Users can insert transaction history for their business" ON public.transaction_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid())
UNION
 SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))));

CREATE POLICY "Users can view transaction history for their business" ON public.transaction_history AS PERMISSIVE FOR SELECT TO public
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid())
UNION
 SELECT businesses.id
   FROM businesses
  WHERE (businesses.owner_id = auth.uid()))));

CREATE POLICY "Clients can read own transaction line items" ON public.transaction_line_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM ((transactions t
     JOIN clients c ON ((c.id = t.customer_id)))
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((t.id = transaction_line_items.transaction_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL) AND ((NOT (c.business_id IS DISTINCT FROM t.business_id)) OR ((c.business_id IS NULL) AND (t.business_id IS NOT NULL)))))));

CREATE POLICY "Demo workspace read transaction line items" ON public.transaction_line_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND ((t.business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((t.business_id)::text = '00000000-0000-0000-0000-000000000001'::text))))));

CREATE POLICY "Managers can manage transaction line items from their business" ON public.transaction_line_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND ((EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid())))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND ((EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid())))))));

CREATE POLICY "Public read for demo transaction_line_items" ON public.transaction_line_items AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() IS NULL) AND (EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND (t.business_id = '00000000-0000-0000-0000-000000000001'::uuid))))));

CREATE POLICY transaction_line_items_delete ON public.transaction_line_items AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_line_items_insert ON public.transaction_line_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_line_items_select ON public.transaction_line_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_line_items_update ON public.transaction_line_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_line_items.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY "Managers can manage transaction refunds from their business" ON public.transaction_refunds AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND ((EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid())))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND ((EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid())))))));

CREATE POLICY transaction_refunds_delete ON public.transaction_refunds AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_refunds_insert ON public.transaction_refunds AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_refunds_select ON public.transaction_refunds AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY transaction_refunds_update ON public.transaction_refunds AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM transactions t
  WHERE ((t.id = transaction_refunds.transaction_id) AND (t.business_id IN ( SELECT profiles.business_id
           FROM profiles
          WHERE (profiles.id = auth.uid())))))));

CREATE POLICY "Clients can read own transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (clients c
     JOIN profiles p ON ((p.id = auth.uid())))
  WHERE ((c.id = transactions.customer_id) AND (c.profile_id = auth.uid()) AND (p.role = 'client'::text) AND (c.merged_into_client_id IS NULL) AND ((NOT (c.business_id IS DISTINCT FROM transactions.business_id)) OR ((c.business_id IS NULL) AND (transactions.business_id IS NOT NULL)))))));

CREATE POLICY "Demo workspace read transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO public
  USING (((business_id = '00000000-0000-0000-0000-000000000001'::uuid) OR ((business_id)::text = '00000000-0000-0000-0000-000000000001'::text)));

CREATE POLICY "Managers can manage transactions from their business" ON public.transactions AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_super_admin = true)))) OR ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) AND profile_is_manager_or_super_admin(auth.uid()))));

CREATE POLICY "Public read for demo transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() IS NULL) AND (business_id = '00000000-0000-0000-0000-000000000001'::uuid)));

CREATE POLICY transactions_delete ON public.transactions AS PERMISSIVE FOR DELETE TO authenticated
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY transactions_insert ON public.transactions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY transactions_select ON public.transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

CREATE POLICY transactions_update ON public.transactions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((business_id IN ( SELECT profiles.business_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))));
