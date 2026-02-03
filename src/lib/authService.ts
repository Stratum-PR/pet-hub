import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Auth workflow helpers. Used by Login/Signup and by unit tests with a mock client.
 * Uses current origin for redirect so OAuth callback and PKCE cookie share the same origin.
 */

export async function performEmailSignup(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
}

/**
 * Client signup: creates account with metadata so handle_new_user trigger
 * sets profile.role = 'client' (no business_id).
 */
export async function performClientSignup(
  supabase: SupabaseClient,
  email: string,
  password: string
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        signup_role: 'client',
      },
    },
  });
}

/**
 * Employee signup (invite-only): creates account with metadata so handle_new_user trigger
 * looks up employee_invitations by invite_token, sets profile.role = 'employee' and profile.business_id.
 */
export async function performEmployeeSignup(
  supabase: SupabaseClient,
  email: string,
  password: string,
  inviteToken: string
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        signup_role: 'employee',
        invite_token: inviteToken.trim() || undefined,
      },
    },
  });
}

/**
 * Manager signup: creates account with metadata so handle_new_user trigger
 * creates a business and sets profile.role = 'manager' and profile.business_id.
 */
export async function performManagerSignup(
  supabase: SupabaseClient,
  email: string,
  password: string,
  businessName: string
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        signup_role: 'manager',
        business_name: businessName.trim() || undefined,
      },
    },
  });
}

export async function performOAuthLogin(
  supabase: SupabaseClient,
  provider: 'google' | 'azure'
) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });
}
