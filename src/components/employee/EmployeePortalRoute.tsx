import { Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';
import { LogOut, Moon, Sun } from 'lucide-react';
import { PetAnimations } from '@/components/PetAnimations';
import { useSettings } from '@/hooks/useSupabaseData';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { getEmployeePostLoginPath } from '@/lib/employeePostLogin';

export function EmployeePortalRoute() {
  const { user, loading, role, business } = useAuth();
  const { settings } = useSettings();
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (loading) {
    return <PawStagedLoadingFullscreen label="Cargando" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'employee') {
    return <Navigate to="/" replace />;
  }

  const logoLight = settings.business_logo_url_light ?? settings.business_logo_url;
  const logoDark = settings.business_logo_url_dark ?? settings.business_logo_url_light ?? settings.business_logo_url;
  const isDark = resolvedTheme === 'dark';
  const logoToShow = isDark ? logoDark : logoLight;
  const rawName = settings.business_name?.trim() || '';
  const displayBusinessName =
    rawName && rawName.toLowerCase().includes('demo') ? 'Demo' : rawName || 'Pet Hub';
  const navbarLogoSize = Math.max(32, Math.min(96, parseInt(settings.navbar_logo_size_px || '72', 10) || 72));

  async function handleLogout() {
    try {
      setTheme('light');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('pet-hub-theme');
        localStorage.removeItem('pet-hub-theme-demo');
      }
      await signOut();
      toast.success(t('logout.success'));
      window.location.href = '/';
    } catch (err) {
      if (import.meta.env.DEV) console.error('Logout error:', err);
      toast.error('Error al cerrar sesión');
      window.location.href = '/';
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6 bg-transparent">
          <Link
            to={getEmployeePostLoginPath(business)}
            className="flex min-w-0 max-w-[min(100%,28rem)] items-center gap-3 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            {logoToShow ? (
              <img
                src={logoToShow}
                alt=""
                className="shrink-0 object-contain w-auto"
                style={{ height: navbarLogoSize, maxWidth: 140 }}
              />
            ) : (
              <img src="/pet-hub-logo.svg" alt="" className="h-10 w-auto shrink-0 object-contain" />
            )}
            <div className="min-w-0 text-left">
              <div
                className="truncate text-sm font-bold text-foreground"
                style={{ fontFamily: 'var(--font-telegraf)' }}
              >
                {displayBusinessName}
              </div>
              <div className="truncate text-xs text-muted-foreground">{t('employeePortal.subtitle')}</div>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 sm:hidden text-muted-foreground"
              aria-label={t('nav.darkMode')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-muted-foreground">{t('nav.darkMode')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={theme === 'dark'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn(
                  'relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  theme === 'dark' ? 'bg-primary' : 'bg-input'
                )}
              >
                <span
                  className={cn(
                    'absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-background shadow ring-0 transition-transform duration-200',
                    theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
                  )}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </span>
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logOut')}
            </Button>
          </div>
        </header>

        <main className="flex-1 w-full px-4 lg:px-6 py-6 overflow-x-hidden">
          <div className="mx-auto max-w-4xl">
            <Outlet />
          </div>
        </main>

        <footer className="border-t shrink-0 bg-muted/30">
          <div className="max-w-[320px] mx-auto px-4 py-4 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Powered by</span>
              <a
                href="https://stratumpr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center hover:opacity-90 transition-opacity shrink-0 rounded-sm"
              >
                <img
                  src={resolvedTheme === 'dark' ? '/Logo 2.svg' : '/Logo 4.svg'}
                  alt="STRATUM PR LLC"
                  className="block object-contain h-6 w-auto max-w-[100px] cursor-pointer"
                />
              </a>
            </div>
            <div className="text-[10px] text-muted-foreground">© 2025 STRATUM PR LLC</div>
          </div>
        </footer>
      </div>
      <PetAnimations />
    </>
  );
}
