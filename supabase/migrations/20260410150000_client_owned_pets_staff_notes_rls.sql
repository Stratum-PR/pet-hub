-- Client-owned pets: portal CRUD without business_client_links; pets.business_id NULL for profile-linked clients.
-- Staff: manage pets by business scope OR appointment link (legacy business_id on pet still grants access).
-- Staff-only notes: pet_business_notes, client_business_notes (no client RLS).
-- Relax client reads for appointments and transactions (profile + row match; optional business_client_links removed).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Staff-only note tables (per business; avoids leaking columns via SELECT *)
-- FK column types MUST match public.pets(id) and public.clients(id) (uuid OR text in the wild).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  pet_id_pg text;
  client_id_pg text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO pet_id_pg
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'pets'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO client_id_pg
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'clients'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF pet_id_pg IS NULL OR client_id_pg IS NULL THEN
    RAISE EXCEPTION 'Could not resolve public.pets.id / public.clients.id types for note tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pet_business_notes'
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.pet_business_notes (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        pet_id %s NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
        business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (pet_id, business_id)
      )',
      pet_id_pg
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_business_notes'
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.client_business_notes (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        client_id %s NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
        business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (client_id, business_id)
      )',
      client_id_pg
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pet_business_notes_business_id ON public.pet_business_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_pet_business_notes_pet_id ON public.pet_business_notes(pet_id);

CREATE INDEX IF NOT EXISTS idx_client_business_notes_business_id ON public.client_business_notes(business_id);
CREATE INDEX IF NOT EXISTS idx_client_business_notes_client_id ON public.client_business_notes(client_id);

ALTER TABLE public.pet_business_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_business_notes ENABLE ROW LEVEL SECURITY;

-- Staff (managers/super admins): full access when linked to business via appointment OR legacy client/pet business_id
DROP POLICY IF EXISTS "Staff can manage pet_business_notes" ON public.pet_business_notes;
CREATE POLICY "Staff can manage pet_business_notes"
  ON public.pet_business_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND p.business_id = pet_business_notes.business_id
          AND (
            public.pet_has_appointment_for_business(pet_business_notes.pet_id::text, p.business_id::text)
            OR EXISTS (
              SELECT 1 FROM public.pets pt
              WHERE pt.id = pet_business_notes.pet_id
                AND pt.business_id IS NOT DISTINCT FROM p.business_id
            )
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND p.business_id = pet_business_notes.business_id
          AND (
            public.pet_has_appointment_for_business(pet_business_notes.pet_id::text, p.business_id::text)
            OR EXISTS (
              SELECT 1 FROM public.pets pt
              WHERE pt.id = pet_business_notes.pet_id
                AND pt.business_id IS NOT DISTINCT FROM p.business_id
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Business members can read pet_business_notes" ON public.pet_business_notes;
CREATE POLICY "Business members can read pet_business_notes"
  ON public.pet_business_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND p.business_id = pet_business_notes.business_id
        AND public.pet_has_appointment_for_business(pet_business_notes.pet_id::text, p.business_id::text)
    )
    OR EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id = pet_business_notes.business_id
      )
    )
  );

