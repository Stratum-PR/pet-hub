-- Shift change requests: employees propose; managers approve/deny (mirrors time_entry_edit_requests pattern).

CREATE TABLE IF NOT EXISTS public.staff_shift_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_shift_id UUID REFERENCES public.staff_shifts(id) ON DELETE SET NULL,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('new', 'change', 'cancel')),
  proposed_start_time TIMESTAMPTZ,
  proposed_end_time TIMESTAMPTZ,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_shift_change_requests_times_check CHECK (
    (request_kind = 'cancel' AND staff_shift_id IS NOT NULL)
    OR (request_kind = 'new' AND staff_shift_id IS NULL AND proposed_start_time IS NOT NULL AND proposed_end_time IS NOT NULL AND proposed_end_time > proposed_start_time)
    OR (request_kind = 'change' AND staff_shift_id IS NOT NULL AND proposed_start_time IS NOT NULL AND proposed_end_time IS NOT NULL AND proposed_end_time > proposed_start_time)
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_shift_change_requests_business_id
  ON public.staff_shift_change_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_shift_change_requests_staff_id
  ON public.staff_shift_change_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shift_change_requests_status
  ON public.staff_shift_change_requests(status);

ALTER TABLE public.staff_shift_change_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: requester, managers in business, super_admin
CREATE POLICY "staff_shift_change_requests_select"
  ON public.staff_shift_change_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR requested_by = auth.uid()
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

-- INSERT: employee for own staff row only
CREATE POLICY "staff_shift_change_requests_insert_own_staff"
  ON public.staff_shift_change_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()
    AND staff_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
    AND business_id IN (SELECT s.business_id FROM public.staff s WHERE s.id = staff_id)
  );

-- UPDATE: managers approve/deny
CREATE POLICY "staff_shift_change_requests_update_managers"
  ON public.staff_shift_change_requests FOR UPDATE
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

-- UPDATE: employee may cancel own pending request only
CREATE POLICY "staff_shift_change_requests_employee_cancel"
  ON public.staff_shift_change_requests FOR UPDATE
  USING (
    requested_by = auth.uid()
    AND status = 'pending'
    AND staff_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
  )
  WITH CHECK (
    status = 'cancelled'
    AND requested_by = auth.uid()
  );

DROP TRIGGER IF EXISTS update_staff_shift_change_requests_updated_at ON public.staff_shift_change_requests;
CREATE TRIGGER update_staff_shift_change_requests_updated_at
  BEFORE UPDATE ON public.staff_shift_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
