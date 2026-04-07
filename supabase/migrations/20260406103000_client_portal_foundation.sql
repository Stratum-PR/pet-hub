-- Client portal foundation (phase 1):
-- - business QR storage
-- - appointment reminder dedupe timestamp
-- - client marketing preferences

BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.businesses.qr_code IS
  'Encoded QR value (typically SVG markup or hosted URL) for the business client portal.';
COMMENT ON COLUMN public.businesses.qr_generated_at IS
  'Timestamp for last successful QR generation.';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.appointments.reminder_sent_at IS
  'Deduplication marker for appointment reminder emails.';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS marketing_email_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_sms_opt_in BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.marketing_email_opt_in IS
  'Client consent for marketing emails.';
COMMENT ON COLUMN public.clients.marketing_sms_opt_in IS
  'Client consent for marketing SMS.';

COMMIT;
