-- ============================================
-- RLS Policies for time_entry_edit_requests
-- ============================================
-- Note: This migration assumes time_entry_edit_requests table exists (created in 20260221000001)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Employees can view their own edit requests" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Employees can create edit requests for own entries" ON public.time_entry_edit_requests;
DROP POLICY IF EXISTS "Managers can update edit requests in their business" ON public.time_entry_edit_requests;

-- SELECT: Employees can view their own edit requests, managers can view all for their business
CREATE POLICY "Employees can view their own edit requests"
  ON public.time_entry_edit_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT: Employees can create edit requests for their own time entries
-- Note: Casting to handle potential type mismatches (time_entries.id and employee_id may be TEXT in some databases)
CREATE POLICY "Employees can create edit requests for own entries"
  ON public.time_entry_edit_requests FOR INSERT
  WITH CHECK (
    employee_id::TEXT IN (
      SELECT e.id::TEXT FROM public.employees e
      INNER JOIN public.profiles p ON p.employee_id = e.id
      WHERE p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.time_entries 
      WHERE id::TEXT = time_entry_edit_requests.time_entry_id
      AND employee_id::TEXT = time_entry_edit_requests.employee_id::TEXT
    )
  );

-- UPDATE: Managers can approve/reject edit requests for their business
CREATE POLICY "Managers can update edit requests in their business"
  ON public.time_entry_edit_requests FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- DELETE: Only super admins can delete (or via cascade from time_entry)
-- No explicit DELETE policy needed - cascade handles it

