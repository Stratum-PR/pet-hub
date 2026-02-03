import type { Business } from '@/lib/auth';
import { authLog } from '@/lib/authDebugLog';

export const AUTH_CONTEXTS = {
  ADMIN: 'admin',
  BUSINESS: 'business',
  DEMO: 'demo',
  NONE: 'none',
} as const;

export type AuthContextType = (typeof AUTH_CONTEXTS)[keyof typeof AUTH_CONTEXTS];

export function slugify(input: string | null | undefined): string {
  if (input == null || typeof input !== 'string') return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function setAuthContext(context: AuthContextType) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('authContext', context);
}

export function getAuthContext(): AuthContextType {
  if (typeof window === 'undefined') return AUTH_CONTEXTS.NONE;
  return (sessionStorage.getItem('authContext') as AuthContextType) || AUTH_CONTEXTS.NONE;
}

export function clearAuthContext() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('authContext');
  sessionStorage.removeItem('demoMode');
  sessionStorage.removeItem('business_slug');
}

export function setBusinessSlugForSession(business: Business | null) {
  if (typeof window === 'undefined') {
    authLog('authRouting', 'setBusinessSlugForSession skipped', { reason: 'no window' });
    return;
  }
  const slug = business?.slug?.trim()
    ? slugify(business.slug.trim())
    : business?.name
      ? slugify(business.name)
      : '';
  if (!slug) {
    authLog('authRouting', 'setBusinessSlugForSession skipped', { reason: 'no business or business.name/slug', hasBusiness: !!business, businessName: business?.name ?? null });
    return;
  }
  sessionStorage.setItem('business_slug', slug);
  authLog('authRouting', 'setBusinessSlugForSession', { businessName: business.name, slug });
}

export function getBusinessSlugFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('business_slug');
}

export function setDemoMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    sessionStorage.setItem('demoMode', 'true');
    setAuthContext(AUTH_CONTEXTS.DEMO);
  } else {
    sessionStorage.removeItem('demoMode');
    if (getAuthContext() === AUTH_CONTEXTS.DEMO) setAuthContext(AUTH_CONTEXTS.NONE);
  }
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('demoMode') === 'true';
}

export function getDefaultRoute(opts: {
  isAdmin: boolean;
  business: Business | null;
}): string {
  if (opts.isAdmin) {
    authLog('authRouting', 'getDefaultRoute', { destination: '/admin', reason: 'isAdmin' });
    return '/admin';
  }
  if (isDemoMode()) {
    authLog('authRouting', 'getDefaultRoute', { destination: '/demo/dashboard', reason: 'demoMode' });
    return '/demo/dashboard';
  }
  const sessionSlug = getBusinessSlugFromSession();
  const storedSlug = opts.business?.slug?.trim() || null;
  const nameSlug = opts.business?.name != null ? slugify(opts.business.name) : '';
  const slug = sessionSlug || storedSlug || (nameSlug || null);
  const destination = slug ? `/${slug}/dashboard` : '/';
  authLog('authRouting', 'getDefaultRoute', {
    sessionSlug,
    storedSlug: storedSlug ?? null,
    nameSlug: nameSlug || null,
    businessName: opts.business?.name ?? null,
    slug: slug || null,
    destination,
    reason: slug ? 'slug resolved' : 'no slug – falling back to /',
  });
  return destination;
}

export function getLastRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lastRoute');
}

export function setLastRoute(path: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lastRoute', path);
}

