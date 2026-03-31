-- Harden RLS so employees (profiles.role = 'employee') cannot read/write manager-only data
-- via the Supabase API. UI route guards are not sufficient.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER: avoid RLS recursion on profiles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_is_manager_or_super_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_uid
      AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
  );
$$;

REVOKE ALL ON FUNCTION public.profile_is_manager_or_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_is_manager_or_super_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- settings: managers/super admins only on table; employees use RPC below
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can update settings from their business" ON public.settings;
DROP POLICY IF EXISTS "Users can insert settings for their business" ON public.settings;

CREATE POLICY "Managers can read settings for their business"
ON public.settings FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  OR (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    AND public.profile_is_manager_or_super_admin(auth.uid())
  )
);

CREATE POLICY "Managers can insert settings for their business"
ON public.settings FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  OR (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    AND public.profile_is_manager_or_super_admin(auth.uid())
  )
);

CREATE POLICY "Managers can update settings for their business"
ON public.settings FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  OR (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    AND public.profile_is_manager_or_super_admin(auth.uid())
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  OR (
    business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
    AND public.profile_is_manager_or_super_admin(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.get_employee_portal_settings(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.business_id = p_business_id
      AND p.role = 'employee'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'business_id', s.business_id,
    'business_name', s.business_name,
    'business_hours', s.business_hours,
    'primary_color', s.primary_color,
    'secondary_color', s.secondary_color,
    'business_logo_url', s.business_logo_url,
    'business_logo_url_light', s.business_logo_url_light,
    'business_logo_url_dark', s.business_logo_url_dark,
    'navbar_logo_mode', s.navbar_logo_mode,
    'navbar_logo_size_px', s.navbar_logo_size_px,
    'timezone', s.timezone,
    'default_low_stock_threshold', s.default_low_stock_threshold,
    'pay_schedule_anchor_date', s.pay_schedule_anchor_date,
    'pay_schedule_cadence_weeks', s.pay_schedule_cadence_weeks,
    'notify_appointment_unbilled', s.notify_appointment_unbilled,
    'notify_inventory_low_stock', s.notify_inventory_low_stock,
    'notify_payment_overdue', s.notify_payment_overdue,
    'notify_birthdays', s.notify_birthdays,
    'notify_general', s.notify_general,
    'payroll_pdf_include_logo', s.payroll_pdf_include_logo,
    'kiosk_warn_off_schedule', s.kiosk_warn_off_schedule,
    'allow_employee_mobile_punch', s.allow_employee_mobile_punch
  )
  INTO j
  FROM public.settings s
  WHERE s.business_id = p_business_id;

  RETURN j;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_portal_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_portal_settings(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- transactions (+ line items, refunds, history): managers only
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    DROP POLICY IF EXISTS "Managers can manage transactions from their business" ON public.transactions;
    DROP POLICY IF EXISTS "Users can manage transactions from their business" ON public.transactions;
    CREATE POLICY "Managers can manage transactions from their business"
      ON public.transactions FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_line_items') THEN
    DROP POLICY IF EXISTS "Managers can manage transaction line items from their business" ON public.transaction_line_items;
    DROP POLICY IF EXISTS "Users can manage transaction line items from their business" ON public.transaction_line_items;
    CREATE POLICY "Managers can manage transaction line items from their business"
      ON public.transaction_line_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
            OR (
              t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
              AND public.profile_is_manager_or_super_admin(auth.uid())
            )
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_line_items.transaction_id
          AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
            OR (
              t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
              AND public.profile_is_manager_or_super_admin(auth.uid())
            )
          )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_refunds') THEN
    DROP POLICY IF EXISTS "Managers can manage transaction refunds from their business" ON public.transaction_refunds;
    DROP POLICY IF EXISTS "Users can manage transaction refunds from their business" ON public.transaction_refunds;
    CREATE POLICY "Managers can manage transaction refunds from their business"
      ON public.transaction_refunds FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
            OR (
              t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
              AND public.profile_is_manager_or_super_admin(auth.uid())
            )
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.id = transaction_refunds.transaction_id
          AND (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
            OR (
              t.business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
              AND public.profile_is_manager_or_super_admin(auth.uid())
            )
          )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_history') THEN
    DROP POLICY IF EXISTS "Managers can manage transaction history from their business" ON public.transaction_history;
    DROP POLICY IF EXISTS "Users can manage transaction history from their business" ON public.transaction_history;
    CREATE POLICY "Managers can manage transaction history from their business"
      ON public.transaction_history FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- time_entry_edit_requests: employees only see own requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view their own edit requests" ON public.time_entry_edit_requests;
CREATE POLICY "Staff can view their own edit requests"
  ON public.time_entry_edit_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- clients: all business members can read; only managers mutate
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    DROP POLICY IF EXISTS "Managers can manage clients in their business" ON public.clients;
    DROP POLICY IF EXISTS "Users can manage clients in their business" ON public.clients;
    CREATE POLICY "Managers can manage clients in their business"
      ON public.clients FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- pets: same pattern
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pets') THEN
    DROP POLICY IF EXISTS "Users can manage pets from their business" ON public.pets;
    CREATE POLICY "Managers can manage pets from their business"
      ON public.pets FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- inventory: managers mutate
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
    DROP POLICY IF EXISTS "Managers can manage inventory from their business" ON public.inventory;
    DROP POLICY IF EXISTS "Users can manage inventory from their business" ON public.inventory;
    CREATE POLICY "Managers can manage inventory from their business"
      ON public.inventory FOR ALL
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
        OR (
          business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
          AND public.profile_is_manager_or_super_admin(auth.uid())
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- services: managers mutate
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can manage services from their business" ON public.services;
DROP POLICY IF EXISTS "Users can manage services from their business" ON public.services;
CREATE POLICY "Managers can manage services from their business"
  ON public.services FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND public.profile_is_manager_or_super_admin(auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- staff: remove employee self-UPDATE (read-only profile in app)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "employee_update_own_staff_row" ON public.staff;
