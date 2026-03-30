-- Allow employees to see Punch clock in their app nav and open the kiosk from their own phones.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS allow_employee_mobile_punch TEXT NOT NULL DEFAULT 'false';

COMMENT ON COLUMN public.settings.allow_employee_mobile_punch IS 'When true, staff with role employee see Punch clock in navigation and may use /time-kiosk from their own device.';
