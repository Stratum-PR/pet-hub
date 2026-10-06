-- Move staff SSN, bank details, home address and payment notes out of public.staff.
-- public.staff is readable by every member of a business (groomers, front desk...), so these columns were
-- visible to anyone on the team. They now live in public.staff_private, readable and writable only by
-- managers/admins of that business (and Stratum super admins).
--
-- Compatibility with app versions that still write these columns on public.staff:
-- a trigger moves any non-empty value written to staff.ssn / bank_* / staff_address / payment_notes into
-- staff_private and blanks it on staff. NULL means "no change" for those old versions, so saving an employee
-- from an older app never wipes the private copy. The updated app reads/writes staff_private directly.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_private (
  staff_id UUID PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_address TEXT,
  ssn TEXT,
  bank_routing_number TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  payment_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_private_business ON public.staff_private (business_id);

ALTER TABLE public.staff_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_private FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_private TO authenticated; -- rows are still filtered by RLS

CREATE OR REPLACE FUNCTION public.can_manage_staff_private(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id = p_business_id)
      AND (
        public.profile_is_manager_or_super_admin(auth.uid())
        OR COALESCE(public.caller_staff_access_role_for_business(p_business_id), '') IN ('admin', 'manager')
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_staff_private(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_staff_private(UUID) TO authenticated;

DROP POLICY IF EXISTS "Managers read staff private details" ON public.staff_private;
CREATE POLICY "Managers read staff private details"
  ON public.staff_private FOR SELECT TO authenticated
  USING (public.can_manage_staff_private(business_id));

DROP POLICY IF EXISTS "Managers write staff private details" ON public.staff_private;
CREATE POLICY "Managers write staff private details"
  ON public.staff_private FOR ALL TO authenticated
  USING (public.can_manage_staff_private(business_id))
  WITH CHECK (
    public.can_manage_staff_private(business_id)
    AND EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.business_id = staff_private.business_id)
  );

-- Copy existing values.
INSERT INTO public.staff_private (
  staff_id, business_id, staff_address, ssn, bank_routing_number, bank_account_type,
  bank_account_number, bank_name, payment_notes
)
SELECT s.id, s.business_id, NULLIF(s.staff_address, ''), NULLIF(s.ssn, ''), NULLIF(s.bank_routing_number, ''),
       NULLIF(s.bank_account_type, ''), NULLIF(s.bank_account_number, ''), NULLIF(s.bank_name, ''),
       NULLIF(s.payment_notes, '')
FROM public.staff s
WHERE s.business_id IS NOT NULL
  AND (COALESCE(s.staff_address, '') <> '' OR COALESCE(s.ssn, '') <> '' OR COALESCE(s.bank_routing_number, '') <> ''
       OR COALESCE(s.bank_account_type, '') <> '' OR COALESCE(s.bank_account_number, '') <> ''
       OR COALESCE(s.bank_name, '') <> '' OR COALESCE(s.payment_notes, '') <> '')
ON CONFLICT (staff_id) DO UPDATE SET
  staff_address = COALESCE(EXCLUDED.staff_address, staff_private.staff_address),
  ssn = COALESCE(EXCLUDED.ssn, staff_private.ssn),
  bank_routing_number = COALESCE(EXCLUDED.bank_routing_number, staff_private.bank_routing_number),
  bank_account_type = COALESCE(EXCLUDED.bank_account_type, staff_private.bank_account_type),
  bank_account_number = COALESCE(EXCLUDED.bank_account_number, staff_private.bank_account_number),
  bank_name = COALESCE(EXCLUDED.bank_name, staff_private.bank_name),
  payment_notes = COALESCE(EXCLUDED.payment_notes, staff_private.payment_notes),
  updated_at = now();

-- Safety net for writes to the old columns.
CREATE OR REPLACE FUNCTION public.staff_move_private_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.staff_address, '') <> '' OR COALESCE(NEW.ssn, '') <> '' OR COALESCE(NEW.bank_routing_number, '') <> ''
     OR COALESCE(NEW.bank_account_type, '') <> '' OR COALESCE(NEW.bank_account_number, '') <> ''
     OR COALESCE(NEW.bank_name, '') <> '' OR COALESCE(NEW.payment_notes, '') <> '' THEN
    IF NEW.business_id IS NOT NULL AND (auth.uid() IS NULL OR public.can_manage_staff_private(NEW.business_id)) THEN
      INSERT INTO public.staff_private (
        staff_id, business_id, staff_address, ssn, bank_routing_number, bank_account_type,
        bank_account_number, bank_name, payment_notes
      ) VALUES (
        NEW.id, NEW.business_id, NULLIF(NEW.staff_address, ''), NULLIF(NEW.ssn, ''), NULLIF(NEW.bank_routing_number, ''),
        NULLIF(NEW.bank_account_type, ''), NULLIF(NEW.bank_account_number, ''), NULLIF(NEW.bank_name, ''),
        NULLIF(NEW.payment_notes, '')
      )
      ON CONFLICT (staff_id) DO UPDATE SET
        staff_address = COALESCE(EXCLUDED.staff_address, staff_private.staff_address),
        ssn = COALESCE(EXCLUDED.ssn, staff_private.ssn),
        bank_routing_number = COALESCE(EXCLUDED.bank_routing_number, staff_private.bank_routing_number),
        bank_account_type = COALESCE(EXCLUDED.bank_account_type, staff_private.bank_account_type),
        bank_account_number = COALESCE(EXCLUDED.bank_account_number, staff_private.bank_account_number),
        bank_name = COALESCE(EXCLUDED.bank_name, staff_private.bank_name),
        payment_notes = COALESCE(EXCLUDED.payment_notes, staff_private.payment_notes),
        updated_at = now();
    END IF;
  END IF;
  -- Never keep these on the widely readable table.
  NEW.staff_address := NULL;
  NEW.ssn := NULL;
  NEW.bank_routing_number := NULL;
  NEW.bank_account_type := NULL;
  NEW.bank_account_number := NULL;
  NEW.bank_name := NULL;
  NEW.payment_notes := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_move_private_fields() FROM PUBLIC, anon, authenticated;

-- Updates are handled before the row is written. New rows are handled after insert (staff_private has a
-- foreign key to staff, so the staff row must exist first).
DROP TRIGGER IF EXISTS staff_move_private_fields_update ON public.staff;
CREATE TRIGGER staff_move_private_fields_update
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_move_private_fields();

CREATE OR REPLACE FUNCTION public.staff_move_private_fields_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.staff_address, '') <> '' OR COALESCE(NEW.ssn, '') <> '' OR COALESCE(NEW.bank_routing_number, '') <> ''
     OR COALESCE(NEW.bank_account_type, '') <> '' OR COALESCE(NEW.bank_account_number, '') <> ''
     OR COALESCE(NEW.bank_name, '') <> '' OR COALESCE(NEW.payment_notes, '') <> '' THEN
    -- Re-saving the row runs the BEFORE UPDATE trigger, which moves the values and blanks them.
    UPDATE public.staff SET ssn = NEW.ssn WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_move_private_fields_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS staff_move_private_fields_insert ON public.staff;
CREATE TRIGGER staff_move_private_fields_insert
  AFTER INSERT ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_move_private_fields_after_insert();

-- Blank the old columns (values were copied above; the update trigger is a no-op for empty rows).
UPDATE public.staff
SET staff_address = NULL, ssn = NULL, bank_routing_number = NULL, bank_account_type = NULL,
    bank_account_number = NULL, bank_name = NULL, payment_notes = NULL
WHERE staff_address IS NOT NULL OR ssn IS NOT NULL OR bank_routing_number IS NOT NULL OR bank_account_type IS NOT NULL
   OR bank_account_number IS NOT NULL OR bank_name IS NOT NULL OR payment_notes IS NOT NULL;

COMMIT;
