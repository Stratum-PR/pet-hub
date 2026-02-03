import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  performClientSignup,
  performManagerSignup,
  performEmployeeSignup,
  performOAuthLogin,
} from '@/lib/authService';
import { setDemoMode } from '@/lib/authRouting';
import { authLog } from '@/lib/authDebugLog';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Building2, User, Briefcase, ArrowLeft } from 'lucide-react';

export type SignupType = 'manager' | 'client' | 'employee';

export function Signup() {
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('invite')?.trim() || null;
  const reasonNoAccount = searchParams.get('reason') === 'no-account';

  const [step, setStep] = useState<1 | 2>(1);
  const [signupType, setSignupType] = useState<SignupType | null>(null);
  /** For manager only: 'business' = ask business name first, 'credentials' = then email/password */
  const [managerStep, setManagerStep] = useState<'business' | 'credentials'>('business');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  const [employeeInviteValid, setEmployeeInviteValid] = useState<boolean | null>(null);
  const [employeeInviteBusinessName, setEmployeeInviteBusinessName] = useState<string | null>(null);

  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    authLog('Signup', 'page mounted', {
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      inviteToken: !!inviteTokenFromUrl,
    });
  }, [inviteTokenFromUrl]);

  useEffect(() => {
    if (reasonNoAccount) {
      toast.info('There isn\'t an account tied to these credentials. Please create an account below.');
    }
  }, [reasonNoAccount]);

  useEffect(() => {
    if (signupType !== 'employee' || !inviteTokenFromUrl) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_employee_invite_info', {
        p_token: inviteTokenFromUrl,
      });
      if (cancelled) return;
      if (error) {
        setEmployeeInviteValid(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setEmployeeInviteValid(!!row?.valid);
      setEmployeeInviteBusinessName(row?.business_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [signupType, inviteTokenFromUrl]);

  const handleChooseType = (type: SignupType) => {
    if (type === 'employee' && !inviteTokenFromUrl) {
      toast.error(t('signup.employeeNeedInvite'));
      return;
    }
    setSignupType(type);
    setStep(2);
  };

  const handleBack = () => {
    if (signupType === 'manager' && managerStep === 'credentials') {
      setManagerStep('business');
      return;
    }
    setStep(1);
    setSignupType(null);
    setManagerStep('business');
    setEmployeeInviteValid(null);
    setEmployeeInviteBusinessName(null);
  };

  const handleManagerBusinessContinue = () => {
    const trimmed = businessName.trim();
    if (!trimmed) {
      toast.error(t('signupManager.businessNameRequired'));
      return;
    }
    setManagerStep('credentials');
  };

  const handleOAuthSignup = async (provider: 'google' | 'azure') => {
    setLoading(true);
    setDemoMode(false);
    const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    try {
      if (signupType === 'manager') {
        const trimmed = businessName.trim();
        if (!trimmed) {
          toast.error(t('signupManager.businessNameRequired'));
          setLoading(false);
          return;
        }
        ss?.setItem('pending_manager_business_name', trimmed);
      } else if (signupType === 'client') {
        ss?.setItem('pending_signup_role', 'client');
      } else if (signupType === 'employee' && inviteTokenFromUrl) {
        ss?.setItem('pending_employee_invite_token', inviteTokenFromUrl);
      }

      const { data, error } = await performOAuthLogin(supabase, provider);
      if (error) {
        toast.error(error.message || `Sign in with ${provider} failed.`);
        ss?.removeItem('pending_manager_business_name');
        ss?.removeItem('pending_signup_role');
        ss?.removeItem('pending_employee_invite_token');
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Could not start sign-in.');
        ss?.removeItem('pending_manager_business_name');
        ss?.removeItem('pending_signup_role');
        ss?.removeItem('pending_employee_invite_token');
        setLoading(false);
      }
    } catch (err: unknown) {
      console.error('[Signup] OAuth error', err);
      toast.error('Sign-in failed.');
      ss?.removeItem('pending_manager_business_name');
      ss?.removeItem('pending_signup_role');
      ss?.removeItem('pending_employee_invite_token');
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupType) return;

    setLoading(true);
    setDemoMode(false);
    try {
      let result;
      if (signupType === 'manager') {
        const trimmed = businessName.trim();
        if (!trimmed) {
          toast.error(t('signupManager.businessNameRequired'));
          setLoading(false);
          return;
        }
        result = await performManagerSignup(supabase, email, password, trimmed);
      } else if (signupType === 'client') {
        result = await performClientSignup(supabase, email, password);
      } else if (signupType === 'employee' && inviteTokenFromUrl) {
        result = await performEmployeeSignup(supabase, email, password, inviteTokenFromUrl);
      } else {
        toast.error(t('signup.employeeNeedInvite'));
        setLoading(false);
        return;
      }

      if (result.error) {
        toast.error(result.error.message || 'Sign up failed.');
        setLoading(false);
        return;
      }
      if (result.data?.user && !result.data.user.identities?.length) {
        toast.error('An account with this email already exists. Try signing in.');
        setLoading(false);
        return;
      }
      toast.success(
        signupType === 'manager'
          ? t('signupManager.creatingSuccess')
          : 'Check your email to confirm your account.'
      );
      navigate('/signup/success', { replace: true });
    } catch (err: unknown) {
      console.error('[Signup] error', err);
      toast.error(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
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
              <CardTitle className="text-2xl">{t('signup.chooseTypeTitle')}</CardTitle>
              <CardDescription>{t('signup.chooseTypeSubtitle')}</CardDescription>
              {reasonNoAccount && (
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-2 rounded-md bg-amber-50 dark:bg-amber-950/50 px-3 py-2">
                  There isn&apos;t an account tied to these credentials. Please create an account below.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 flex items-center gap-3 justify-start"
                onClick={() => handleChooseType('manager')}
              >
                <Building2 className="h-5 w-5 shrink-0" />
                <span>{t('signup.typeBusinessOwner')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 flex items-center gap-3 justify-start"
                onClick={() => handleChooseType('client')}
              >
                <User className="h-5 w-5 shrink-0" />
                <span>{t('signup.typeClient')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 flex items-center gap-3 justify-start"
                onClick={() => handleChooseType('employee')}
              >
                <Briefcase className="h-5 w-5 shrink-0" />
                <span>{t('signup.typeEmployee')}</span>
              </Button>
              {!inviteTokenFromUrl && (
                <p className="text-xs text-muted-foreground mt-2">{t('signup.employeeInviteHint')}</p>
              )}
              <div className="mt-6 text-center text-sm">
                <p className="text-muted-foreground">
                  {t('signup.hasAccount')}{' '}
                  <Link to="/login" className="text-primary hover:underline">
                    {t('signup.signIn')}
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

  if (step === 2 && signupType === 'employee' && !inviteTokenFromUrl) {
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
              <CardTitle className="text-xl">{t('signup.employeeNeedInvite')}</CardTitle>
              <CardDescription>{t('signup.employeeNeedInviteDetail')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('signup.back')}
              </Button>
              <div className="mt-6 text-center text-sm">
                <p className="text-muted-foreground">
                  {t('signup.hasAccount')}{' '}
                  <Link to="/login" className="text-primary hover:underline">
                    {t('signup.signIn')}
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

  if (step === 2 && signupType === 'employee' && inviteTokenFromUrl && employeeInviteValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t('signup.inviteInvalid')}</CardTitle>
              <CardDescription>{t('signup.inviteInvalidDetail')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('signup.back')}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const showEmployeeForm = signupType === 'employee' && inviteTokenFromUrl && employeeInviteValid === true;
  const employeeValidating = signupType === 'employee' && inviteTokenFromUrl && employeeInviteValid === null;

  const isManagerBusinessStep = signupType === 'manager' && step === 2 && managerStep === 'business';
  const isManagerCredentialsStep = signupType === 'manager' && step === 2 && managerStep === 'credentials';

  if (isManagerBusinessStep) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CardHeader className="text-center">
              <div
                className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
                onClick={() => navigate('/')}
              >
                <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
              </div>
              <CardTitle className="text-2xl">{t('signupManager.whatsYourBusinessName')}</CardTitle>
              <CardDescription>{t('signupManager.enterBusinessNameFirst')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manager-signup-business-only">{t('signupManager.businessName')}</Label>
                <Input
                  id="manager-signup-business-only"
                  type="text"
                  placeholder="My Grooming Salon"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManagerBusinessContinue()}
                  autoComplete="organization"
                  className="text-lg"
                />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleManagerBusinessContinue}
                disabled={!businessName.trim()}
              >
                {t('signup.continue')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('signup.back')}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (employeeValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              <p className="text-muted-foreground">{t('signup.validatingInvite')}</p>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${isManagerCredentialsStep ? 'animate-in fade-in slide-in-from-right-4 duration-300' : ''}`}>
          <CardHeader className="text-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('signup.back')}
            </Button>
            <div
              className="flex justify-center mb-4 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
              onClick={() => navigate('/')}
            >
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="h-12" />
            </div>
            <CardTitle className="text-2xl">
              {signupType === 'manager' && t('signup.createAccount')}
              {signupType === 'client' && t('signup.title')}
              {signupType === 'employee' && t('signup.employeeSignupTitle')}
            </CardTitle>
            <CardDescription>
              {signupType === 'manager' && t('signupManager.enterEmailPassword')}
              {signupType === 'client' && t('signup.subtitle')}
              {signupType === 'employee' &&
                (employeeInviteBusinessName
                  ? t('signup.employeeJoiningBusiness').replace('{name}', employeeInviteBusinessName)
                  : t('signup.employeeSignupSubtitle'))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              {signupType === 'manager' && managerStep === 'credentials' && (
                <p className="text-sm text-muted-foreground rounded-md bg-muted/50 p-2">
                  {t('signupManager.businessName')}: <strong>{businessName.trim() || '—'}</strong>
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t('login.email')}</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t('login.password')}</Label>
                <Input
                  id="signup-password"
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
                {loading
                  ? t('signup.creating')
                  : signupType === 'manager'
                    ? t('signupManager.createBusiness')
                    : t('signup.createAccount')}
              </Button>
            </form>

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
                disabled={loading || (signupType === 'employee' && !showEmployeeForm)}
                onClick={() => handleOAuthSignup('google')}
              >
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading || (signupType === 'employee' && !showEmployeeForm)}
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
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
