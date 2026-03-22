-- Allow anonymous users to read the fixed demo business row and its settings row
-- so /demo/* can hydrate business name, theme, hours, etc. from the database.

BEGIN;

DROP POLICY IF EXISTS "Public read demo business row" ON public.businesses;
CREATE POLICY "Public read demo business row"
  ON public.businesses
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND id = '00000000-0000-0000-0000-000000000001'::uuid
  );

DROP POLICY IF EXISTS "Public read demo settings row" ON public.settings;
CREATE POLICY "Public read demo settings row"
  ON public.settings
  FOR SELECT
  USING (
    auth.uid() IS NULL
    AND business_id = '00000000-0000-0000-0000-000000000001'::uuid
  );

COMMIT;
