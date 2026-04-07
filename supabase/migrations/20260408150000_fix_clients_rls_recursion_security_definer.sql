-- Break RLS infinite recursion on public.clients (and pets) when policies
-- subquery public.appointments while appointments policies subquery clients.
-- SECURITY DEFINER functions run with definer rights so appointment rows are
-- visible without re-evaluating nested RLS on the same request stack.
--
-- Parameters use TEXT so uuid/text column drift (e.g. appointments.pet_id text)
-- matches a single function signature.

BEGIN;

DROP FUNCTION IF EXISTS public.client_has_appointment_for_business(uuid, uuid);
DROP FUNCTION IF EXISTS public.pet_has_appointment_for_business(uuid, uuid);

CREATE OR REPLACE FUNCTION public.client_has_appointment_for_business(p_client_id text, p_business_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.client_id::text = p_client_id
      AND a.business_id::text = p_business_id
  );
$$;

CREATE OR REPLACE FUNCTION public.pet_has_appointment_for_business(p_pet_id text, p_business_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.pet_id::text = p_pet_id
      AND a.business_id::text = p_business_id
  );
$$;

REVOKE ALL ON FUNCTION public.client_has_appointment_for_business(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pet_has_appointment_for_business(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_has_appointment_for_business(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pet_has_appointment_for_business(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_has_appointment_for_business(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pet_has_appointment_for_business(text, text) TO service_role;

DROP POLICY IF EXISTS "Business members can read clients linked by appointments" ON public.clients;
CREATE POLICY "Business members can read clients linked by appointments"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND public.client_has_appointment_for_business(clients.id::text, p.business_id::text)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles sp
      WHERE sp.id = auth.uid() AND sp.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Business members can read pets linked by appointments" ON public.pets;
CREATE POLICY "Business members can read pets linked by appointments"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND public.pet_has_appointment_for_business(pets.id::text, p.business_id::text)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles sp
      WHERE sp.id = auth.uid() AND sp.is_super_admin = true
    )
  );

COMMIT;
