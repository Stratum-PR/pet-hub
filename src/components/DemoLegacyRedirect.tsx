import { Navigate, useLocation } from 'react-router-dom';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Index from '@/pages/Index';

function normalizePathname(path: string): string {
  const p = path.replace(/\/+/g, '/');
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p;
}

/**
 * Redirect `/demo/...` to `/{DEMO_WORKSPACE_SLUG}/...` when the slug differs (legacy vanity URL).
 * When the slug is literally `demo`, target === current — **do not** `<Navigate>` to the same URL (infinite loop → white screen); render the app instead.
 */
export function DemoLegacyRedirect() {
  const location = useLocation();
  const tail = location.pathname.replace(/^\/demo\/?/, '') || 'dashboard';
  const targetPathname = normalizePathname(`/${DEMO_WORKSPACE_SLUG}/${tail}`);
  const currentPathname = normalizePathname(location.pathname);

  if (targetPathname === currentPathname) {
    return (
      <ProtectedRoute>
        <Index />
      </ProtectedRoute>
    );
  }

  return <Navigate to={`${targetPathname}${location.search}${location.hash}`} replace />;
}
