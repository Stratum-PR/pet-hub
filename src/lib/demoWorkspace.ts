/** Public demo tenant (matches Supabase seed). */
export const DEMO_WORKSPACE_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

/** Public URL segment for the demo business (vanity slug in `businesses.slug`). */
export const DEMO_WORKSPACE_SLUG = 'demo';

/** Marketing shortcut `/demo/*` redirects to this slug in the router. */
export function isDemoLegacyPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

/** True when the URL is the public demo workspace (legacy `/demo` or canonical `/demo/...`). */
export function isPublicDemoPath(pathname: string): boolean {
  if (isDemoLegacyPath(pathname)) return true;
  const base = `/${DEMO_WORKSPACE_SLUG}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
