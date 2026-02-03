import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { AccountMenu } from '@/components/AccountMenu';
import { Calendar, Users, DollarSign, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, getLastRoute } from '@/lib/authRouting';
import { getRedirectForAuthenticatedUser } from '@/lib/authRedirect';
import { authLog } from '@/lib/authDebugLog';
import { debugIngest } from '@/lib/debugIngest';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Landing() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, business, loading } = useAuth();
  const { language } = useLanguage(); // Force re-render on language change
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Logged-in users must NEVER see the marketing landing. Resolve destination and redirect declaratively.
  useEffect(() => {
    if (loading || !user) return;

    authLog('Landing', 'redirect effect running', { loading, hasUser: !!user });
    let cancelled = false;
    (async () => {
      try {
        const last = getLastRoute();
        authLog('Landing', 'last route check', { last });
        if (last && last !== '/' && last !== '/login' && !last.startsWith('/signup')) {
          authLog('Landing', 'redirect (last route)', { destination: last });
          // #region agent log
          debugIngest({ location: 'Landing.tsx:effect', message: 'setRedirectTo last route', data: { destination: last }, hypothesisId: 'H7,H14' });
          // #endregion
          if (!cancelled) setRedirectTo(last);
          return;
        }

        authLog('Landing', 'calling getRedirectForAuthenticatedUser');
        const destination = await getRedirectForAuthenticatedUser();
        if (cancelled) return;
        authLog('Landing', 'getRedirectForAuthenticatedUser returned', { destination });
        // Always redirect when logged in (clients go to /client, never stay on /)
        authLog('Landing', 'redirect (authenticated)', { destination });
        // #region agent log
        debugIngest({ location: 'Landing.tsx:effect', message: 'setRedirectTo authenticated', data: { destination }, hypothesisId: 'H7,H12,H14' });
        // #endregion
        setRedirectTo(destination);
      } catch (err) {
        if (!cancelled) {
          console.error('[Landing] redirect error', err);
          authLog('Landing', 'redirect error', { error: (err as Error)?.message });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user]);

  // Logged-in users must NEVER see the marketing content. Redirect declaratively to avoid replace2 errors.
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }
  if (user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <p className="text-muted-foreground">{t('landing.redirecting')}</p>
      </div>
    );
  }

  const handleLogoClick = async () => {
    if (loading) return;

    // Not logged in → go to public home
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    // Logged in → send to workspace root: business slug dashboard
    const target = getDefaultRoute({ isAdmin, business });
    try {
      navigate(target, { replace: true });
    } catch {
      window.location.replace(target);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Floating Language Switcher */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Navigation */}
      <nav className="container mx-auto px-4 py-4 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-2 focus:outline-none"
        >
          <img
            src="/stratum hub logo.svg"
            alt="Stratum Hub - Ir al inicio"
            className="h-8 sm:h-10 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
          />
          <span className="hidden sm:inline text-lg sm:text-xl font-semibold">Stratum Hub</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          {user ? (
            <AccountMenu user={user} profile={profile} />
          ) : (
            <>
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto text-sm sm:text-base">{t('landing.login')}</Button>
              </Link>
              <Link to="/signup" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto text-sm sm:text-base">{t('landing.getStarted')}</Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section - only shown to unauthenticated users */}
      <section className="container mx-auto px-4 py-12 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6">
          {t('landing.title')}
          <br />
          <span className="text-primary">{t('landing.subtitle')}</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
          {t('landing.heroText')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto px-4 sm:px-0">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
              {t('landing.startFreeTrial')}
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
          {!user && (
            <Link to="/demo/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                {t('landing.viewDemo')}
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-12 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureSchedulingTitle')}</h3>
            <p className="text-muted-foreground">
              {t('landing.featureSchedulingText')}
            </p>
          </div>

          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureCustomersTitle')}</h3>
            <p className="text-muted-foreground">
              {t('landing.featureCustomersText')}
            </p>
          </div>

          <div className="bg-card p-8 rounded-lg shadow-sm border">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('landing.featureRevenueTitle')}</h3>
            <p className="text-muted-foreground">
              {t('landing.featureRevenueText')}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="container mx-auto px-4 py-12 sm:py-20 text-center">
        <div className="bg-card p-6 sm:p-12 rounded-lg shadow-sm border max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{t('landing.readyTitle')}</h2>
          <p className="text-muted-foreground mb-6 sm:mb-8 text-base sm:text-lg px-2">
            {t('landing.readyText')}
          </p>
          <Link to="/pricing" className="inline-block w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
              {t('landing.viewPricingPlans')}
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
