import { useAuth } from '@/contexts/AuthContext';
import { getActiveBusinessId, isImpersonating } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to get the active business ID (supports impersonation)
 * Returns the business_id that should be used for all queries
 */
export function useBusinessId(): string | null {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const location = useLocation();

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
      return;
    }

    // Check if impersonating first
    if (isImpersonating()) {
      const impersonatingId = getActiveBusinessId();
      if (impersonatingId) {
        console.log('[useBusinessId] Using impersonation ID:', impersonatingId);
        setBusinessId(impersonatingId);
        return;
      }
    }

    // Otherwise use profile's business_id
    const id = profile?.business_id || null;
    console.log('[useBusinessId] Profile loaded:', {
      email: profile?.email,
      hasProfile: !!profile,
      business_id: profile?.business_id,
      resolvedId: id
    });
    setBusinessId(id);
  }, [profile]);

  return businessId;
}
