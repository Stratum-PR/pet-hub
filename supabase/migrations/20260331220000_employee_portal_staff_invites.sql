-- Employee portal: staff_invites, validate_staff_invite RPC, consolidated handle_new_user,
-- staff.user_id unique, RLS helpers, tighter business policies for employee role.

-- ---------------------------------------------------------------------------
-- 1) staff_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users (id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  CONSTRAINT staff_invites_unique_staff_status UNIQUE (staff_id, status)
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON public.staff_invites (token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites (email);
CREATE INDEX IF NOT EXISTS idx_staff_invites_business ON public.staff_invites (business_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_staff ON public.staff_invites (staff_id);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "managers_manage_staff_invites" ON public.staff_invites;

-- Managers / super_admin: full CRUD for rows in their scope
CREATE POLICY "managers_manage_staff_invites"
  ON public.staff_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      business_id IN (SELECT p2.business_id FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.business_id IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM public.profiles p3
        WHERE p3.id = auth.uid()
          AND (p3.role IN ('manager', 'super_admin') OR p3.is_super_admin = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_super_admin = true)
    OR (
      business_id IN (SELECT p2.business_id FROM public.profiles p2 WHERE p2.id = auth.uid() AND p2.business_id IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM public.profiles p3
        WHERE p3.id = auth.uid()
          AND (p3.role IN ('manager', 'super_admin') OR p3.is_super_admin = true)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) validate_staff_invite (no broad anon SELECT on table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_staff_invite(invite_token text)
RETURNS TABLE (
  id uuid,
  email text,
  status text,
  expires_at timestamptz,
  business_id uuid,
  business_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.email,
    si.status,
    si.expires_at,
    si.business_id,
    b.name AS business_name
  FROM public.staff_invites si
  INNER JOIN public.businesses b ON b.id = si.business_id
  WHERE si.token = invite_token
    AND si.status = 'pending'
    AND si.expires_at > now()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_staff_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_staff_invite(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) UNIQUE staff.user_id (multiple NULLs allowed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_user_id_unique;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_user_id_unique UNIQUE (user_id);

-- ---------------------------------------------------------------------------
-- 4) RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.business_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_business_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_business_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Consolidated handle_new_user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa boolean :=
    lower(trim(coalesce(NEW.email, ''))) LIKE '%@stratumpr.com'
    OR public.auth_email_super_admin_allowlisted(NEW.email);
  _invitation record;
  v_full_name text;
BEGIN
  IF v_sa THEN
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      true,
      'super_admin'
    );
    RETURN NEW;
  END IF;

  SELECT si.id, si.business_id, si.staff_id, si.email, s.name AS staff_name
  INTO _invitation
  FROM public.staff_invites si
  INNER JOIN public.staff s ON s.id = si.staff_id
  WHERE lower(trim(si.email)) = lower(trim(NEW.email))
    AND si.status = 'pending'
    AND si.expires_at > now()
  ORDER BY si.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_full_name := COALESCE(
      nullif(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
      nullif(trim(_invitation.staff_name), ''),
      ''
    );
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role, business_id, staff_id)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      false,
      'employee',
      _invitation.business_id,
      _invitation.staff_id
    );
    UPDATE public.staff SET user_id = NEW.id WHERE id = _invitation.staff_id;
    UPDATE public.staff_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = _invitation.id;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'manager' THEN
    INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      false,
      'manager'
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_super_admin, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    false,
    'client'
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) staff: employees see own row; managers see all; tighten manage to managers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access employees from their business" ON public.staff;
CREATE POLICY "Users can access employees from their business"
  ON public.staff FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
        )
        OR public.staff.id IN (
          SELECT p.staff_id FROM public.profiles p WHERE p.id = auth.uid() AND p.staff_id IS NOT NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage employees from their business" ON public.staff;
CREATE POLICY "Users can manage employees from their business"
  ON public.staff FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

DROP POLICY IF EXISTS "employee_update_own_staff_row" ON public.staff;
CREATE POLICY "employee_update_own_staff_row"
  ON public.staff FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) appointments: employees only assigned rows; managers all; manage = managers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access appointments from their business" ON public.appointments;
CREATE POLICY "Users can access appointments from their business"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
        )
        OR (
          staff_id IS NOT NULL
          AND staff_id::text IN (SELECT s.id::text FROM public.staff s WHERE s.user_id = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage appointments from their business" ON public.appointments;
CREATE POLICY "Users can manage appointments from their business"
  ON public.appointments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 8) time_entries
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access time_entries from their business" ON public.time_entries;
CREATE POLICY "Users can access time_entries from their business"
  ON public.time_entries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
        )
        OR (
          staff_id IS NOT NULL
          AND staff_id::text IN (SELECT s.id::text FROM public.staff s WHERE s.user_id = auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage time_entries from their business" ON public.time_entries;
CREATE POLICY "Users can manage time_entries from their business"
  ON public.time_entries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 9) staff_shifts (renamed from employee_shifts; policy names unchanged)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access employee_shifts from their business" ON public.staff_shifts;
CREATE POLICY "Users can access employee_shifts from their business"
  ON public.staff_shifts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT p.business_id FROM public.profiles p WHERE p.id = auth.uid() AND p.business_id IS NOT NULL)
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
        )
        OR staff_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage employee_shifts in their business" ON public.staff_shifts;
CREATE POLICY "Users can manage employee_shifts in their business"
  ON public.staff_shifts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
    OR (
      business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (p.is_super_admin = true OR p.role IN ('manager', 'super_admin'))
      )
    )
  );
