-- Rollback for 20261010220000_automations_builder_coupons_follow_ups.sql (destroys coupons, follow-ups and business automations).
DELETE FROM public.feature_visibility_rules WHERE feature_key = 'automations';
DELETE FROM public.feature_rollout WHERE feature_key = 'automations';
DELETE FROM public.feature_catalog WHERE feature_key = 'automations';

DROP FUNCTION IF EXISTS public.follow_up_candidates(uuid);
DROP TABLE IF EXISTS public.client_follow_ups;
ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_grooming_interval_weeks_range;
ALTER TABLE public.pets DROP COLUMN IF EXISTS grooming_interval_weeks;
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_follow_up_weeks_range;
ALTER TABLE public.settings DROP COLUMN IF EXISTS follow_up_weeks;

DROP FUNCTION IF EXISTS public.redeem_coupon(text, uuid, uuid, text, bigint);
DROP FUNCTION IF EXISTS public.check_coupon(text, uuid);
DROP FUNCTION IF EXISTS public.attach_booking_coupon(text, text, text, text);
DROP FUNCTION IF EXISTS public.check_booking_coupon(text, text, text);
DROP FUNCTION IF EXISTS public.booking_coupons_enabled(text);
DROP FUNCTION IF EXISTS public.coupon_lookup(uuid, text, uuid, text, boolean);
ALTER TABLE public.appointments DROP COLUMN IF EXISTS coupon_offer_id;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS coupon_code;
DROP TABLE IF EXISTS public.coupon_redemptions;
DROP TABLE IF EXISTS public.coupons;
DROP TABLE IF EXISTS public.coupon_offers;

DROP POLICY IF EXISTS automation_runs_business_read ON public.automation_runs;
DROP INDEX IF EXISTS public.automation_runs_once_per_subject;
DELETE FROM public.automation_runs WHERE status = 'skipped';
ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_status_check;
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_status_check CHECK (status IN ('sent', 'failed', 'test'));
ALTER TABLE public.automation_runs DROP COLUMN IF EXISTS subject_key;

DROP POLICY IF EXISTS automations_business_manage ON public.automations;
DROP POLICY IF EXISTS automations_managers_read ON public.automations;
CREATE POLICY automations_managers_read ON public.automations
  FOR SELECT TO authenticated
  USING (public.profile_is_manager_or_super_admin(auth.uid()));
DELETE FROM public.automations WHERE business_id IS NOT NULL OR trigger_type NOT IN ('pet_birthday') OR action_type <> 'email_owner';
DROP FUNCTION IF EXISTS public.can_manage_automations(uuid);
DROP INDEX IF EXISTS public.automations_business;
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_name_length;
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_platform_triggers_only_for_grumi;
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_action_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_action_type_check CHECK (action_type IN ('email_owner'));
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check CHECK (trigger_type IN ('pet_birthday'));
ALTER TABLE public.automations
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS event_cursor,
  DROP COLUMN IF EXISTS last_run_at,
  DROP COLUMN IF EXISTS schedule,
  DROP COLUMN IF EXISTS conditions,
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS business_id;
