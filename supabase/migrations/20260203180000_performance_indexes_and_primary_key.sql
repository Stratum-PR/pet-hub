-- ============================================
-- Supabase Performance Advisor fixes
-- ============================================
-- 1. Unindexed foreign keys: add indexes for FK columns that lack them
-- 2. No primary key on appointments: ensure appointments has a primary key
-- ============================================

-- 1. INDEXES FOR UNINDEXED FOREIGN KEYS
-- -------------------------------------
-- admin_impersonation_tokens: admin_id, business_id
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_tokens_admin_id
  ON public.admin_impersonation_tokens(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_tokens_business_id
  ON public.admin_impersonation_tokens(business_id);

-- appointments: pet_id (client_id and business_id may already be indexed in other migrations)
CREATE INDEX IF NOT EXISTS idx_appointments_pet_id
  ON public.appointments(pet_id);

-- employees: business_id
CREATE INDEX IF NOT EXISTS idx_employees_business_id
  ON public.employees(business_id);

-- pets: client_id (FK name is pets_client_id_fkey; column may be client_id in production)
CREATE INDEX IF NOT EXISTS idx_pets_client_id
  ON public.pets(client_id);

-- 2. APPOINTMENTS PRIMARY KEY
-- ---------------------------
-- Ensure appointments has a primary key (lint: no_primary_key).
-- If id column exists but PK was dropped, add it back.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.appointments ADD PRIMARY KEY (id);
  END IF;
END;
$$;
