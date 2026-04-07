-- Clients (role=client) can read their own POS transactions and line items when scoped to a business they are linked to.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS "Clients can read own transactions" ON public.transactions;
    CREATE POLICY "Clients can read own transactions"
      ON public.transactions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.clients c
          JOIN public.profiles p ON p.id = auth.uid()
          WHERE c.id = transactions.customer_id
            AND c.profile_id = auth.uid()
            AND p.role = 'client'
            AND (
              c.business_id IS NOT DISTINCT FROM transactions.business_id
              OR EXISTS (
                SELECT 1
                FROM public.business_client_links bcl
                WHERE bcl.user_id = auth.uid()
                  AND bcl.business_id = transactions.business_id
                  AND bcl.status = 'approved'
              )
            )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_line_items') THEN
    DROP POLICY IF EXISTS "Clients can read own transaction line items" ON public.transaction_line_items;
    CREATE POLICY "Clients can read own transaction line items"
      ON public.transaction_line_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.transactions t
          JOIN public.clients c ON c.id = t.customer_id
          JOIN public.profiles p ON p.id = auth.uid()
          WHERE t.id = transaction_line_items.transaction_id
            AND c.profile_id = auth.uid()
            AND p.role = 'client'
            AND (
              c.business_id IS NOT DISTINCT FROM t.business_id
              OR EXISTS (
                SELECT 1
                FROM public.business_client_links bcl
                WHERE bcl.user_id = auth.uid()
                  AND bcl.business_id = t.business_id
                  AND bcl.status = 'approved'
              )
            )
        )
      );
  END IF;
END $$;
