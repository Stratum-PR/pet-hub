-- Rollback for 20261010200000_automations.sql
-- Run supabase/setup/automations_cron.sql's "Undo" block first if the daily schedule was set up.
DROP FUNCTION IF EXISTS public.automation_cron_secret_matches(text);
DROP TABLE IF EXISTS public.automation_runs;
DROP TABLE IF EXISTS public.business_automation_settings;
DROP TABLE IF EXISTS public.automations;
DROP FUNCTION IF EXISTS public.automations_touch_updated_at();
ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_birth_day_range;
ALTER TABLE public.pets DROP COLUMN IF EXISTS birth_day;
