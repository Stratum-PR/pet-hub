-- Slug availability checks must see all businesses; RLS hides other tenants from direct SELECT.
-- SECURITY DEFINER RPC used by the app (e.g. business settings live validation).

CREATE OR REPLACE FUNCTION public.is_public_business_slug_taken_by_other(
  p_slug TEXT,
  p_own_business_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE lower(trim(b.slug)) = lower(trim(p_slug))
      AND b.id <> p_own_business_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_business_slug_taken_by_other(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_business_slug_taken_by_other(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_business_slug_taken_by_other(TEXT, UUID) TO anon;

COMMENT ON FUNCTION public.is_public_business_slug_taken_by_other IS
  'True if another business row uses this slug (for vanity URL validation). Bypasses tenant RLS.';
