import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Calendar, Users, DollarSign, ArrowRight, Check } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, getLastRoute } from '@/lib/authRouting';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function Landing() {
  const navigate = useNavigate();
  const { user, isAdmin, business, loading } = useAuth();
  const { language } = useLanguage(); // Force re-render on language change

  // Logged-in users should never stay on landing page
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const last = getLastRoute();
    if (last && last !== '/' && last !== '/login') {
      navigate(last, { replace: true });
      return;
    }

    navigate(getDefaultRoute({ isAdmin, business }), { replace: true });
  }, [loading, user, isAdmin, business, navigate]);

  const handleLogoClick = async () => {
    if (loading) return;

    // Not logged in → go to public home
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    // Logged in → send to appropriate dashboard using central routing helper
    const target = getDefaultRoute({ isAdmin, business });
    navigate(target, { replace: true });
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
            src="/pet-hub-logo.svg"
            alt="Pet Hub - Ir al inicio"
            className="h-8 sm:h-10 cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
          />
          <span className="hidden sm:inline text-lg sm:text-xl font-semibold">Pet Hub</span>
        </button>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <Link to="/login" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full sm:w-auto text-sm sm:text-base">{t('landing.login')}</Button>
          </Link>
          <Link to="/registrarse" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto text-sm sm:text-base">{t('landing.getStarted')}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
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
          <Link to="/registrarse" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
              {t('landing.startFreeTrial')}
              <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </Link>
          <Link to="/demo/dashboard" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
              {t('landing.viewDemo')}
            </Button>
          </Link>
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
