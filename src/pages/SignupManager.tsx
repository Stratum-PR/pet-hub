import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { performManagerSignup, performOAuthLogin } from '@/lib/authService';
import { setDemoMode } from '@/lib/authRouting';
import { authLog } from '@/lib/authDebugLog';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function SignupManager() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    authLog('SignupManager', 'page mounted', { path: typeof window !== 'undefined' ? window.location.pathname : '' });
  }, []);

  const handleOAuthSignup = async (provider: 'google' | 'azure') => {
    const trimmed = businessName.trim();
    if (!trimmed) {
      toast.error('Business name is required before signing up with Google or Microsoft.');
      return;
    }
    setLoading(true);
    setDemoMode(false);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('pending_manager_business_name', trimmed);
      }
      const { data, error } = await performOAuthLogin(supabase, provider);
      if (error) {
        toast.error(error.message || `Sign in with ${provider} failed.`);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('pending_manager_business_name');
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not start sign-in.');
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('pending_manager_business_name');
      }
    } catch (err: unknown) {
      console.error('[SignupManager] OAuth error', err);
      toast.error('Sign-in failed.');
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('pending_manager_business_name');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = businessName.trim();
    if (!trimmed) {
      toast.error('Business name is required.');
      return;
    }
    setLoading(true);
    setDemoMode(false);
    try {
      const { data, error } = await performManagerSignup(supabase, email, password, trimmed);
      if (error) {
        toast.error(error.message || 'Sign up failed.');
        return;
      }
      if (data?.user && !data.user.identities?.length) {
        toast.error('An account with this email already exists. Try signing in.');
        return;
      }
      toast.success('Check your email to confirm your account. Then you can sign in and access your workspace.');
      navigate('/signup/success', { replace: true });
    } catch (err: unknown) {
      console.error('[SignupManager] error', err);
      toast.error(err instanceof Error ? err.message : 'Sign up failed.');
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
            <CardTitle className="text-2xl">{t('signupManager.title')}</CardTitle>
            <CardDescription>{t('signupManager.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manager-signup-business">{t('signupManager.businessName')}</Label>
                <Input
                  id="manager-signup-business"
                  type="text"
                  placeholder="My Grooming Salon"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-signup-email">{t('login.email')}</Label>
                <Input
                  id="manager-signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager-signup-password">{t('login.password')}</Label>
                <Input
                  id="manager-signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('signupManager.creating') : t('signupManager.createBusiness')}
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
                onClick={() => handleOAuthSignup('google')}
              >
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => handleOAuthSignup('azure')}
              >
                Microsoft
              </Button>
            </div>

            <div className="mt-6 text-center text-sm">
              <p className="text-muted-foreground">
                {t('signup.hasAccount')}{' '}
                <Link to="/login" className="text-primary hover:underline">
                  {t('signup.signIn')}
                </Link>
              </p>
              <p className="text-muted-foreground mt-2">
                <Link to="/signup" className="text-primary hover:underline">
                  Sign up without a business
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
