import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, setAuthContext, setBusinessSlugForSession, AUTH_CONTEXTS, setDemoMode, clearAuthContext } from '@/lib/authRouting';
import type { Business } from '@/lib/auth';
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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<'success' | 'too_many' | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading: authLoading, refreshAuth } = useAuth();
  const { language } = useLanguage(); // Force re-render on language change

  const getRedirectForAuthenticatedUser = async (): Promise<string> => {
    // Always determine role from the database profile, never from client-side guesses.
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return '/login';

    const authUser = userRes.user;
    const { data: profile, error: profileErr } = await supabase
      .from('profiles' as any)
      .select('is_super_admin,business_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr) {
      if (import.meta.env.DEV) console.error('[Login] profile lookup error:', profileErr);
      return '/login';
    }

    const isSuperAdmin = !!profile?.is_super_admin;
    if (isSuperAdmin) {
      setAuthContext(AUTH_CONTEXTS.ADMIN);
      return '/admin';
    }

    setAuthContext(AUTH_CONTEXTS.BUSINESS);
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
    if (!profile?.business_id) {
      return '/cliente';
    }
    return getDefaultRoute({ isAdmin: false, business });
  };

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
          setTimeout(() => resolve({ data: null, error: new Error('signInWithPassword timeout') }), 15000)
        );
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (!error) {
          return true;
        }
        if (import.meta.env.DEV) console.warn('[Login] signInWithPassword failed, falling back to REST:', error);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[Login] signInWithPassword threw, falling back to REST:', err);
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
        if (import.meta.env.DEV) console.error('[Login] REST auth error', response.status, errorBody);
        const message =
          errorBody?.error_description ||
          errorBody?.msg ||
          errorBody?.message ||
          `Login failed with status ${response.status}`;
        toast.error(message);
        return false;
      }

      const json = await response.json();
      if (import.meta.env.DEV) console.log('[Login] REST auth success');

      const { access_token, refresh_token, user } = json;

      if (!access_token || !refresh_token || !user) {
        toast.error('Supabase did not return a valid session.');
        return false;
      }

      // Tell supabase-js about this session so the rest of the app uses it.
      // Persist it; if we can't confirm persistence, do NOT navigate (otherwise refresh will break).
      const setSessionPromise = supabase.auth.setSession({ access_token, refresh_token });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('setSession timeout') }), 20000)
      );
      const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
      if (error) {
        if (import.meta.env.DEV) console.warn('[Login] setSession did not confirm in time:', error);
        toast.error('No se pudo persistir la sesión. Intenta de nuevo.');
        return false;
      }
      if (import.meta.env.DEV) console.log('[Login] setSession success');
      
      // Wait a moment for Supabase to fully persist the session before redirect
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[Login] passwordLogin unexpected error', err);
      toast.error(t('login.errorGeneric') || 'Something went wrong. Please try again.');
      return false;
    }
  };

  // IMPORTANT: Do NOT auto-redirect from /login based on existing session.
  // This page should ONLY navigate after an explicit login or demo action,
  // so clicking "Login" on the landing page never "auto-logs" anyone in.

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      if (import.meta.env.DEV) console.log('[Login] demo start');
      // Limpia cualquier contexto previo y activa modo demo
      clearAuthContext();
      setDemoMode(true);
      toast.success('Bienvenido al demo de Pet Hub');
      navigate('/demo/dashboard', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rate-limited-reset-password', {
        body: { email: forgotEmail.trim().toLowerCase() },
      });
      const isTooMany =
        (data as { error?: string })?.error === 'too_many_requests' ||
        (data as { error?: string })?.error?.includes('Too many');
      if (error && (error as { status?: number }).status === 429) {
        setForgotMessage('too_many');
        setForgotLoading(false);
        return;
      }
      if (isTooMany) {
        setForgotMessage('too_many');
        setForgotLoading(false);
        return;
      }
      if (error) throw error;
      const err = (data as { error?: string })?.error;
      const msg = (data as { message?: string })?.message;
      if (err) {
        toast.error(err);
        setForgotLoading(false);
        return;
      }
      setForgotMessage('success');
      if (msg) toast.success(msg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('429') || message.includes('too many')) {
        setForgotMessage('too_many');
      } else {
        toast.error(message || 'Failed to send reset email');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        if (import.meta.env.DEV) console.log('[Login] handleLogin start');

      // Normal login should NEVER inherit demo flags
      setDemoMode(false);

      const ok = await passwordLogin(email, password);
      if (ok) {
        // Ensure AuthContext and cached profile/business hydrate before deciding where to go.
        await refreshAuth();
        toast.success('Signed in successfully');
        const destination = await getRedirectForAuthenticatedUser();
        if (import.meta.env.DEV) console.log('[Login] Redirecting to', destination);
        navigate(destination, { replace: true });
      }
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('[Login] Unexpected error:', error);
      toast.error(t('login.errorGeneric') || 'Something went wrong. Please try again.');
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
              <img src="/pet-hub-logo.svg" alt="Pet Hub" className="h-12" />
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
                  <Dialog open={forgotOpen} onOpenChange={(open) => { setForgotOpen(open); setForgotMessage(null); setForgotEmail(''); }}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-sm text-primary hover:underline">
                        {t('login.forgotPassword')}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('login.resetPasswordTitle')}</DialogTitle>
                        <DialogDescription>{t('login.resetPasswordHint')}</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleForgotPassword} className="space-y-4 mt-2">
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          autoComplete="email"
                        />
                        {forgotMessage === 'too_many' && (
                          <p className="text-sm text-destructive">{t('login.resetPasswordTooMany')}</p>
                        )}
                        {forgotMessage === 'success' && (
                          <p className="text-sm text-green-600 dark:text-green-400">{t('login.resetPasswordSuccess')}</p>
                        )}
                        <Button type="submit" disabled={forgotLoading} className="w-full">
                          {forgotLoading ? t('login.signingIn') : t('login.resetPasswordTitle')}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
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
                <Link to="/pricing" className="text-primary hover:underline">
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
