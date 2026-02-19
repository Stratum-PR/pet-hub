-- ============================================
-- Enhance time_entries table for kiosk system
-- ============================================
-- Adds geolocation, rounding, status, and edit request tracking

-- Add new columns to time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS location_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS location_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS is_off_schedule BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rounded_clock_in TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rounded_clock_out TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS edit_request_id UUID;

-- Add check constraint for status
ALTER TABLE public.time_entries
  DROP CONSTRAINT IF EXISTS time_entries_status_check;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_status_check
  CHECK (status IN ('active', 'pending_edit', 'approved', 'rejected'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_clock_in 
  ON public.time_entries(employee_id, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_business_clock_in 
  ON public.time_entries(business_id, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_status 
  ON public.time_entries(status);

CREATE INDEX IF NOT EXISTS idx_time_entries_edit_request_id 
  ON public.time_entries(edit_request_id);

-- Add comment for documentation
COMMENT ON COLUMN public.time_entries.location_latitude IS 'GPS latitude for clock in/out location';
COMMENT ON COLUMN public.time_entries.location_longitude IS 'GPS longitude for clock in/out location';
COMMENT ON COLUMN public.time_entries.location_name IS 'Optional human-readable location identifier';
COMMENT ON COLUMN public.time_entries.is_off_schedule IS 'Flag indicating if employee clocked in outside scheduled shift';
COMMENT ON COLUMN public.time_entries.rounded_clock_in IS 'Clock in time rounded to nearest interval (15 minutes)';
COMMENT ON COLUMN public.time_entries.rounded_clock_out IS 'Clock out time rounded to nearest interval (15 minutes)';
COMMENT ON COLUMN public.time_entries.status IS 'Status of time entry: active, pending_edit, approved, rejected';
COMMENT ON COLUMN public.time_entries.edit_request_id IS 'Link to time_entry_edit_requests if this entry has pending edits';

