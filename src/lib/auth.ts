import { supabase } from '@/integrations/supabase/client';
import { clearAuthContext } from '@/lib/authRouting';
import { debugIngest } from '@/lib/debugIngest';

export type ProfileRole = 'admin' | 'manager' | 'employee' | 'client';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
  business_id: string | null;
  role?: ProfileRole | null;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  website: string | null;
  logo_url: string | null;
  /** URL slug for /:slug/dashboard; generated from name if not set */
  slug?: string | null;
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Get the current user's profile with business info
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

/**
 * Get the current user's business
 */
export async function getCurrentBusiness(): Promise<Business | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.business_id) return null;

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !data) return null;
  return data as Business;
}

/**
 * Check if current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.is_super_admin ?? false;
}

/**
 * Get the active business ID (for impersonation support)
 * Returns impersonating_business_id if in impersonation mode, otherwise profile.business_id
 */
export function getActiveBusinessId(): string | null {
  // Check sessionStorage for impersonation
  if (typeof window !== 'undefined') {
    const isImpersonating = sessionStorage.getItem('is_impersonating') === 'true';
    if (isImpersonating) {
      const impersonatingBusinessId = sessionStorage.getItem('impersonating_business_id');
      if (impersonatingBusinessId) {
        return impersonatingBusinessId;
      }
    }
  }

  // Otherwise, get from profile (async, but we'll handle this in hooks)
  return null;
}

/**
 * Check if currently impersonating
 */
export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('is_impersonating') === 'true';
}

/**
 * Exit impersonation mode
 */
export function exitImpersonation() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('is_impersonating');
  sessionStorage.removeItem('impersonating_business_id');
  sessionStorage.removeItem('impersonating_business_name');
  window.location.href = '/admin';
}

/**
 * Set impersonation mode
 */
export function setImpersonation(businessId: string, businessName: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('is_impersonating', 'true');
  sessionStorage.setItem('impersonating_business_id', businessId);
  sessionStorage.setItem('impersonating_business_name', businessName);
}

/**
 * Get impersonating business name
 */
export function getImpersonatingBusinessName(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('impersonating_business_name');
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Require super admin - throws if not super admin
 */
export async function requireSuperAdmin() {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    throw new Error('Super admin access required');
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  // #region agent log
  debugIngest({ location: 'auth.ts:signOut', message: 'signOut entry', hypothesisId: 'H1,H2' });
  // #endregion
  // Clear impersonation first (before sign out)
  if (isImpersonating()) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('is_impersonating');
      sessionStorage.removeItem('impersonating_business_id');
      sessionStorage.removeItem('impersonating_business_name');
    }
  }

  try {
    // Best-effort sign out; don't let failures block UI navigation
    const { error } = await supabase.auth.signOut();
    // #region agent log
    debugIngest({ location: 'auth.ts:signOut', message: 'after supabase.auth.signOut', data: { error: error?.message ?? null }, hypothesisId: 'H2' });
    // #endregion
    if (error) {
      console.error('[Auth] signOut error:', error);
    }
  } catch (err) {
    console.error('[Auth] signOut unexpected error:', err);
    // #region agent log
    debugIngest({ location: 'auth.ts:signOut', message: 'signOut threw', data: { err: (err as Error)?.message }, hypothesisId: 'H2' });
    // #endregion
  }

  // Clear all session-scoped routing/context flags
  clearAuthContext();
  // #region agent log
  debugIngest({ location: 'auth.ts:signOut', message: 'after clearAuthContext', hypothesisId: 'H1' });
  // #endregion
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastRoute');
    }
  } catch {
    // ignore
  }
}
