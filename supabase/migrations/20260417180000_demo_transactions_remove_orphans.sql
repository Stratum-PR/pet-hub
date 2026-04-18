-- Demo workspace: remove transaction rows that are not the canonical seed (broken list/detail links)
-- and clear appointment FKs that point at missing transactions.

DO $$
DECLARE
  demo uuid := '00000000-0000-0000-0000-000000000001';
  seed uuid[] := ARRAY[
    'b0000001-0001-4001-8001-000000000001'::uuid,
    'b0000001-0001-4001-8001-000000000002'::uuid,
    'b0000001-0001-4001-8001-000000000003'::uuid,
    'b0000001-0001-4001-8001-000000000004'::uuid
  ];
BEGIN
  IF to_regclass('public.transactions') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'transaction_id'
  ) THEN
    UPDATE public.appointments a
    SET transaction_id = NULL, billed = false, updated_at = now()
    WHERE a.business_id = demo
      AND a.transaction_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = a.transaction_id);
  END IF;

  IF to_regclass('public.transaction_line_items') IS NOT NULL THEN
    DELETE FROM public.transaction_line_items li
    USING public.transactions t
    WHERE li.transaction_id = t.id
      AND t.business_id = demo
      AND NOT (t.id = ANY (seed));
  END IF;

  DELETE FROM public.transactions t
  WHERE t.business_id = demo
    AND NOT (t.id = ANY (seed));
END $$;
