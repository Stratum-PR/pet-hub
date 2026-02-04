import type { Business } from '@/lib/auth';

export const AUTH_CONTEXTS = {
  ADMIN: 'admin',
  BUSINESS: 'business',
  DEMO: 'demo',
  NONE: 'none',
} as const;

export type AuthContextType = (typeof AUTH_CONTEXTS)[keyof typeof AUTH_CONTEXTS];

function slugify(input: string) {
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
  if (typeof window === 'undefined') return;
  if (!business) return;
  const slug = business.slug || (business.name ? slugify(business.name) : null);
  if (slug) sessionStorage.setItem('business_slug', slug);
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
  if (opts.isAdmin) return '/admin';
  if (isDemoMode()) return '/demo/dashboard';
  const slug = getBusinessSlugFromSession() || (opts.business?.slug || (opts.business?.name ? slugify(opts.business.name) : null));
  if (slug) return `/${slug}/dashboard`;
  return '/login';
}

export function getLastRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lastRoute');
}

export function setLastRoute(path: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lastRoute', path);
}

