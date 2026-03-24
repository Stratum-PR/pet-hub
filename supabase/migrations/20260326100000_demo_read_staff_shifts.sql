-- Anonymous and authenticated visitors on /demo need SELECT on staff_shifts (schedule).
-- staff table may already allow demo reads via policy renamed with table; add explicit name + shifts.

BEGIN;

DROP POLICY IF EXISTS "Demo workspace read staff" ON public.staff;
CREATE POLICY "Demo workspace read staff"
  ON public.staff
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Demo workspace read staff_shifts" ON public.staff_shifts;
CREATE POLICY "Demo workspace read staff_shifts"
  ON public.staff_shifts
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

COMMIT;
