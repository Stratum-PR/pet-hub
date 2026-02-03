import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getRedirectForAuthenticatedUser } from '@/lib/authRedirect';
import { authLog, getAuthLogsAsText } from '@/lib/authDebugLog';
import { debugIngest } from '@/lib/debugIngest';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Copy, ChevronDown, ChevronUp } from 'lucide-react';

const AUTH_CALLBACK_RAN_KEY = 'auth_callback_navigated';

/**
 * OAuth callback page. We explicitly exchange the code for a session (PKCE) when the URL
 * has a `code` param, then redirect. If the code verifier is missing we show a clear error.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(!!import.meta.env.DEV);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const code = searchParams.get('code');
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';
        authLog('AuthCallback', 'run', { hasCode: !!code, path, search });

        // Clear stale key from a previous OAuth so we don't false-positive "LOOP DETECTED"
        if (code && typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AUTH_CALLBACK_RAN_KEY);
        // Loop detection: only true if we navigated away this flow and landed back on callback with code
        const previouslyNavigated = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTH_CALLBACK_RAN_KEY);
        if (previouslyNavigated && code) {
          authLog('AuthCallback', 'LOOP DETECTED: re-entered with code after previous navigation', {
            hadKey: true,
            hasCode: true,
          });
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(AUTH_CALLBACK_RAN_KEY);
        }

        if (code) {
          authLog('AuthCallback', 'code present, getSession then exchangeCodeForSession');
          await supabase.auth.getSession();
          await new Promise((r) => setTimeout(r, 100));
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) {
            authLog('AuthCallback', 'exchange error', { message: exchangeError.message });
            const msg = exchangeError.message || 'Could not complete sign-in.';
            const isPKCE =
              msg.toLowerCase().includes('pkce') ||
              msg.toLowerCase().includes('code verifier') ||
              msg.toLowerCase().includes('verifier');
            setError(
              isPKCE
                ? 'Sign-in could not be completed because the security key was missing. This usually happens if you opened the sign-in link in a different tab or cleared site data. Please try again: click Google or Microsoft on the login page and complete sign-in in the same browser tab without clearing data.'
                : msg
            );
            setLoading(false);
            return;
          }
          if (data?.session) {
            const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
            const pendingEmployeeToken = ss?.getItem('pending_employee_invite_token');
            const pendingBusinessName = ss?.getItem('pending_manager_business_name');

            if (pendingEmployeeToken?.trim()) {
              authLog('AuthCallback', 'completing employee signup with invite token');
              try {
                const { error: rpcError } = await supabase.rpc('complete_employee_signup', { p_invite_token: pendingEmployeeToken.trim() });
                ss?.removeItem('pending_employee_invite_token');
                if (rpcError) authLog('AuthCallback', 'complete_employee_signup error', { message: rpcError.message });
              } catch (e) {
                ss?.removeItem('pending_employee_invite_token');
                authLog('AuthCallback', 'complete_employee_signup threw', e);
              }
            } else if (pendingBusinessName?.trim()) {
              authLog('AuthCallback', 'completing manager signup with business name');
              try {
                const { error: rpcError } = await supabase.rpc('complete_manager_signup', { p_business_name: pendingBusinessName.trim() });
                ss?.removeItem('pending_manager_business_name');
                if (rpcError) authLog('AuthCallback', 'complete_manager_signup error', { message: rpcError.message });
              } catch (e) {
                ss?.removeItem('pending_manager_business_name');
                authLog('AuthCallback', 'complete_manager_signup threw', e);
              }
            } else {
              ss?.removeItem('pending_signup_role');
            }
            const destination = await getRedirectForAuthenticatedUser();
            if (cancelled) return;
            authLog('AuthCallback', 'getRedirectForAuthenticatedUser returned', { destination });
            authLog('AuthCallback', 'exchange ok, navigating', { destination });
            // #region agent log
            debugIngest({ location: 'AuthCallback.tsx:run', message: 'OAuth code path: navigating', data: { destination, hasCode: true }, hypothesisId: 'H12,H13' });
            // #endregion
            if (destination === '/login') {
              authLog('AuthCallback', 'WARN: redirecting to /login after success – user may see login again (possible loop)', { destination });
            }
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_CALLBACK_RAN_KEY, '1');
            try {
              navigate(destination, { replace: true });
            } catch {
              window.location.replace(destination);
            }
            return;
          }
        }

        // No code in URL (e.g. email confirmation or direct visit). Rely on existing session.
        authLog('AuthCallback', 'no code, checking getSession');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError) {
          authLog('AuthCallback', 'getSession error', { message: sessionError.message });
          setError(sessionError.message || 'Could not complete sign-in.');
          setLoading(false);
          return;
        }
        if (session?.user) {
          const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
          const pendingEmployeeToken = ss?.getItem('pending_employee_invite_token');
          const pendingBusinessName = ss?.getItem('pending_manager_business_name');

          if (pendingEmployeeToken?.trim()) {
            authLog('AuthCallback', 'completing employee signup with invite token (existing session)');
            try {
              const { error: rpcError } = await supabase.rpc('complete_employee_signup', { p_invite_token: pendingEmployeeToken.trim() });
              ss?.removeItem('pending_employee_invite_token');
              if (rpcError) authLog('AuthCallback', 'complete_employee_signup error', { message: rpcError.message });
            } catch (e) {
              ss?.removeItem('pending_employee_invite_token');
              authLog('AuthCallback', 'complete_employee_signup threw', e);
            }
          } else if (pendingBusinessName?.trim()) {
            authLog('AuthCallback', 'completing manager signup with business name (existing session)');
            try {
              const { error: rpcError } = await supabase.rpc('complete_manager_signup', { p_business_name: pendingBusinessName.trim() });
              ss?.removeItem('pending_manager_business_name');
              if (rpcError) authLog('AuthCallback', 'complete_manager_signup error', { message: rpcError.message });
            } catch (e) {
              ss?.removeItem('pending_manager_business_name');
              authLog('AuthCallback', 'complete_manager_signup threw', e);
            }
          } else {
            ss?.removeItem('pending_signup_role');
          }
          const destination = await getRedirectForAuthenticatedUser();
          if (cancelled) return;
          authLog('AuthCallback', 'getRedirectForAuthenticatedUser returned (no code)', { destination });
          authLog('AuthCallback', 'session ok, navigating', { destination });
          // #region agent log
          debugIngest({ location: 'AuthCallback.tsx:run', message: 'no code path: navigating', data: { destination, hasCode: false }, hypothesisId: 'H12,H13' });
          // #endregion
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_CALLBACK_RAN_KEY, '1');
          try {
            navigate(destination, { replace: true });
          } catch {
            window.location.replace(destination);
          }
          return;
        }

        authLog('AuthCallback', 'no session, showing error');
        setError(
          'No session after sign-in. If you used a different tab or cleared site data, try signing in again from the login page in the same browser tab.'
        );
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        authLog('AuthCallback', 'catch', err);
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setError(message);
        setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  const handleCopyLog = () => {
    const text = getAuthLogsAsText();
    navigator.clipboard.writeText(text || 'No auth log entries.');
  };

  const debugLogPanel = (import.meta.env.DEV || error) && (
    <Card className="w-full max-w-2xl mt-4">
      <button
        type="button"
        onClick={() => setShowLog((s) => !s)}
        className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-t-lg"
      >
        Auth debug log (capture to see what happened)
        {showLog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {showLog && (
        <CardContent className="pt-0">
          <pre className="text-xs bg-muted p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap break-all">
            {getAuthLogsAsText() || 'No entries yet.'}
          </pre>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleCopyLog}>
            <Copy className="h-4 w-4 mr-2" />
            Copy log
          </Button>
        </CardContent>
      )}
    </Card>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl flex flex-col items-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-xl">Sign-in issue</CardTitle>
              <CardDescription className="text-left">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Do not clear site data or cookies while signing in with Google or Microsoft. Use the same browser tab where you started sign-in.
              </p>
              <Link to="/login">
                <Button className="w-full">Back to login</Button>
              </Link>
            </CardContent>
          </Card>
          {debugLogPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Signing you in…</p>
        </CardContent>
      </Card>
      {debugLogPanel}
    </div>
  );
}
