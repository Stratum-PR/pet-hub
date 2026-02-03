import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getRedirectForAuthenticatedUser } from '@/lib/authRedirect';
import { performOAuthLogin } from '@/lib/authService';
import { debugIngest } from '@/lib/debugIngest';
import { setDemoMode, clearAuthContext } from '@/lib/authRouting';
import { authLog } from '@/lib/authDebugLog';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { language } = useLanguage(); // Force re-render on language change

  /**
   * Low-level password login that talks directly to the Supabase REST auth endpoint.
   * This avoids any hanging behaviour in supabase-js and gives us full control.
   */
  const passwordLogin = async (loginEmail: string, loginPassword: string) => {
    try {
      if (!SUPABASE_URL || ! SUPABASE_KEY) {
        toast.error('Supabase environment variables are missing.');
        return false;
      }

      // Prefer supabase-js first (best compatibility with storage/persistence).
      // If it hangs in this environment, fall back to REST token.
      try {
        const signInPromise = supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });
        const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('signInWithPassword timeout') }), 4000)
        );
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (!error) {
          console.log('[Login] signInWithPassword success', data);
          return true;
        }
        console.warn('[Login] signInWithPassword failed/timeout, falling back to REST:', error);
      } catch (err) {
        console.warn('[Login] signInWithPassword threw, falling back to REST:', err);
      }

      const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        console.error('[Login] REST auth error', { status: response.status, errorBody });
        const message =
          errorBody?.error_description ||
          errorBody?.msg ||
          errorBody?.message ||
          `Login failed with status ${response.status}`;
        toast.error(message);
        return false;
      }

      const json = await response.json();
      console.log('[Login] REST auth success', json);

      const { access_token, refresh_token, user } = json;

      if (!access_token || !refresh_token || !user) {
        toast.error('Supabase did not return a valid session.');
        return false;
      }

      // Tell supabase-js about this session so the rest of the app uses it.
      // Try to persist it, but don't block login if this takes too long in some environments.
      const setSessionPromise = supabase.auth.setSession({ access_token, refresh_token });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('setSession timeout') }), 5000)
      );
      const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
      if (error) {
        console.warn('[Login] setSession did not confirm in time; continuing anyway:', error);
        await new Promise(resolve => setTimeout(resolve, 200));
        return true;
      }
      console.log('[Login] setSession success', data);
      // Brief pause so storage can persist before redirect (was 1s; 150ms is enough)
      await new Promise(resolve => setTimeout(resolve, 150));
      return true;
    } catch (err: any) {
      console.error('[Login] passwordLogin unexpected error', err);
      toast.error(err?.message || 'Unexpected error during login.');
      return false;
    }
  };

  // IMPORTANT: Do NOT auto-redirect from /login based on existing session.
  // This page should ONLY navigate after an explicit login or demo action,
  // so clicking "Login" on the landing page never "auto-logs" anyone in.

  useEffect(() => {
    authLog('Login', 'page mounted', { path: location.pathname });
  }, []);

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    setLoading(true);
    setDemoMode(false);
    try {
      const { data, error } = await performOAuthLogin(supabase, provider);
      if (error) {
        toast.error(error.message || `Sign in with ${provider} failed.`);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not start sign-in.');
      }
    } catch (err: unknown) {
      console.error('[Login] OAuth error:', err);
      toast.error('Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      console.log('[Login] demo start (no-auth mode)');
      // Limpia cualquier contexto previo y activa modo demo
      clearAuthContext();
      setDemoMode(true);
      toast.success('Bienvenido al demo de Stratum Hub');
      navigate('/demo/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('[Login] handleLogin start', { email });

      // Normal login should NEVER inherit demo flags
      setDemoMode(false);

      const ok = await passwordLogin(email, password);
      if (ok) {
        toast.success('Signed in successfully');
        const destination = await getRedirectForAuthenticatedUser();
        authLog('Login', 'redirect after sign-in', { destination });
        // #region agent log
        debugIngest({ location: 'Login.tsx:handleLogin', message: 'redirect after password sign-in', data: { destination }, hypothesisId: 'H12,H13' });
        // #endregion
        try {
          navigate(destination, { replace: true });
        } catch (navErr) {
          authLog('Login', 'navigate threw, using window.location.replace', { destination, error: (navErr as Error)?.message });
          window.location.replace(destination);
        }
      }
    } catch (error: any) {
      console.error('[Login] Unexpected error:', error);
      toast.error(error.message || 'Unexpected error during sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => navigate('/')}
            >
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
            </div>
          <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.subtitle')}</CardDescription>
        </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('login.signingIn') : t('login.signIn')}
              </Button>
            </form>

            {/* OAuth: Google & Microsoft */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => handleOAuthLogin('google')}
              >
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => handleOAuthLogin('azure')}
              >
                Microsoft
              </Button>
            </div>

            {/* Demo Button */}
            <div className="mt-6">
              <div className="text-center text-sm text-muted-foreground mb-3">
                {t('login.demoPrompt')}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                {t('login.viewDemo')}
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                {t('login.noAccount')}{' '}
                <Link to="/signup" className="text-primary hover:underline">
                  {t('login.startTrial')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
