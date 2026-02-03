import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AccountMenu } from '@/components/AccountMenu';
import { Button } from '@/components/ui/button';
import { getDefaultRoute } from '@/lib/authRouting';
import { Navigate } from 'react-router-dom';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/**
 * Home for logged-in users with role "client" (no business).
 * Logged-in users should never see the marketing landing; they are sent here or to their dashboard.
 */
export function ClientHome() {
  const { user, profile, business, loading } = useAuth();
  useLanguage(); // for t() locale

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If they have a business, send to dashboard
  if (business?.name) {
    const destination = getDefaultRoute({ isAdmin: false, business });
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <AccountMenu user={user} profile={profile} />
      </div>

      <main className="container mx-auto px-4 py-16 sm:py-24 text-center max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t('clientHome.welcome')}
        </h1>
        <p className="text-muted-foreground mb-8">
          {t('clientHome.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/pricing">
            <Button variant="outline" className="w-full sm:w-auto">
              {t('clientHome.viewPricing')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
