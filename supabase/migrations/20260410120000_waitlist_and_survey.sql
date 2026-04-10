-- Pre-launch marketing waitlist (double opt-in) and optional post-confirm survey.
-- RLS enabled with no policies: only service_role (Edge Functions) can read/write.

CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website',
  locale TEXT NOT NULL DEFAULT 'es',
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_token UUID NOT NULL DEFAULT gen_random_uuid(),
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.waitlist (id) ON DELETE SET NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  survey_token UUID UNIQUE
);

CREATE UNIQUE INDEX waitlist_email_unique ON public.waitlist (lower(email));

CREATE INDEX idx_waitlist_confirmed ON public.waitlist (confirmed);
CREATE INDEX idx_waitlist_confirm_token ON public.waitlist (confirm_token) WHERE confirmed = FALSE;

CREATE TABLE public.waitlist_survey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id UUID NOT NULL REFERENCES public.waitlist (id) ON DELETE CASCADE,
  business_name TEXT,
  groomer_count TEXT,
  current_tools TEXT,
  biggest_pain TEXT,
  wants_ath_movil BOOLEAN,
  wants_nomina_pr BOOLEAN,
  wants_spanish_ui BOOLEAN,
  wants_online_booking BOOLEAN,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_survey_one_per_waitlist UNIQUE (waitlist_id)
);

CREATE INDEX idx_waitlist_survey_waitlist_id ON public.waitlist_survey (waitlist_id);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_survey ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.waitlist IS 'Marketing waitlist; mutations via Edge Functions (service role) only.';
COMMENT ON TABLE public.waitlist_survey IS 'Optional survey after email confirm; one row per waitlist entry.';
