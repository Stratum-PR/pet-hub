import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDefaultRoute,
  setAuthContext,
  setBusinessSlugForSession,
  AUTH_CONTEXTS,
  resolveSuperAdminLoginDestination,
  fetchPreferAdminDashboardOnLogin,
} from '@/lib/authRouting';
import type { Business } from '@/lib/auth';
import { getEmployeePostLoginPath } from '@/lib/employeePostLogin';
import { broadcastAuthLogin } from '@/lib/authBroadcast';

const PENDING_MANAGER_BUSINESS_NAME = 'pending_manager_business_name';
const PENDING_MANAGER_TIER = 'pending_manager_tier';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [rpcError, setRpcError] = useState<string | null>(null);

  const runCompleteManagerSignup = async (): Promise<boolean> => {
    const pendingName = localStorage.getItem(PENDING_MANAGER_BUSINESS_NAME);
    const pendingTier = localStorage.getItem(PENDING_MANAGER_TIER) || 'basic';
    if (!pendingName) return false;
    await delay(400);
    const { error } = await supabase.rpc('complete_manager_signup', {
      p_business_name: pendingName,
      p_subscription_tier: pendingTier,
    });
    if (error) {
      setRpcError('Something went wrong. Please try again.');
      return false;
    }
    setRpcError(null);
    localStorage.removeItem(PENDING_MANAGER_BUSINESS_NAME);
    localStorage.removeItem(PENDING_MANAGER_TIER);
    return true;
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[AuthCallback] exchangeCodeForSession error:', error);
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

      const pendingName = localStorage.getItem(PENDING_MANAGER_BUSINESS_NAME);
      const pendingTier = localStorage.getItem(PENDING_MANAGER_TIER) || 'basic';

      if (pendingName) {
        const ok = await runCompleteManagerSignup();
        if (cancelled) return;
        if (!ok) {
          setStatus('error');
          return;
        }
        setAuthContext(AUTH_CONTEXTS.BUSINESS);
        const route = getDefaultRoute({ isAdmin: false, business: null });
        navigate(route, { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin, business_id, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.is_super_admin) {
        let business: Business | null = null;
        if (profile.business_id) {
          const { data: biz } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', profile.business_id)
            .single();
          if (biz) business = biz as Business;
        }
        const preferAdminDashboard = await fetchPreferAdminDashboardOnLogin(session.user.id);
        const route = resolveSuperAdminLoginDestination({
          preferAdminDashboard,
          businessId: profile.business_id ?? null,
          business,
        });
        if (!cancelled) navigate(route, { replace: true });
        return;
      }

      if (profile?.role === 'employee') {
        let business: Business | null = null;
        if (profile.business_id) {
          const { data: biz } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', profile.business_id)
            .single();
          if (biz) {
            business = biz as Business;
            setBusinessSlugForSession(business);
          }
        }
        setAuthContext(AUTH_CONTEXTS.BUSINESS);
        if (!cancelled) navigate(getEmployeePostLoginPath(business), { replace: true });
        return;
      }

      let business: Business | null = null;
      if (profile?.business_id) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', profile.business_id)
          .single();
        if (biz) {
          business = biz as Business;
          setBusinessSlugForSession(business);
        }
      }

      setAuthContext(AUTH_CONTEXTS.BUSINESS);
      let route = getDefaultRoute({ isAdmin: false, business });
      if (route === '/login' && profile?.business_id) {
        route = '/';
      }
      if (route === '/login' && profile && !profile.business_id) {
        navigate('/cliente', { replace: true });
        return;
      }
      if (!cancelled) navigate(route, { replace: true });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, refreshAuth]);

  const handleRetry = async () => {
    setStatus('loading');
    setRpcError(null);
    const ok = await runCompleteManagerSignup();
    if (ok) {
      await refreshAuth();
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.user) broadcastAuthLogin(s.session.user);
      setAuthContext(AUTH_CONTEXTS.BUSINESS);
      const route = getDefaultRoute({ isAdmin: false, business: null });
      navigate(route, { replace: true });
    } else {
      setStatus('error');
    }
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
            {localStorage.getItem(PENDING_MANAGER_BUSINESS_NAME) && (
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
