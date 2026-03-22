-- Allow SELECT on demo business transactions and line items for any role (incl. signed-in users on /demo).
-- Matches "Demo workspace read *" policies; without this, RLS only allows rows for profile.business_id.

DROP POLICY IF EXISTS "Demo workspace read transactions" ON public.transactions;
CREATE POLICY "Demo workspace read transactions"
  ON public.transactions
  FOR SELECT
  USING (
    business_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR business_id::text = '00000000-0000-0000-0000-000000000001'
  );

DROP POLICY IF EXISTS "Demo workspace read transaction line items" ON public.transaction_line_items;
CREATE POLICY "Demo workspace read transaction line items"
  ON public.transaction_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_line_items.transaction_id
        AND (
          t.business_id = '00000000-0000-0000-0000-000000000001'::uuid
          OR t.business_id::text = '00000000-0000-0000-0000-000000000001'
        )
    )
  );
