import type { Business } from '@/lib/auth';
import { clearAllDemoStoredSettings } from '@/lib/demoLocalSettings';
import { DEMO_WORKSPACE_SLUG } from '@/lib/demoWorkspace';
import { supabase } from '@/integrations/supabase/client';

export const DEMO_LANGUAGE_STORAGE_KEY = 'pet-hub-demo-language';
const DEMO_THEME_STORAGE_KEY = 'pet-hub-theme-demo';

export const AUTH_CONTEXTS = {
  ADMIN: 'admin',
  BUSINESS: 'business',
  DEMO: 'demo',
  NONE: 'none',
} as const;

export type AuthContextType = (typeof AUTH_CONTEXTS)[keyof typeof AUTH_CONTEXTS];

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
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

/** `/:slug/dashboard` from the business row only (ignores session slug). */
export function getBusinessDashboardPath(business: Business | null): string | null {
  if (!business) return null;
  const fromSlug = business.slug?.trim() || null;
  const fromName = business.name ? slugify(business.name) : null;
  const slug = fromSlug || fromName;
  if (!slug) return null;
  return `/${slug}/dashboard`;
}

export function getBusinessSlugFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('business_slug');
}

/** Clears in-browser demo preferences (settings blob, language, theme) when leaving demo. */
export function clearDemoLocalPreferences() {
  if (typeof window === 'undefined') return;
  clearAllDemoStoredSettings();
  localStorage.removeItem(DEMO_LANGUAGE_STORAGE_KEY);
  localStorage.removeItem(DEMO_THEME_STORAGE_KEY);
}

export function setDemoMode(enabled: boolean) {
  if (typeof window === 'undefined') return;
  if (enabled) {
    sessionStorage.setItem('demoMode', 'true');
    setAuthContext(AUTH_CONTEXTS.DEMO);
  } else {
    sessionStorage.removeItem('demoMode');
    if (getAuthContext() === AUTH_CONTEXTS.DEMO) setAuthContext(AUTH_CONTEXTS.NONE);
    clearDemoLocalPreferences();
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
  if (isDemoMode()) return `/${DEMO_WORKSPACE_SLUG}/dashboard`;
  const slug =
    getBusinessSlugFromSession() ||
    opts.business?.slug ||
    (opts.business?.name ? slugify(opts.business.name) : null);
  if (slug) return `/${slug}/dashboard`;
  return '/login';
}

/** Isolated query so a missing DB column cannot break the whole profile fetch used for login redirect. */
export async function fetchPreferAdminDashboardOnLogin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('prefer_admin_dashboard_on_login')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return !!(data as { prefer_admin_dashboard_on_login?: boolean }).prefer_admin_dashboard_on_login;
}

/**
 * Where super admins should land after sign-in.
 * Default: business portal when `business_id` + business row exist and preference is off.
 */
export function resolveSuperAdminLoginDestination(opts: {
  preferAdminDashboard: boolean;
  businessId: string | null;
  business: Business | null;
}): string {
  if (opts.preferAdminDashboard || !opts.businessId || !opts.business) {
    setAuthContext(AUTH_CONTEXTS.ADMIN);
    return '/admin';
  }
  setAuthContext(AUTH_CONTEXTS.BUSINESS);
  setBusinessSlugForSession(opts.business);
  const route = getDefaultRoute({ isAdmin: false, business: opts.business });
  if (route === '/login') {
    setAuthContext(AUTH_CONTEXTS.ADMIN);
    return '/admin';
  }
  return route;
}

export function getLastRoute(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lastRoute');
}

export function setLastRoute(path: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lastRoute', path);
}

