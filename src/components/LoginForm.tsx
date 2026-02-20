import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  getDefaultRoute,
  setAuthContext,
  setBusinessSlugForSession,
  AUTH_CONTEXTS,
  setDemoMode,
  clearAuthContext,
} from '@/lib/authRouting';
import type { Business } from '@/lib/auth';
import { t } from '@/lib/translations';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface LoginFormProps {
  onLoginSuccess: (destination: string) => void;
  onClose?: () => void;
}

export function LoginForm({ onLoginSuccess, onClose }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<'success' | 'too_many' | null>(null);
  const { refreshAuth } = useAuth();

  const getRedirectForAuthenticatedUser = async (): Promise<string> => {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return '/login';
    const authUser = userRes.user;
    const { data: profile, error: profileErr } = await supabase
      .from('profiles' as any)
      .select('is_super_admin,business_id')
      .eq('id', authUser.id)
      .maybeSingle();
    if (profileErr) return '/login';
    const isSuperAdmin = !!profile?.is_super_admin;
    if (isSuperAdmin) {
      setAuthContext(AUTH_CONTEXTS.ADMIN);
      return '/admin';
    }
    setAuthContext(AUTH_CONTEXTS.BUSINESS);
    let business: Business | null = null;
    if (profile?.business_id) {
      const { data: biz } = await supabase.from('businesses').select('*').eq('id', profile.business_id).single();
      if (biz) {
        business = biz as Business;
        setBusinessSlugForSession(business);
      }
    }
    if (!profile?.business_id) return '/cliente';
    return getDefaultRoute({ isAdmin: false, business });
  };

  const passwordLogin = async (loginEmail: string, loginPassword: string) => {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        toast.error('Supabase environment variables are missing.');
        return false;
      }
      try {
        const signInPromise = supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
        const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('signInWithPassword timeout') }), 15000)
        );
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (!error) return true;
        if (import.meta.env.DEV) console.warn('[Login] signInWithPassword failed, falling back to REST:', error);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[Login] signInWithPassword threw, falling back to REST:', err);
      }
      const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message =
          errorBody?.error_description ||
          errorBody?.msg ||
          errorBody?.message ||
          `Login failed with status ${response.status}`;
        toast.error(message);
        return false;
      }
      const json = await response.json();
      const { access_token, refresh_token, user } = json;
      if (!access_token || !refresh_token || !user) {
        toast.error('Supabase did not return a valid session.');
        return false;
      }
      const setSessionPromise = supabase.auth.setSession({ access_token, refresh_token });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('setSession timeout') }), 20000)
      );
      const { error } = await Promise.race([setSessionPromise, timeoutPromise]);
      if (error) {
        toast.error('No se pudo persistir la sesión. Intenta de nuevo.');
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[Login] passwordLogin unexpected error', err);
      toast.error(t('login.errorGeneric') || 'Something went wrong. Please try again.');
      return false;
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      clearAuthContext();
      setDemoMode(true);
      toast.success('Bienvenido al demo de Pet Hub');
      onLoginSuccess('/demo/dashboard');
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
      if (message.includes('429') || message.includes('too many')) setForgotMessage('too_many');
      else toast.error(message || 'Failed to send reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setDemoMode(false);
      const ok = await passwordLogin(email, password);
      if (ok) {
        await refreshAuth();
        toast.success('Signed in successfully');
        const destination = await getRedirectForAuthenticatedUser();
        onLoginSuccess(destination);
      }
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('[Login] Unexpected error:', error);
      toast.error(t('login.errorGeneric') || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">{t('login.email')}</Label>
          <Input
            id="login-email"
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
            <Label htmlFor="login-password">{t('login.password')}</Label>
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
            id="login-password"
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

      <div className="mt-6">
        <div className="text-center text-sm text-muted-foreground mb-3">{t('login.demoPrompt')}</div>
        <Button type="button" variant="outline" className="w-full" onClick={handleDemoLogin} disabled={loading}>
          {t('login.viewDemo')}
        </Button>
      </div>

      <div className="mt-6 text-center text-sm">
        <p className="text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link to="/pricing" className="text-primary hover:underline" onClick={onClose}>
            {t('login.startTrial')}
          </Link>
        </p>
      </div>
    </>
  );
}
