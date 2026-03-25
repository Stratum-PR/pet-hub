import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPORT_USER_SESSION_ACTIVE_KEY = 'support_user_session_active';
export const SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY = 'support_admin_session_snapshot';

export interface AdminSessionSnapshot {
  access_token: string;
  refresh_token: string;
}

export function saveSupportAdminSnapshot(snapshot: AdminSessionSnapshot): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function clearSupportSessionMarkers(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SUPPORT_USER_SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY);
}

/** Remove only the saved admin tokens (e.g. failed verifyOtp after snapshot was saved). */
export function clearSupportAdminSnapshotOnly(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY);
}

export function isSupportUserSessionActive(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SUPPORT_USER_SESSION_ACTIVE_KEY) === 'true';
}

export function markSupportUserSessionActive(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPPORT_USER_SESSION_ACTIVE_KEY, 'true');
  window.dispatchEvent(new Event('support-session-changed'));
}

/** Restore super-admin session after support impersonation; redirects to /admin on success */
export async function exitSupportUserSession(client: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') return;
  const raw = sessionStorage.getItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY);
  sessionStorage.removeItem(SUPPORT_USER_SESSION_ACTIVE_KEY);
  if (!raw) {
    window.location.href = '/admin';
    return;
  }
  let snap: AdminSessionSnapshot;
  try {
    snap = JSON.parse(raw) as AdminSessionSnapshot;
  } catch {
    sessionStorage.removeItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY);
    window.location.href = '/admin';
    return;
  }
  const { error } = await client.auth.setSession({
    access_token: snap.access_token,
    refresh_token: snap.refresh_token,
  });
  sessionStorage.removeItem(SUPPORT_ADMIN_SESSION_SNAPSHOT_KEY);
  if (error) {
    throw error;
  }
  window.location.href = '/admin';
}
