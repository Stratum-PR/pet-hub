-- ============================================
-- Employee scheduling: employee_shifts table + profiles.employee_id
-- ============================================
-- Supports manager-assigned shifts (calendar, drag-drop) and future clock in/out.
-- employees see "My schedule" via profile.employee_id.

-- 1. Create employee_shifts table
CREATE TABLE public.employee_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT employee_shifts_end_after_start CHECK (end_time > start_time)
);

-- Indexes for calendar and "my schedule" queries
CREATE INDEX IF NOT EXISTS idx_employee_shifts_business_id ON public.employee_shifts(business_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON public.employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_start_end ON public.employee_shifts(start_time, end_time);

-- Enable RLS
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

-- SELECT: own business or super_admin (employees in same business can read for "My schedule")
CREATE POLICY "Users can access employee_shifts from their business"
  ON public.employee_shifts FOR SELECT
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- INSERT/UPDATE/DELETE: own business only (managers)
CREATE POLICY "Users can manage employee_shifts in their business"
  ON public.employee_shifts FOR ALL
  USING (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- 2. Add employee_id to profiles (link logged-in user to employees row for "My schedule" and clock in/out)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id);

-- Trigger for updated_at (reuse existing function)
DROP TRIGGER IF EXISTS update_employee_shifts_updated_at ON public.employee_shifts;
CREATE TRIGGER update_employee_shifts_updated_at
  BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
