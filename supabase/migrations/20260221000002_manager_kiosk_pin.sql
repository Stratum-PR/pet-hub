-- ============================================
-- Add manager PIN to businesses table
-- ============================================
-- Stores hashed PIN for manager kiosk access

ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS kiosk_manager_pin TEXT;

-- Add comment
COMMENT ON COLUMN public.businesses.kiosk_manager_pin IS 'Hashed PIN for manager to exit kiosk mode and access main app';

