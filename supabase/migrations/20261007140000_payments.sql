-- Payments (ATH Móvil now, Stripe later). Writes happen only in the `payments` Edge Function
-- (service role); staff can read their own business's settings and payment attempts.

-- Per-business settings (no secrets here).
CREATE TABLE IF NOT EXISTS public.business_payment_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  athmovil_mode TEXT NOT NULL DEFAULT 'off' CHECK (athmovil_mode IN ('off', 'simulator', 'live')),
  athmovil_public_token_last4 TEXT,
  athmovil_webhook_subscribed BOOLEAN NOT NULL DEFAULT false,
  stripe_account_id TEXT,
  stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.business_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members read payment settings"
  ON public.business_payment_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
  );

-- Server-only secrets: RLS on and no policies → only the service role can read or write.
CREATE TABLE IF NOT EXISTS public.business_payment_secrets (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  athmovil_public_token TEXT,
  athmovil_private_token TEXT,
  athmovil_sim_public_token TEXT,
  athmovil_sim_private_token TEXT,
  -- Random key in the ATH Móvil webhook URL (ATH webhooks are unsigned).
  webhook_key TEXT NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.business_payment_secrets ENABLE ROW LEVEL SECURITY;

-- One row per payment attempt (an ATH push, later a Stripe link/QR).
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('athmovil', 'stripe')),
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'simulator')),
  provider_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','awaiting_capture','authorizing','succeeded','canceled','expired','failed','refunded','partially_refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  amount_paid_cents INTEGER,
  fee_cents INTEGER,
  receipt_reference TEXT,
  phone_last4 TEXT,
  appointment_id TEXT,
  customer_id UUID,
  transaction_id UUID,
  created_by UUID,
  expires_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_uq ON public.payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_business_created_idx ON public.payments (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_appointment_idx ON public.payments (appointment_id) WHERE appointment_id IS NOT NULL;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members read payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
  );

-- Per-attempt secrets (ATH auth_token needed to finalize). Service role only.
CREATE TABLE IF NOT EXISTS public.payment_secrets (
  payment_id UUID PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
  auth_token TEXT
);
ALTER TABLE public.payment_secrets ENABLE ROW LEVEL SECURITY;

-- ATH Móvil simulator state (test mode only; Evertec has no sandbox). Service role only.
CREATE TABLE IF NOT EXISTS public.athm_sim_businesses (
  public_token TEXT PRIMARY KEY,
  private_token TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  webhook JSONB,
  daily_count INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.athm_sim_businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.athm_sim_payments (
  ecommerce_id TEXT PRIMARY KEY,
  auth_token TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL REFERENCES public.athm_sim_businesses(public_token) ON DELETE CASCADE,
  reference_number TEXT,
  status TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS athm_sim_payments_token_idx ON public.athm_sim_payments (public_token, created_at DESC);
CREATE INDEX IF NOT EXISTS athm_sim_payments_ref_idx ON public.athm_sim_payments (reference_number) WHERE reference_number IS NOT NULL;
ALTER TABLE public.athm_sim_payments ENABLE ROW LEVEL SECURITY;
