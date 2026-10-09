-- P2-03: employees could change their own (or a coworker's) pay rate, commission and job title through the
-- "Employees update" policy, which lets any member of a business update any staff row of that business.
--
-- From now on these staff columns may only change for a caller who manages the business's staff
-- (can_manage_staff_private: super admin, profile role manager, or staff access_role admin/manager):
--   hourly_rate, commission_rate, compensation_type, role, job_title_id, access_role
-- job_title_id is included because staff_sync_name_and_role_trigger copies the job title into `role`.
-- access_role keeps its own, finer rules in staff_enforce_access_role_mutations (managers cannot grant admin,
-- last admin); this trigger only adds the "managers only" floor.
--
-- NOT locked: `pin`. Employees set their own kiosk PIN through the EmployeeManagement self-service form
-- (main and dev, commit 04b4945), as a direct table update. P2-02 moves PINs out of the table.
--
-- Server paths are unaffected: SECURITY DEFINER functions (complete_manager_signup, sync_staff_job_titles_*,
-- admin_set_staff_access_role, ...) run as the function owner, and the service role is not `authenticated`.
-- Only UPDATE is covered; who may INSERT or DELETE staff rows is P2-01.
-- The trigger name sorts before staff_sync_name_and_role_trigger, so it checks what the caller sent; a
-- `role` recomputed from an unchanged job_title_id (renamed title) does not block an employee's own save.

CREATE OR REPLACE FUNCTION public.staff_lock_pay_and_role_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.hourly_rate IS NOT DISTINCT FROM OLD.hourly_rate
     AND NEW.commission_rate IS NOT DISTINCT FROM OLD.commission_rate
     AND NEW.compensation_type IS NOT DISTINCT FROM OLD.compensation_type
     AND NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.job_title_id IS NOT DISTINCT FROM OLD.job_title_id
     AND NEW.access_role IS NOT DISTINCT FROM OLD.access_role
  THEN
    RETURN NEW;
  END IF;

  IF public.can_manage_staff_private(OLD.business_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'staff_pay_and_role_columns_are_manager_only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS staff_lock_pay_and_role_columns ON public.staff;
CREATE TRIGGER staff_lock_pay_and_role_columns
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.staff_lock_pay_and_role_columns();
