import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const PUBLIC_FIRST_SEGMENTS = new Set([
  '',
  'pricing',
  'login',
  'registrarse',
  'auth',
  'cliente',
  'signup',
  'demo', // optional: allow indexing demo for marketing
]);

/**
 * Sets noindex for protected app and admin routes so only marketing pages are indexed.
 * Mount inside Router so useLocation works.
 */
export function NoIndexForProtectedRoutes() {
  const { pathname } = useLocation();
  const firstSegment = pathname.slice(1).split('/')[0] ?? '';

  const isProtected =
    pathname.startsWith('/admin') ||
    (pathname.length > 1 && pathname.includes('/') && !PUBLIC_FIRST_SEGMENTS.has(firstSegment));

  if (!isProtected) return null;

  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
  );
}
