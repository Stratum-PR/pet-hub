import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, setAuthContext, AUTH_CONTEXTS } from '@/lib/authRouting';
import { Footer } from '@/components/Footer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Building2, User } from 'lucide-react';

const PENDING_MANAGER_BUSINESS_NAME = 'pending_manager_business_name';
const PENDING_MANAGER_TIER = 'pending_manager_tier';

type SignupType = 'owner' | 'client';
type SubscriptionTier = 'starter' | 'basic' | 'pro' | 'enterprise';

const SUBSCRIPTION_TIERS: { tier: SubscriptionTier; nameKey: string; descKey: string; price?: number }[] = [
  { tier: 'starter', nameKey: 'register.planStarter', descKey: 'register.planStarterDesc' },
  { tier: 'basic', nameKey: 'register.planBasic', descKey: 'register.planBasicDesc', price: 29 },
  { tier: 'pro', nameKey: 'register.planPro', descKey: 'register.planProDesc', price: 79 },
  { tier: 'enterprise', nameKey: 'register.planEnterprise', descKey: 'register.planEnterpriseDesc', price: 199 },
];

export function Register() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [signupType, setSignupType] = useState<SignupType | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('starter');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupLogs, setSignupLogs] = useState<string[]>([]);
  const [showRetryAfterTimeout, setShowRetryAfterTimeout] = useState(false);

  const isOwner = signupType === 'owner';

  const addLog = (msg: string) => {
    const time = new Date().toISOString().slice(11, 23);
    setSignupLogs((prev) => [...prev, `${time} ${msg}`]);
    console.log('[Register]', msg);
  };

  const handleCompleteManagerSignup = async (name: string, tier: SubscriptionTier) => {
    const { error } = await supabase.rpc('complete_manager_signup', {
      p_business_name: name,
      p_subscription_tier: tier,
    });
    if (error) throw error;
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSignupLogs([]);
    addLog('Inicio registro (dueño)');
    try {
      localStorage.setItem(PENDING_MANAGER_BUSINESS_NAME, businessName);
      localStorage.setItem(PENDING_MANAGER_TIER, selectedTier);
      addLog('Datos guardados en localStorage');

      addLog('Llamando supabase.auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      const errorDetail = error
        ? [error.message, error.code, (error as { status?: number }).status].filter(Boolean).join(' ') || JSON.stringify(error)
        : '';
      addLog(
        `signUp devolvió: sesión=${!!data?.session}, usuario=${!!data?.user}` +
          (error ? `, error=${errorDetail}` : '')
      );

      if (error) {
        localStorage.removeItem(PENDING_MANAGER_BUSINESS_NAME);
        localStorage.removeItem(PENDING_MANAGER_TIER);
        addLog(`Error de signUp: ${errorDetail}`);
        const isTimeout =
          (error as { status?: number }).status === 504 ||
          error.message?.toLowerCase().includes('timeout') ||
          error.message?.toLowerCase().includes('deadline');
        const isEmailRateLimit =
          (error as { status?: number }).status === 429 ||
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('over_email_send_rate_limit');
        const isServiceUnavailable =
          (error as { status?: number }).status === 503 ||
          error.message?.toLowerCase().includes('service unavailable') ||
          error.message?.toLowerCase().includes('server closed');
        if (error.message?.toLowerCase().includes('already registered') || error.code === 'user_already_exists') {
          toast.error(t('register.errorEmailInUse'));
          setShowRetryAfterTimeout(false);
        } else if (isServiceUnavailable) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor no está disponible (503). Espera unos segundos y usa "Reintentar" o intenta de nuevo más tarde.'
          );
        } else if (isEmailRateLimit) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'Límite de envío de correos alcanzado. Desactiva "Confirmar email" en Supabase (Authentication → Email) o espera unos minutos y usa "Reintentar".'
          );
        } else if (isTimeout || !error.message) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor tardó demasiado (timeout). No se creó la cuenta. Usa "Reintentar" abajo o intenta de nuevo más tarde.'
          );
        } else {
          setShowRetryAfterTimeout(false);
          toast.error(t('register.errorGeneric'));
        }
        return;
      }
      setShowRetryAfterTimeout(false);

      if (data.session) {
        addLog('Sesión presente, esperando perfil...');
        await new Promise((r) => setTimeout(r, 500));
        addLog('Llamando complete_manager_signup...');
        await handleCompleteManagerSignup(businessName, selectedTier);
        addLog('complete_manager_signup listo');
        localStorage.removeItem(PENDING_MANAGER_BUSINESS_NAME);
        localStorage.removeItem(PENDING_MANAGER_TIER);
        addLog('Llamando refreshAuth...');
        await refreshAuth();
        addLog('refreshAuth listo');
        setAuthContext(AUTH_CONTEXTS.BUSINESS);
        const route = getDefaultRoute({ isAdmin: false, business: null });
        addLog(`Redirigiendo a ${route}`);
        navigate(route, { replace: true });
        toast.success('Cuenta creada. Bienvenido a Pet Hub.');
      } else {
        addLog('Sin sesión (confirmar email): mostrando pantalla "Revisa tu correo"');
        setEmailConfirmSent(true);
      }
    } catch (err: any) {
      addLog(`Excepción: ${err?.message || String(err)}`);
      toast.error(t('register.errorGeneric'));
    } finally {
      setLoading(false);
      addLog('Fin del flujo de registro');
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSignupLogs([]);
    addLog('Inicio registro (cliente)');
    try {
      addLog('Llamando supabase.auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      const clientErrorDetail = error
        ? [error.message, error.code, (error as { status?: number }).status].filter(Boolean).join(' ') || JSON.stringify(error)
        : '';
      addLog(
        `signUp devolvió: sesión=${!!data?.session}, usuario=${!!data?.user}` +
          (error ? `, error=${clientErrorDetail}` : '')
      );

      if (error) {
        addLog(`Error de signUp: ${clientErrorDetail}`);
        const isTimeout =
          (error as { status?: number }).status === 504 ||
          error.message?.toLowerCase().includes('timeout') ||
          error.message?.toLowerCase().includes('deadline');
        const isEmailRateLimit =
          (error as { status?: number }).status === 429 ||
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('over_email_send_rate_limit');
        const isServiceUnavailable =
          (error as { status?: number }).status === 503 ||
          error.message?.toLowerCase().includes('service unavailable') ||
          error.message?.toLowerCase().includes('server closed');
        if (error.message?.toLowerCase().includes('already registered') || error.code === 'user_already_exists') {
          toast.error(t('register.errorEmailInUse'));
          setShowRetryAfterTimeout(false);
        } else if (isServiceUnavailable) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor no está disponible (503). Espera unos segundos y usa "Reintentar" o intenta de nuevo más tarde.'
          );
        } else if (isEmailRateLimit) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'Límite de envío de correos alcanzado. Desactiva "Confirmar email" en Supabase (Authentication → Email) o espera unos minutos y usa "Reintentar".'
          );
        } else if (isTimeout || !error.message) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor tardó demasiado (timeout). No se creó la cuenta. Usa "Reintentar" abajo o intenta de nuevo más tarde.'
          );
        } else {
          setShowRetryAfterTimeout(false);
          toast.error(t('register.errorGeneric'));
        }
        return;
      }
      setShowRetryAfterTimeout(false);

      if (data.session) {
        addLog('Sesión presente, refreshAuth y redirigir a /cliente');
        await refreshAuth();
        navigate('/cliente', { replace: true });
        toast.success('Cuenta creada.');
      } else {
        addLog('Sin sesión (confirmar email)');
        setEmailConfirmSent(true);
      }
    } catch (err: any) {
      addLog(`Excepción: ${err?.message || String(err)}`);
      toast.error(t('register.errorGeneric'));
    } finally {
      setLoading(false);
      addLog('Fin del flujo de registro');
    }
  };

  if (emailConfirmSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>{t('register.checkEmail')}</CardTitle>
              <CardDescription>{t('register.checkEmailMessage')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login">
                <Button variant="outline" className="w-full">{t('register.signInHere')}</Button>
              </Link>
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
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="flex justify-center mb-4 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <img src="/pet-hub-logo.svg" alt="Pet Hub" className="h-12" />
            </div>
            <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
            <CardDescription>{t('register.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {signupType === null && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">{t('register.userTypeQuestion')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => setSignupType('owner')}
                  >
                    <Building2 className="w-8 h-8" />
                    <span>{t('register.businessOwner')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => setSignupType('client')}
                  >
                    <User className="w-8 h-8" />
                    <span>{t('register.client')}</span>
                  </Button>
                </div>
              </div>
            )}

            {signupType === 'client' && (
              <form onSubmit={handleClientSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-fullName">{t('register.fullName')}</Label>
                  <Input
                    id="client-fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email">{t('login.email')}</Label>
                  <Input
                    id="client-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-password">{t('login.password')}</Label>
                  <Input
                    id="client-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('register.creating') : t('register.createAccount')}
                </Button>
                {showRetryAfterTimeout && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full mt-2"
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault();
                      handleClientSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                    }}
                  >
                    Reintentar
                  </Button>
                )}
              </form>
            )}

            {isOwner && step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">{t('register.businessNameLabel')}</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t('register.businessNamePlaceholder')}
                    required
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={!businessName.trim()}
                >
                  {t('register.next')}
                </Button>
              </div>
            )}

            {isOwner && step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">{t('register.choosePlan')}</p>
                <div className="space-y-2">
                  {SUBSCRIPTION_TIERS.map(({ tier, nameKey, descKey, price }) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedTier === tier ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{t(nameKey)}</span>
                        {price != null ? (
                          <span className="text-muted-foreground">${price}/mes</span>
                        ) : (
                          <span className="text-primary font-medium">Gratis</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{t(descKey)}</p>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    {t('register.back')}
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => setStep(3)}>
                    {t('register.next')}
                  </Button>
                </div>
              </div>
            )}

            {isOwner && step === 3 && (
              <form onSubmit={handleOwnerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-fullName">{t('register.fullName')}</Label>
                  <Input
                    id="owner-fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-email">{t('login.email')}</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-password">{t('login.password')}</Label>
                  <Input
                    id="owner-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    {t('register.back')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? t('register.creating') : t('register.createAccount')}
                  </Button>
                </div>
                {showRetryAfterTimeout && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault();
                      handleOwnerSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                    }}
                  >
                    Reintentar
                  </Button>
                )}
              </form>
            )}

            {signupLogs.length > 0 && (
              <div className="mt-4 rounded-md border border-muted bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Log de registro</p>
                <pre className="text-xs font-mono overflow-auto max-h-32 whitespace-pre-wrap break-words">
                  {signupLogs.join('\n')}
                </pre>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline">
                {t('register.signInHere')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
