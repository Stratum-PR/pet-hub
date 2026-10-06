import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAuthenticatedDestination } from '@/lib/authRouting';
import { devConsole } from '@/lib/clientDebug';

/**
 * On public entry pages (landing, login): if someone is already signed in, send them to their
 * dashboard instead of showing the page again. Accounts without a business stay put.
 */
export function useRedirectIfAuthenticated() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user?.id || resolvedFor.current === user.id) return;
    resolvedFor.current = user.id;
    let cancelled = false;
    resolveAuthenticatedDestination(user.id)
      .then((destination) => {
        if (cancelled) return;
        if (destination && destination !== '/' && destination !== '/login') {
          navigate(destination, { replace: true });
        }
      })
      .catch((err) => devConsole.warn('[useRedirectIfAuthenticated] could not resolve destination', err));
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, navigate]);
}
