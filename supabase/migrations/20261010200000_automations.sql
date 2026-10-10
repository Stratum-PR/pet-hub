-- Automations (admin portal): trigger -> action rules, run daily by the run-automations Edge Function.
-- First rule: pet birthday -> email the owner.
--
-- Expand-only: new nullable column + new tables. Nothing existing changes behavior.
-- The daily schedule (pg_cron + pg_net) is set up separately in supabase/setup/automations_cron.sql,
-- because it needs this project's function URL and a generated secret.

-- 1) Optional birth day on pets (month/year already exist).
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS birth_day smallint;

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_birth_day_range;
ALTER TABLE public.pets
  ADD CONSTRAINT pets_birth_day_range CHECK (birth_day IS NULL OR (birth_day BETWEEN 1 AND 31));

-- 2) Automations, defined by super admins for the whole platform.
CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('pet_birthday')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL CHECK (action_type IN ('email_owner')),
  -- email_owner: { "subject": text, "body": text } with {{placeholders}}
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Per-business opt-out. No row = on (automations apply to every business by default).
CREATE TABLE IF NOT EXISTS public.business_automation_settings (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, automation_id)
);

-- 4) Run log; the unique key makes each automation fire at most once per pet per occurrence.
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  pet_id text,
  client_id uuid,
  occurrence_key text NOT NULL,           -- e.g. '2026' for a yearly birthday
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'test')),
  recipient text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_once_per_occurrence
  ON public.automation_runs (automation_id, pet_id, occurrence_key)
  WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS automation_runs_recent ON public.automation_runs (created_at DESC);

-- updated_at
CREATE OR REPLACE FUNCTION public.automations_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS automations_touch ON public.automations;
CREATE TRIGGER automations_touch BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch_updated_at();
DROP TRIGGER IF EXISTS business_automation_settings_touch ON public.business_automation_settings;
CREATE TRIGGER business_automation_settings_touch BEFORE UPDATE ON public.business_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.automations_touch_updated_at();

-- RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- automations: super admins manage; business managers can read the list (to show their on/off switches).
DROP POLICY IF EXISTS automations_super_admin_all ON public.automations;
CREATE POLICY automations_super_admin_all ON public.automations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS automations_managers_read ON public.automations;
CREATE POLICY automations_managers_read ON public.automations
  FOR SELECT TO authenticated
  USING (public.profile_is_manager_or_super_admin(auth.uid()));

-- business_automation_settings: managers of that business (and super admins) read and write.
DROP POLICY IF EXISTS business_automation_settings_managers ON public.business_automation_settings;
CREATE POLICY business_automation_settings_managers ON public.business_automation_settings
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

-- automation_runs: super admins read; only the Edge Function (service role) writes.
DROP POLICY IF EXISTS automation_runs_super_admin_read ON public.automation_runs;
CREATE POLICY automation_runs_super_admin_read ON public.automation_runs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

REVOKE ALL ON public.automation_runs FROM anon;
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_automation_settings TO authenticated;
REVOKE ALL ON public.automations, public.business_automation_settings FROM anon;

-- The daily caller proves itself with a secret kept in Vault; only the service role may check it.
CREATE OR REPLACE FUNCTION public.automation_cron_secret_matches(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT coalesce(p_secret, '') <> ''
     AND EXISTS (
       SELECT 1 FROM vault.decrypted_secrets
       WHERE name = 'automations_cron_secret' AND decrypted_secret = p_secret
     );
$$;
REVOKE ALL ON FUNCTION public.automation_cron_secret_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_cron_secret_matches(text) TO service_role;

-- Starter automation (off until a super admin turns it on in the admin portal).
INSERT INTO public.automations (name, trigger_type, trigger_config, action_type, action_config, enabled)
SELECT
  'Cumpleaños de mascota',
  'pet_birthday',
  '{}'::jsonb,
  'email_owner',
  jsonb_build_object(
    'subject', '¡Feliz cumpleaños, {{pet_name}}! 🎉',
    'body', E'Hola {{owner_first_name}},\n\n¡{{pet_name}} está de cumpleaños! Todo el equipo de {{business_name}} le desea un día lleno de mimos y golosinas.\n\nSi quieres celebrarlo con un baño o arreglo especial, aquí estamos.\n\n¡Un abrazo!\n{{business_name}}'
  ),
  false
WHERE NOT EXISTS (SELECT 1 FROM public.automations WHERE trigger_type = 'pet_birthday');
