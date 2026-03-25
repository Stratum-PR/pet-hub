import { Navigate, useLocation } from 'react-router-dom';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';

/** Redirect `/demo` and `/demo/...` to canonical demo slug (`/{DEMO_WORKSPACE_SLUG}/...`). */
export function DemoLegacyRedirect() {
  const location = useLocation();
  const tail = location.pathname.replace(/^\/demo\/?/, '') || 'dashboard';
  return (
    <Navigate to={`/${DEMO_WORKSPACE_SLUG}/${tail}${location.search}${location.hash}`} replace />
  );
}
