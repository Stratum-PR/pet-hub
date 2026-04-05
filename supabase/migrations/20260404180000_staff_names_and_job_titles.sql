-- Split staff display name into first/last; canonical job titles per business (case-insensitive unique).
--
-- Supabase SQL Editor may warn about "destructive" steps: DROP TRIGGER/POLICY IF EXISTS here only
-- recreates policies and triggers idempotently; it does not drop tables or data.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_job_titles_business_title_ci
  ON public.staff_job_titles (business_id, lower(trim(both from title)));

DROP TRIGGER IF EXISTS update_staff_job_titles_updated_at ON public.staff_job_titles;
CREATE TRIGGER update_staff_job_titles_updated_at
  BEFORE UPDATE ON public.staff_job_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title_id UUID REFERENCES public.staff_job_titles(id) ON DELETE SET NULL;

-- Backfill first / last from legacy full name
UPDATE public.staff s
SET
  first_name = CASE
    WHEN POSITION(' ' IN TRIM(COALESCE(s.name, ''))) = 0 THEN NULLIF(TRIM(COALESCE(s.name, '')), '')
    ELSE TRIM(SUBSTRING(TRIM(COALESCE(s.name, '')) FROM 1 FOR POSITION(' ' IN TRIM(COALESCE(s.name, ''))) - 1))
  END,
  last_name = CASE
    WHEN POSITION(' ' IN TRIM(COALESCE(s.name, ''))) = 0 THEN ''
    ELSE TRIM(SUBSTRING(TRIM(COALESCE(s.name, '')) FROM POSITION(' ' IN TRIM(COALESCE(s.name, ''))) + 1))
  END
WHERE s.first_name IS NULL
  AND s.last_name IS NULL;

UPDATE public.staff
SET first_name = 'Staff'
WHERE first_name IS NULL OR TRIM(first_name) = '';

-- Normalize NULL last names only (same effect as COALESCE(last_name,'') for NOT NULL, without updating every row)
UPDATE public.staff
SET last_name = ''
WHERE last_name IS NULL;

ALTER TABLE public.staff ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE public.staff ALTER COLUMN last_name SET NOT NULL;

-- Seed one row per distinct job title (role) per business; Title Case canonical form
INSERT INTO public.staff_job_titles (business_id, title)
SELECT DISTINCT ON (s.business_id, lower(trim(s.role)))
  s.business_id,
  initcap(lower(trim(s.role)))
FROM public.staff s
WHERE NULLIF(trim(s.role), '') IS NOT NULL
ORDER BY s.business_id, lower(trim(s.role));

UPDATE public.staff s
SET job_title_id = t.id
FROM public.staff_job_titles t
WHERE t.business_id = s.business_id
  AND lower(trim(t.title)) = lower(trim(s.role))
  AND s.job_title_id IS NULL;

CREATE OR REPLACE FUNCTION public.staff_sync_name_and_role_from_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

DROP TRIGGER IF EXISTS staff_sync_name_and_role_trigger ON public.staff;
CREATE TRIGGER staff_sync_name_and_role_trigger
  BEFORE INSERT OR UPDATE OF first_name, last_name, job_title_id ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_sync_name_and_role_from_parts();

ALTER TABLE public.staff_job_titles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_job_titles_select" ON public.staff_job_titles;
CREATE POLICY "staff_job_titles_select"
  ON public.staff_job_titles
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR business_id IN (
      SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "staff_job_titles_insert" ON public.staff_job_titles;
CREATE POLICY "staff_job_titles_insert"
  ON public.staff_job_titles
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

DROP POLICY IF EXISTS "staff_job_titles_update" ON public.staff_job_titles;
CREATE POLICY "staff_job_titles_update"
  ON public.staff_job_titles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

DROP POLICY IF EXISTS "staff_job_titles_delete" ON public.staff_job_titles;
CREATE POLICY "staff_job_titles_delete"
  ON public.staff_job_titles
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

-- Demo workspace: read job titles (matches other demo SELECT policies)
DROP POLICY IF EXISTS "Demo workspace read staff_job_titles" ON public.staff_job_titles;
CREATE POLICY "Demo workspace read staff_job_titles"
  ON public.staff_job_titles
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

COMMENT ON TABLE public.staff_job_titles IS 'Per-business job titles; unique per business ignoring case/trim.';
COMMENT ON COLUMN public.staff.first_name IS 'Given name; combined with last_name into name by trigger.';
COMMENT ON COLUMN public.staff.last_name IS 'Family name; may be empty.';
COMMENT ON COLUMN public.staff.job_title_id IS 'FK to staff_job_titles; role column kept in sync for legacy reads.';

COMMIT;
