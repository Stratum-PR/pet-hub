import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Business } from '@/lib/auth';

/**
 * Replace URL with canonical `businesses.slug` when the route used a legacy alias or stale segment.
 */
export function useCanonicalSlugRedirect(resolvedBusiness: Business | null | undefined) {
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!businessSlug || !resolvedBusiness?.slug) return;
    if (resolvedBusiness.slug === businessSlug) return;
    const prefix = `/${businessSlug}`;
    if (!location.pathname.startsWith(prefix)) return;
    const suffix = location.pathname.slice(prefix.length);
    navigate(`/${resolvedBusiness.slug}${suffix}${location.search}${location.hash}`, { replace: true });
  }, [businessSlug, resolvedBusiness?.slug, location.pathname, location.search, location.hash, navigate]);
}
