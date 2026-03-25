-- Time kiosk: optional informational prompt when clock-in is outside staff scheduled shift.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS kiosk_warn_off_schedule TEXT NOT NULL DEFAULT 'true';

COMMENT ON COLUMN public.settings.kiosk_warn_off_schedule IS 'When true, punch clock shows a prompt if clock-in is outside scheduled shift; still records time with is_off_schedule.';
