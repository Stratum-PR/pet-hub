-- Store the business timezone (IANA TZ database name), e.g. 'America/Puerto_Rico'.
-- Used for consistent payroll period boundaries and date/time display.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS timezone TEXT;

