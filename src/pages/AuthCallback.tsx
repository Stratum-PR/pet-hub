import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  resolveAuthenticatedDestination,
  getPostAuthHint,
  clearPostAuthHint,
} from '@/lib/authRouting';
import { broadcastAuthLogin } from '@/lib/authBroadcast';
import { devConsole } from '@/lib/clientDebug';
import { finishPendingManagerSignupIfNeeded } from '@/lib/pendingManagerSignup';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [rpcError, setRpcError] = useState<string | null>(null);
  const [retryUser, setRetryUser] = useState<User | null>(null);

  /**
   * Finishes a pending manager sign-up (metadata, or this browser's legacy keys), then routes by the profile.
   * Returns false (and shows the error screen) when the business could not be created.
   */
  const finishAndRoute = async (user: User, isCancelled: () => boolean): Promise<boolean> => {
    const result = await finishPendingManagerSignupIfNeeded(user, { includeLocalStorage: true });
    if (isCancelled()) return true;
    if (result === 'failed') {
      setRetryUser(user);
      setRpcError('Something went wrong. Please try again.');
      setStatus('error');
      return false;
    }
    setRpcError(null);
    const route = await resolveAuthenticatedDestination(user.id);
    const hint = getPostAuthHint();
    // A new business owner goes to their dashboard even if a pet-owner hint was left in this tab.
    const hintedRoute =
      result === 'none' && hint?.mode === 'pet_owner'
        ? `/portal${hint.businessSlug ? `?business=${encodeURIComponent(hint.businessSlug)}` : ''}`
        : route;
    clearPostAuthHint();
    if (!isCancelled()) navigate(hintedRoute, { replace: true });
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          devConsole.error('[AuthCallback] exchangeCodeForSession error:', error);
          if (!cancelled) setStatus('error');
          return;
        }
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        if (!cancelled) navigate('/login', { replace: true });
        return;
      }

      await refreshAuth(session.user);
      if (!cancelled) {
        broadcastAuthLogin(session.user);
      }

      await finishAndRoute(session.user, () => cancelled);
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finishAndRoute only uses stable setters/navigate
  }, [searchParams, navigate, refreshAuth]);

  const handleRetry = async () => {
    if (!retryUser) return;
    setStatus('loading');
    setRpcError(null);
    await finishAndRoute(retryUser, () => false);
  };

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-destructive font-medium">
            {rpcError
              ? 'No se pudo crear tu negocio. Error: ' + rpcError
              : 'Error al completar el inicio de sesión.'}
          </p>
          {rpcError && (
            <p className="text-muted-foreground text-sm">
              Comprueba que la migración de Supabase esté aplicada (complete_manager_signup). Si ya iniciaste sesión, puedes reintentar.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {retryUser && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
              >
                Reintentar crear negocio
              </button>
            )}
            <a href="/login" className="rounded-md border px-4 py-2 hover:bg-muted">
              Ir a Iniciar sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-muted-foreground">Completando inicio de sesión...</p>
    </div>
  );
}
