-- ============================================
-- Create time_entry_edit_requests table
-- ============================================
-- Tracks employee requests to edit time entries and manager approvals

CREATE TABLE IF NOT EXISTS public.time_entry_edit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id TEXT NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  requested_changes JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_time_entry_id 
  ON public.time_entry_edit_requests(time_entry_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_employee_id 
  ON public.time_entry_edit_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_business_id 
  ON public.time_entry_edit_requests(business_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_status 
  ON public.time_entry_edit_requests(status);

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_requested_by 
  ON public.time_entry_edit_requests(requested_by);

-- Enable RLS
ALTER TABLE public.time_entry_edit_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be added in a separate migration after we verify the structure

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_time_entry_edit_requests_updated_at ON public.time_entry_edit_requests;
CREATE TRIGGER update_time_entry_edit_requests_updated_at
  BEFORE UPDATE ON public.time_entry_edit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.time_entry_edit_requests IS 'Tracks employee requests to edit time entries and manager approval workflow';
COMMENT ON COLUMN public.time_entry_edit_requests.requested_changes IS 'JSONB object containing requested changes: {clock_in, clock_out, notes, etc.}';
COMMENT ON COLUMN public.time_entry_edit_requests.reason IS 'Employee-provided reason for requesting the edit';

