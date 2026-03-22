import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/** URL is the public demo workspace (`/demo` or `/demo/...`). */
export function isDemoBrowseOnlyPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

/** Logged-out visitor on `/demo/*` — must not call Supabase writes; use in-memory / local state only. */
export function isDemoBrowseOnlySession(pathname: string, userId: string | undefined): boolean {
  return isDemoBrowseOnlyPath(pathname) && !userId;
}

export function useDemoBrowseOnly(): boolean {
  const { user } = useAuth();
  const { pathname } = useLocation();
  return useMemo(() => isDemoBrowseOnlySession(pathname, user?.id), [pathname, user?.id]);
}
