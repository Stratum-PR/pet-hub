import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { devConsole } from '@/lib/clientDebug';

/**
 * Manager (business owner) sign-up finishes after email confirmation, when the new user first has a session:
 * the browser calls the SECURITY DEFINER RPC `complete_manager_signup`, which creates the business and makes the
 * profile a manager. The pending business name and plan travel in `user_metadata` so this works on any device or
 * browser and through a magic link, not only in the browser that filled in the form.
 *
 * The metadata is only a hint for the browser to call the RPC. The database never reads it for the role
 * (P0-01 / P2-07): any signed-in user may call `complete_manager_signup` anyway, and it returns without doing
 * anything when the profile already has a business. The key must never be `role`.
 */
export const PENDING_MANAGER_SIGNUP_METADATA_KEY = 'pending_manager_signup';

/** Legacy keys (written by Register before the metadata existed): those sign-ups still finish in the original browser. */
export const PENDING_MANAGER_BUSINESS_NAME = 'pending_manager_business_name';
export const PENDING_MANAGER_TIER = 'pending_manager_tier';

export type PendingManagerSignup = {
  businessName: string;
  tier: string;
};

type PendingManagerSignupMetadata = {
  business_name: string;
  tier: string;
};

/** Value for `signUp` `options.data[PENDING_MANAGER_SIGNUP_METADATA_KEY]`. */
export function buildPendingManagerSignupMetadata(businessName: string, tier: string): PendingManagerSignupMetadata {
  return { business_name: businessName.trim(), tier: tier || 'basic' };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function clearPendingManagerSignupLocally() {
  const storage = safeLocalStorage();
  storage?.removeItem(PENDING_MANAGER_BUSINESS_NAME);
  storage?.removeItem(PENDING_MANAGER_TIER);
}

/** Pending sign-up recorded in the user's own metadata at sign-up; null when none. */
export function readPendingManagerSignupFromMetadata(
  user: Pick<User, 'user_metadata'> | null | undefined,
): PendingManagerSignup | null {
  const raw = (user?.user_metadata as Record<string, unknown> | undefined)?.[PENDING_MANAGER_SIGNUP_METADATA_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Partial<PendingManagerSignupMetadata>;
  const businessName = typeof meta.business_name === 'string' ? meta.business_name.trim() : '';
  if (!businessName) return null;
  return { businessName, tier: typeof meta.tier === 'string' && meta.tier ? meta.tier : 'basic' };
}

/**
 * Metadata first, else this browser's legacy localStorage keys. Only `/auth/callback` (reached from the
 * confirmation email) uses the localStorage fallback: the keys don't say which user wrote them, so the general
 * login routing must not apply them to whoever signs in next on a shared browser.
 */
export function readPendingManagerSignup(user: Pick<User, 'user_metadata'> | null | undefined): PendingManagerSignup | null {
  const fromMetadata = readPendingManagerSignupFromMetadata(user);
  if (fromMetadata) return fromMetadata;
  const storage = safeLocalStorage();
  const localName = storage?.getItem(PENDING_MANAGER_BUSINESS_NAME)?.trim();
  if (localName) return { businessName: localName, tier: storage?.getItem(PENDING_MANAGER_TIER) || 'basic' };
  return null;
}

type ProfileForPendingSignup = {
  is_super_admin?: boolean | null;
  business_id?: string | null;
  role?: string | null;
} | null;

/**
 * Only a plain client with no business finishes a pending manager sign-up. Employees (invited staff), managers,
 * super admins and anyone already linked to a business are left alone. A missing profile row counts as a client
 * (the RPC creates it).
 */
export function canCompletePendingManagerSignup(profile: ProfileForPendingSignup): boolean {
  if (!profile) return true;
  if (profile.is_super_admin) return false;
  if (profile.business_id) return false;
  return !profile.role || profile.role === 'client';
}

export type CompletePendingManagerSignupResult = 'completed' | 'failed';
export type FinishPendingManagerSignupResult = CompletePendingManagerSignupResult | 'none';

type CompletedListener = (userId: string) => void | Promise<void>;
const completedListeners = new Set<CompletedListener>();

/**
 * Runs after `complete_manager_signup` succeeded, before the caller navigates. AuthContext uses it to refetch the
 * cached profile; otherwise the dashboard would still see "client, no business" and send the owner to /portal.
 */
export function onPendingManagerSignupCompleted(listener: CompletedListener): () => void {
  completedListeners.add(listener);
  return () => {
    completedListeners.delete(listener);
  };
}

const inFlight = new Map<string, Promise<CompletePendingManagerSignupResult>>();

async function runComplete(userId: string, pending: PendingManagerSignup): Promise<CompletePendingManagerSignupResult> {
  const { error } = await supabase.rpc('complete_manager_signup', {
    p_business_name: pending.businessName,
    p_subscription_tier: pending.tier,
  });
  if (error) {
    devConsole.error('[pendingManagerSignup] complete_manager_signup failed:', error);
    return 'failed';
  }
  clearPendingManagerSignupLocally();
  // Clear the hint so later logins don't look again. Non-blocking: if it stays, the next login does nothing
  // because the profile now has a business.
  const { error: metaError } = await supabase.auth.updateUser({
    data: { [PENDING_MANAGER_SIGNUP_METADATA_KEY]: null },
  });
  if (metaError) devConsole.warn('[pendingManagerSignup] could not clear the metadata flag:', metaError);
  await Promise.all(
    Array.from(completedListeners, async (listener) => {
      try {
        await listener(userId);
      } catch (err) {
        devConsole.warn('[pendingManagerSignup] completed listener failed:', err);
      }
    }),
  );
  return 'completed';
}

/**
 * Calls `complete_manager_signup` once per user at a time (AuthCallback, the landing page and the login form can
 * all resolve the destination for the same session); concurrent callers share the same promise.
 */
export function completePendingManagerSignup(
  userId: string,
  pending: PendingManagerSignup,
): Promise<CompletePendingManagerSignupResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const promise = runComplete(userId, pending).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}

/**
 * Finishes a pending manager sign-up for this user if there is one and their profile is still a plain client with
 * no business. `includeLocalStorage` also accepts the legacy browser keys (only `/auth/callback` passes it).
 * Returns 'none' when there was nothing to do.
 */
export async function finishPendingManagerSignupIfNeeded(
  user: Pick<User, 'id' | 'user_metadata'>,
  opts: { includeLocalStorage?: boolean } = {},
): Promise<FinishPendingManagerSignupResult> {
  const pending = opts.includeLocalStorage ? readPendingManagerSignup(user) : readPendingManagerSignupFromMetadata(user);
  if (!pending) return 'none';
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_super_admin, business_id, role')
    .eq('id', user.id)
    .maybeSingle<NonNullable<ProfileForPendingSignup>>();
  if (error) {
    devConsole.warn('[pendingManagerSignup] could not read the profile:', error);
    return 'failed';
  }
  if (!canCompletePendingManagerSignup(profile ?? null)) {
    // Already finished (or not a client): drop the stale local keys; the metadata flag is harmless.
    clearPendingManagerSignupLocally();
    return 'none';
  }
  return completePendingManagerSignup(user.id, pending);
}
