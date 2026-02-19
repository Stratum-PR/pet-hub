-- ============================================
-- Transactions tables: RLS and policies
-- ============================================
-- Ensures RLS is enabled on transactions, transaction_line_items,
-- transaction_refunds, and transaction_history with business-scoped access.
-- Safe to run if tables already exist (e.g. created via dashboard or prior migration).
-- Pattern matches other business-scoped tables (appointments, clients, etc.).

DO $$
BEGIN
  -- 1. transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can access transactions from their business" ON public.transactions;
    CREATE POLICY "Users can access transactions from their business"
      ON public.transactions FOR SELECT
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );

    DROP POLICY IF EXISTS "Users can manage transactions from their business" ON public.transactions;
    CREATE POLICY "Users can manage transactions from their business"
      ON public.transactions FOR ALL
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      );
  END IF;

  -- 2. transaction_line_items (scoped via transaction_id -> transactions.business_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_line_items') THEN
    ALTER TABLE public.transaction_line_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can access transaction line items from their business" ON public.transaction_line_items;
    CREATE POLICY "Users can access transaction line items from their business"
      ON public.transaction_line_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      );

    DROP POLICY IF EXISTS "Users can manage transaction line items from their business" ON public.transaction_line_items;
    CREATE POLICY "Users can manage transaction line items from their business"
      ON public.transaction_line_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        )
      );
  END IF;

  -- 3. transaction_refunds (scoped via transaction_id -> transactions.business_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_refunds') THEN
    ALTER TABLE public.transaction_refunds ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can access transaction refunds from their business" ON public.transaction_refunds;
    CREATE POLICY "Users can access transaction refunds from their business"
      ON public.transaction_refunds FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND (
            t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
          )
        )
      );

    DROP POLICY IF EXISTS "Users can manage transaction refunds from their business" ON public.transaction_refunds;
    CREATE POLICY "Users can manage transaction refunds from their business"
      ON public.transaction_refunds FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        )
      );
  END IF;

  -- 4. transaction_history (has business_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_history') THEN
    ALTER TABLE public.transaction_history ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can access transaction history from their business" ON public.transaction_history;
    CREATE POLICY "Users can access transaction history from their business"
      ON public.transaction_history FOR SELECT
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
      );

    DROP POLICY IF EXISTS "Users can manage transaction history from their business" ON public.transaction_history;
    CREATE POLICY "Users can manage transaction history from their business"
      ON public.transaction_history FOR ALL
      USING (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      );
  END IF;
END $$;
