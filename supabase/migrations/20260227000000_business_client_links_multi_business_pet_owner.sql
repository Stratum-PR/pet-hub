-- Multi-business pet owner: one account (auth user) can be linked to many businesses.
-- business_client_links: status only 'approved' | 'revoked' (no pending/denied; linking is instant).

CREATE TABLE IF NOT EXISTS public.business_client_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'revoked')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_client_links_user_id ON public.business_client_links(user_id);
CREATE INDEX IF NOT EXISTS idx_business_client_links_business_id ON public.business_client_links(business_id);

ALTER TABLE public.business_client_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own business_client_links"
  ON public.business_client_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Business can read client links for their business"
  ON public.business_client_links FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Users can insert own business_client_link"
  ON public.business_client_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own business_client_link"
  ON public.business_client_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can update business_client_links"
  ON public.business_client_links FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE OR REPLACE FUNCTION public.update_business_client_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS update_business_client_links_updated_at ON public.business_client_links;
CREATE TRIGGER update_business_client_links_updated_at
  BEFORE UPDATE ON public.business_client_links
  FOR EACH ROW EXECUTE FUNCTION public.update_business_client_links_updated_at();
