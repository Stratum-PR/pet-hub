-- ============================================
-- Add PIN setup tracking to employees table
-- ============================================
-- Tracks when employee PIN was set and if PIN is required

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pin_required BOOLEAN DEFAULT true;

-- Add index for PIN setup queries
CREATE INDEX IF NOT EXISTS idx_employees_pin_set_at 
  ON public.employees(pin_set_at);

-- Add comments
COMMENT ON COLUMN public.employees.pin_set_at IS 'Timestamp when employee set their PIN (for first-time setup tracking)';
COMMENT ON COLUMN public.employees.pin_required IS 'Whether employee must set a PIN before clocking in';

