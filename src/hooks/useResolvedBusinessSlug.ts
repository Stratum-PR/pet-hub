import { useParams, useLocation } from 'react-router-dom';
import { DEMO_WORKSPACE_SLUG, isPublicDemoPath } from '@/lib/demoWorkspace';

/**
 * `businessSlug` from `/:businessSlug/*` is missing when the matched route is legacy `/demo/*`.
 * For public demo URLs, derive the workspace segment from the pathname so links and redirects stay scoped.
 */
export function useResolvedBusinessSlug(): string | undefined {
  const { businessSlug: param } = useParams<{ businessSlug?: string }>();
  const { pathname } = useLocation();
  return param ?? (isPublicDemoPath(pathname) ? DEMO_WORKSPACE_SLUG : undefined);
}
