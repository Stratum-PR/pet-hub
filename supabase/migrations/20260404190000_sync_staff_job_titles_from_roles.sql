-- Backfill staff_job_titles from legacy staff.role (case-insensitive), link job_title_id, and expose RPC for runtime sync.

-- 1) One-time idempotent backfill for all businesses (migration runs as DB owner)
INSERT INTO public.staff_job_titles (business_id, title)
SELECT DISTINCT s.business_id,
  initcap(lower(trim(s.role)))
FROM public.staff s
WHERE NULLIF(trim(s.role), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.staff_job_titles t
    WHERE t.business_id = s.business_id
      AND lower(trim(both from t.title)) = lower(trim(both from s.role))
  );

UPDATE public.staff s
SET job_title_id = t.id
FROM public.staff_job_titles t
WHERE t.business_id = s.business_id
  AND lower(trim(both from t.title)) = lower(trim(both from s.role));

-- 2) RPC: same logic for one business (managers / super admins); safe to call repeatedly
CREATE OR REPLACE FUNCTION public.sync_staff_job_titles_from_staff_roles(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.sync_staff_job_titles_from_staff_roles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_staff_job_titles_from_staff_roles(uuid) TO authenticated;

COMMENT ON FUNCTION public.sync_staff_job_titles_from_staff_roles(uuid) IS
  'Ensures staff_job_titles has one row per distinct staff.role (title case) for the business and links staff.job_title_id.';
