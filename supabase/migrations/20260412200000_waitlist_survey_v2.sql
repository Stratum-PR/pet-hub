-- Waitlist survey v2: multi-select tools, extra feature flags, groomer bucket values.
ALTER TABLE public.waitlist_survey
  ADD COLUMN IF NOT EXISTS tools_selected jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tools_other text,
  ADD COLUMN IF NOT EXISTS wants_costo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_staff_management boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_charge_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_inventory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_advanced_reports boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.waitlist_survey.tools_selected IS 'JSON array of keys: pen-paper, spreadsheet, software, other';
COMMENT ON COLUMN public.waitlist_survey.tools_other IS 'Optional detail when other tool is selected; max 180 chars enforced in app/edge';
