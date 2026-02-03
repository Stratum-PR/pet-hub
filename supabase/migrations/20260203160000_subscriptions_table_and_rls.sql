-- ============================================
-- Subscriptions table and RLS (future tiered billing)
-- ============================================
-- Creates public.subscriptions if missing, ensures business_id exists,
-- enables RLS, and adds business-scoped policies so the table is ready
-- for future package tiers and feature gating.

-- ============================================
-- 1. Table: create if not exists (minimal schema for tiered billing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- If table already existed (e.g. from Dashboard), ensure business_id exists
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Drop existing policies (idempotent)
-- ============================================
DROP POLICY IF EXISTS "Users can read subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert subscriptions for their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can delete subscriptions from their business" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can access all subscriptions" ON public.subscriptions;

-- ============================================
-- 4. RLS policies (business-scoped + super admin)
-- ============================================
CREATE POLICY "Users can read subscriptions from their business"
ON public.subscriptions FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can insert subscriptions for their business"
ON public.subscriptions FOR INSERT
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can update subscriptions from their business"
ON public.subscriptions FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
)
WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Users can delete subscriptions from their business"
ON public.subscriptions FOR DELETE
USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

CREATE POLICY "Super admins can access all subscriptions"
ON public.subscriptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin = true
  )
);

-- ============================================
-- 5. Index for policy performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_business_id ON public.subscriptions(business_id);

-- ============================================
-- 6. Trigger for updated_at (uses existing update_updated_at_column)
-- ============================================
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
