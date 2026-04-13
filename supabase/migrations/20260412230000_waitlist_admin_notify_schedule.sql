-- Deferred internal waitlist notification (Resend) so survey can complete first.
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS admin_notify_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notify_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signup_notify_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS survey_skipped_at TIMESTAMPTZ;

COMMENT ON COLUMN public.waitlist.admin_notify_at IS 'Earliest time the drain job may consider sending; advanced when user continues/skips/submits survey.';
COMMENT ON COLUMN public.waitlist.admin_notify_sent_at IS 'Set when internal notify email was sent successfully.';
COMMENT ON COLUMN public.waitlist.signup_notify_deadline_at IS 'Absolute latest to send internal notify if user never finishes the survey flow (set at signup).';
COMMENT ON COLUMN public.waitlist.survey_skipped_at IS 'User chose to skip the optional survey; internal notify may send without survey answers.';

CREATE INDEX IF NOT EXISTS idx_waitlist_admin_notify_due
  ON public.waitlist (admin_notify_at)
  WHERE admin_notify_sent_at IS NULL AND admin_notify_at IS NOT NULL;

-- Existing confirmed rows: pick a deadline so the drain job can still send once.
UPDATE public.waitlist
SET
  signup_notify_deadline_at = COALESCE(confirmed_at, signed_up_at) + interval '15 minutes',
  admin_notify_at = COALESCE(
    admin_notify_at,
    COALESCE(confirmed_at, signed_up_at) + interval '15 minutes'
  )
WHERE confirmed IS TRUE
  AND admin_notify_sent_at IS NULL
  AND signup_notify_deadline_at IS NULL;