DROP POLICY IF EXISTS "Staff can manage client_business_notes" ON public.client_business_notes;
CREATE POLICY "Staff can manage client_business_notes"
  ON public.client_business_notes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND p.business_id = client_business_notes.business_id
          AND (
            public.client_has_appointment_for_business(client_business_notes.client_id::text, p.business_id::text)
            OR EXISTS (
              SELECT 1 FROM public.clients cl
              WHERE cl.id = client_business_notes.client_id
                AND cl.business_id IS NOT DISTINCT FROM p.business_id
            )
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND p.business_id = client_business_notes.business_id
          AND (
            public.client_has_appointment_for_business(client_business_notes.client_id::text, p.business_id::text)
            OR EXISTS (
              SELECT 1 FROM public.clients cl
              WHERE cl.id = client_business_notes.client_id
                AND cl.business_id IS NOT DISTINCT FROM p.business_id
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Business members can read client_business_notes" ON public.client_business_notes;
CREATE POLICY "Business members can read client_business_notes"
  ON public.client_business_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.business_id IS NOT NULL
        AND p.business_id = client_business_notes.business_id
        AND public.client_has_appointment_for_business(client_business_notes.client_id::text, p.business_id::text)
    )
    OR EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id = client_business_notes.business_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Backfill: account-linked clients keep pets without per-business pets.business_id
-- ---------------------------------------------------------------------------

UPDATE public.pets p
SET business_id = NULL
FROM public.clients c
WHERE c.id = p.client_id
  AND c.profile_id IS NOT NULL
  AND c.merged_into_client_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Portal pets: insert/update/delete only when pets.business_id IS NULL (account-owned)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Clients can insert own pets" ON public.pets;
CREATE POLICY "Clients can insert own pets"
  ON public.pets FOR INSERT
  TO authenticated
  WITH CHECK (
    pets.business_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND c.merged_into_client_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Clients can update own pets" ON public.pets;
CREATE POLICY "Clients can update own pets"
  ON public.pets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND c.merged_into_client_id IS NULL
    )
  )
  WITH CHECK (
    pets.business_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND c.merged_into_client_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Clients can delete own pets" ON public.pets;
CREATE POLICY "Clients can delete own pets"
  ON public.pets FOR DELETE
  TO authenticated
  USING (
    pets.business_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = pets.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND c.merged_into_client_id IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Replace manager FOR ALL on pets with split policies + SELECT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Managers can manage pets from their business" ON public.pets;

CREATE POLICY "Managers can insert pets for their business"
  ON public.pets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND pets.business_id IS NOT DISTINCT FROM p.business_id
      )
    )
  );

CREATE POLICY "Managers can select pets for their business"
  ON public.pets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND (
            pets.business_id IS NOT DISTINCT FROM p.business_id
            OR public.pet_has_appointment_for_business(pets.id::text, p.business_id::text)
          )
      )
    )
  );

CREATE POLICY "Managers can update pets for their business"
  ON public.pets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND (
            pets.business_id IS NOT DISTINCT FROM p.business_id
            OR public.pet_has_appointment_for_business(pets.id::text, p.business_id::text)
          )
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND (
            pets.business_id IS NOT DISTINCT FROM p.business_id
            OR public.pet_has_appointment_for_business(pets.id::text, p.business_id::text)
          )
      )
    )
  );

CREATE POLICY "Managers can delete pets for their business"
  ON public.pets FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = auth.uid() AND sp.is_super_admin = true)
    OR (
      public.profile_is_manager_or_super_admin(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.business_id IS NOT NULL
          AND (
            pets.business_id IS NOT DISTINCT FROM p.business_id
            OR public.pet_has_appointment_for_business(pets.id::text, p.business_id::text)
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Clients: read appointments & transactions without requiring business_client_links
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Clients can read own appointments" ON public.appointments;
CREATE POLICY "Clients can read own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = appointments.client_id
        AND c.profile_id = auth.uid()
        AND p.role = 'client'
        AND c.merged_into_client_id IS NULL
        AND (
          c.business_id IS NOT DISTINCT FROM appointments.business_id
          OR (
            c.business_id IS NULL
            AND appointments.business_id IS NOT NULL
          )
        )
    )
  );

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
            AND c.merged_into_client_id IS NULL
            AND (
              c.business_id IS NOT DISTINCT FROM transactions.business_id
              OR (
                c.business_id IS NULL
                AND transactions.business_id IS NOT NULL
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
            AND c.merged_into_client_id IS NULL
            AND (
              c.business_id IS NOT DISTINCT FROM t.business_id
              OR (
                c.business_id IS NULL
                AND t.business_id IS NOT NULL
              )
            )
        )
      );
  END IF;
END $$;

COMMIT;
