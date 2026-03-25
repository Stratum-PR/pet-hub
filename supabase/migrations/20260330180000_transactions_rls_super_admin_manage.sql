-- Super admins could SELECT transactions for any business but could not UPDATE them
-- (manage policies lacked the is_super_admin branch). That broke "Mark as paid" and similar.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS "Users can manage transactions from their business" ON public.transactions;
    CREATE POLICY "Users can manage transactions from their business"
      ON public.transactions FOR ALL
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      )
      WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_line_items') THEN
    DROP POLICY IF EXISTS "Users can manage transaction line items from their business" ON public.transaction_line_items;
    CREATE POLICY "Users can manage transaction line items from their business"
      ON public.transaction_line_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_refunds') THEN
    DROP POLICY IF EXISTS "Users can manage transaction refunds from their business" ON public.transaction_refunds;
    CREATE POLICY "Users can manage transaction refunds from their business"
      ON public.transaction_refunds FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_history') THEN
    DROP POLICY IF EXISTS "Users can manage transaction history from their business" ON public.transaction_history;
    CREATE POLICY "Users can manage transaction history from their business"
      ON public.transaction_history FOR ALL
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      )
      WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );
  END IF;
END $$;
