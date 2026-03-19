-- Replace key/value settings with one row per business (destroy existing data).
-- Drop existing table and policies, then recreate with typed columns.

DROP POLICY IF EXISTS "Users can read settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can update settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can insert settings for their business" ON public.settings;
DROP POLICY IF EXISTS "Allow all operations on settings" ON public.settings;

DROP TABLE IF EXISTS public.settings;

CREATE TABLE public.settings (
  business_id UUID NOT NULL PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_name TEXT,
  business_hours TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  default_low_stock_threshold TEXT,
  pay_schedule_anchor_date TEXT,
  pay_schedule_cadence_weeks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read settings from their business"
ON public.settings FOR SELECT
USING (
  business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Users can update settings from their business"
ON public.settings FOR UPDATE
USING (
  business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
)
WITH CHECK (
  business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Users can insert settings for their business"
ON public.settings FOR INSERT
WITH CHECK (
  business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.settings IS 'One row per business: theme, hours, pay schedule, low-stock threshold. business_name can mirror businesses.name.';
