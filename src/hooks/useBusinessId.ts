import { useAuth } from '@/contexts/AuthContext';
import { getActiveBusinessId, isImpersonating } from '@/lib/auth';
import { getBusinessSlugFromSession } from '@/lib/authRouting';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

/**
 * Hook to get the active business ID (supports impersonation)
 * Returns the business_id that should be used for all queries
 */
export function useBusinessId(): string | null {
  const { profile, business } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [slugResolvedId, setSlugResolvedId] = useState<string | null>(null);
  const location = useLocation();
  const params = useParams<{ businessSlug?: string }>();
  const slugFromRoute = params?.businessSlug;

  // Hard-coded demo business ID used in seed_demo_data.sql
  const DEMO_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    // Special case: public demo route, allow reading demo business data even without profile
    const isDemoRoute = location.pathname.startsWith('/demo');
    if (isDemoRoute) {
      console.log('[useBusinessId] Using DEMO business id for public demo route', {
        path: location.pathname,
      });
      setBusinessId(DEMO_BUSINESS_ID);
      setSlugResolvedId(null);
      return;
    }

    // Check if impersonating first
    if (isImpersonating()) {
      const impersonatingId = getActiveBusinessId();
      if (impersonatingId) {
        console.log('[useBusinessId] Using impersonation ID:', impersonatingId);
        setBusinessId(impersonatingId);
        setSlugResolvedId(null);
        return;
      }
    }

    // 1) Profile's business_id (primary)
    const fromProfile = profile?.business_id || null;
    if (fromProfile) {
      setBusinessId(fromProfile);
      setSlugResolvedId(null);
      return;
    }

    // 2) Business from AuthContext (e.g. already loaded by profile)
    if (business?.id) {
      setBusinessId(business.id);
      setSlugResolvedId(null);
      return;
    }

    // 3) On a business route with slug but no business_id yet: leave for async slug resolution below
    setBusinessId(null);
    setSlugResolvedId(null);
  }, [profile?.business_id, business?.id, slugFromRoute, location.pathname]);

  // Resolve business id from slug when on a business route and we don't have id from profile/context
  useEffect(() => {
    if (businessId) {
      setSlugResolvedId(null);
      return;
    }
    const slug = slugFromRoute || getBusinessSlugFromSession();
    if (!slug) {
      setSlugResolvedId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (cancelled || error) return;
      if (data?.id) setSlugResolvedId(data.id);
    })();
    return () => { cancelled = true; };
  }, [businessId, slugFromRoute]);

  const resolved = businessId || slugResolvedId;
  return resolved ?? null;
}
