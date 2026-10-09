-- Rollback for 20261009110000_staff_lock_pay_and_role_columns.sql (P2-03).
-- Removes the staff pay/role column lock. This REOPENS "employee raises their own hourly rate": use only if
-- the lock breaks a legitimate flow, and re-apply a fixed version as soon as possible.
--
-- After running this on production, also run `npx supabase migration repair --status reverted 20261009110000`
-- so the migration can be re-applied later.

DROP TRIGGER IF EXISTS staff_lock_pay_and_role_columns ON public.staff;
DROP FUNCTION IF EXISTS public.staff_lock_pay_and_role_columns();
