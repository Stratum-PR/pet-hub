import { supabase } from '@/integrations/supabase/client';
import { getDefaultRoute, setAuthContext, setBusinessSlugForSession, AUTH_CONTEXTS } from '@/lib/authRouting';
import { authLog } from '@/lib/authDebugLog';
import { debugIngest } from '@/lib/debugIngest';
import type { Business } from '@/lib/auth';

/**
 * Resolve where to send the user after successful auth (login or OAuth callback).
 * Used by Login and AuthCallback.
 */
export async function getRedirectForAuthenticatedUser(): Promise<string> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    authLog('authRedirect', 'getRedirect: no user', { error: userErr?.message });
    // #region agent log
    debugIngest({ location: 'authRedirect.ts:getRedirect', message: 'no user, return /login', data: { error: userErr?.message }, hypothesisId: 'H10,H13' });
    // #endregion
    return '/login';
  }

  const authUser = userRes.user;
  const profilePromise = supabase
    .from('profiles' as any)
    .select('is_super_admin,business_id,role')
    .eq('id', authUser.id)
    .maybeSingle();
  const profileTimeoutMs = 4000;
  const profileTimeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: new Error('Profile fetch timeout') }), profileTimeoutMs)
  );
  const { data: profile, error: profileErr } = await Promise.race([profilePromise, profileTimeoutPromise]);

  authLog('authRedirect', 'profile result', {
    hasProfile: !!profile,
    profileError: profileErr?.message ?? null,
    business_id: profile?.business_id ?? null,
    role: profile?.role ?? null,
    is_super_admin: profile?.is_super_admin ?? null,
  });

  if (profileErr) {
    authLog('authRedirect', 'profile lookup error or timeout', { message: profileErr.message });
    // #region agent log
    debugIngest({ location: 'authRedirect.ts:getRedirect', message: 'profile error, return /client', data: { message: profileErr.message }, hypothesisId: 'H11' });
    // #endregion
    return '/client';
  }

  const isSuperAdmin = !!profile?.is_super_admin;
  if (isSuperAdmin) {
    setAuthContext(AUTH_CONTEXTS.ADMIN);
    authLog('authRedirect', 'redirect destination', { destination: '/admin', reason: 'super_admin' });
    // #region agent log
    debugIngest({ location: 'authRedirect.ts:getRedirect', message: 'super_admin, return /admin', hypothesisId: 'H10' });
    // #endregion
    return '/admin';
  }

  if (!profile?.business_id) {
    if (profile?.role === 'client') {
      authLog('authRedirect', 'redirect destination', { destination: '/client', reason: 'client_no_business' });
      // #region agent log
      debugIngest({ location: 'authRedirect.ts:getRedirect', message: 'client no business, return /client', data: { role: profile?.role }, hypothesisId: 'H11' });
      // #endregion
      return '/client';
    }
    authLog('authRedirect', 'redirect destination', { destination: '/signup/complete-business', reason: 'no_business_id' });
    // #region agent log
    debugIngest({ location: 'authRedirect.ts:getRedirect', message: 'no business_id, return /signup/complete-business', data: { role: profile?.role }, hypothesisId: 'H10,H12' });
    // #endregion
    return '/signup/complete-business';
  }

  setAuthContext(AUTH_CONTEXTS.BUSINESS);
  let business: Business | null = null;
  const bizPromise = supabase
    .from('businesses' as any)
    .select('*')
    .eq('id', profile.business_id)
    .maybeSingle();
  const bizTimeout = new Promise<{ data: any; error: any }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: new Error('Business fetch timeout') }), 3000)
  );
  const { data: biz, error: bizErr } = await Promise.race([bizPromise, bizTimeout]) as { data: any; error: any };
  business = biz as Business | null;

  authLog('authRedirect', 'business fetch result', {
    business_id: profile.business_id,
    hasBusiness: !!business,
    businessError: bizErr?.message ?? null,
    businessName: business?.name ?? null,
  });

  // Persist business slug so it's available as "home" (root of workspace) and for getDefaultRoute
  if (business) {
    setBusinessSlugForSession(business);
    authLog('authRedirect', 'setBusinessSlugForSession called', { businessName: business.name });
  } else {
    authLog('authRedirect', 'business null – NOT calling setBusinessSlugForSession', { profile_business_id: profile.business_id });
  }

  const destination = getDefaultRoute({ isAdmin: false, business });
  authLog('authRedirect', 'redirect destination', { destination, hasBusiness: !!business, finalDestination: destination });
  // #region agent log
  debugIngest({ location: 'authRedirect.ts:getRedirectForAuthenticatedUser', message: 'returning destination', data: { destination, hasBusiness: !!business, businessName: business?.name ?? null }, hypothesisId: 'H10,H11,H12' });
  // #endregion
  return destination;
}
