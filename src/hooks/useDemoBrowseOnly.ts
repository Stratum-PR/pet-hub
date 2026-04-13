import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { isPublicDemoPath } from '@/lib/demoWorkspace';

/** URL is the public demo workspace (legacy `/demo` or canonical demo slug). */
export function isDemoBrowseOnlyPath(pathname: string): boolean {
  return isPublicDemoPath(pathname);
}

/**
 * Logged-out visitor on `/demo/*` — used for settings that must stay in localStorage only (no profile).
 * For “no writes to shared data”, use {@link useDemoBrowseOnly} instead.
 */
export function isDemoBrowseOnlySession(pathname: string, userId: string | undefined): boolean {
  return isDemoBrowseOnlyPath(pathname) && !userId;
}

/** Anyone on the public demo workspace URL — no Supabase writes; showcase / dummy data only. */
export function useDemoBrowseOnly(): boolean {
  const { pathname } = useLocation();
  return useMemo(() => isPublicDemoPath(pathname), [pathname]);
}
