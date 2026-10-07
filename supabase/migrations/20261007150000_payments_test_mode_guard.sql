-- Security review G-1 (interim fix while dev.grumi.pet shares the production project):
-- sales charged through the ATH Móvil simulator are flagged is_test and left out of revenue.
-- Only server code (service role) can set or clear the flag, so staff can't hide a real sale as "test"
-- or turn a test sale into revenue. Payment settings changes are audit-logged.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.transactions.is_test IS
  'Charged in test mode (ATH Móvil simulator, no real money). Set only by the payments Edge Function. Excluded from revenue and reports.';

CREATE OR REPLACE FUNCTION public.transactions_guard_is_test()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Signed-in browsers (and anon) can never change the flag; service role and migrations can.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_test := false;
    ELSE
      NEW.is_test := OLD.is_test;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transactions_guard_is_test' AND tgrelid = 'public.transactions'::regclass) THEN
    CREATE TRIGGER transactions_guard_is_test
      BEFORE INSERT OR UPDATE ON public.transactions
      FOR EACH ROW EXECUTE FUNCTION public.transactions_guard_is_test();
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS transactions_business_is_test_idx ON public.transactions (business_id) WHERE is_test;

-- Audit log for payment settings (mode changes, key changes). Written only by the payments Edge Function.
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_audit_log_business_idx ON public.payment_audit_log (business_id, created_at DESC);
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_audit_log' AND policyname = 'Managers read payment audit log') THEN
    CREATE POLICY "Managers read payment audit log"
      ON public.payment_audit_log FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR business_id IN (
          SELECT p.business_id FROM public.profiles p
          WHERE p.id = auth.uid() AND p.business_id IS NOT NULL AND p.role IN ('manager', 'super_admin')
        )
      );
  END IF;
END;
$$;
