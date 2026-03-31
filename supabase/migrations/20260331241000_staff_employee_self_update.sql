-- Allow employees (linked via staff.user_id) to update their own staff row for My Profile Edit.

CREATE POLICY "employee_update_own_staff_row"
  ON public.staff FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
