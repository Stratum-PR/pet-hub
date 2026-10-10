import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Building2, LayoutDashboard, LogOut, Menu, Moon, SlidersHorizontal, Sun, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';
import { signOut } from '@/lib/auth';
import { AUTH_CONTEXTS, getBusinessDashboardPath, setAuthContext, setBusinessSlugForSession } from '@/lib/authRouting';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin', end: true, labelKey: 'admin.nav.overview', icon: LayoutDashboard },
  { to: '/admin/businesses', end: false, labelKey: 'admin.nav.businesses', icon: Building2 },
  { to: '/admin/automations', end: false, labelKey: 'admin.nav.automations', icon: Zap },
  { to: '/admin/features', end: false, labelKey: 'admin.nav.features', icon: SlidersHorizontal },
] as const;

/** Super-admin portal shell: same floating sidebar look as the business app, with the page on the right. */
export function AdminLayout() {
  useLanguage(); // re-render labels on language toggle
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, business: myBusiness } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = NAV.find((n) => (n.end ? location.pathname === n.to || location.pathname === `${n.to}/` : location.pathname.startsWith(n.to))) ?? NAV[0];

  const myBusinessPath = useMemo(() => {
    if (!profile?.business_id || !myBusiness) return null;
    return getBusinessDashboardPath(myBusiness);
  }, [profile?.business_id, myBusiness]);

  const goToMyBusiness = () => {
    if (!myBusinessPath || !myBusiness) return;
    setAuthContext(AUTH_CONTEXTS.BUSINESS);
    setBusinessSlugForSession(myBusiness);
    navigate(myBusinessPath);
  };

  const logout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      devConsole.error('Logout error:', error);
    }
  };

  const sidebar = (
    <SidebarBody
      onNavigate={() => setMobileOpen(false)}
      onMyBusiness={myBusinessPath ? goToMyBusiness : null}
      onLogout={logout}
    />
  );

  return (
    <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
      <aside className="hidden shrink-0 py-4 pl-5 lg:flex">{sidebar}</aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{t('admin.title')}</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 px-4 py-4 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t('admin.nav.openMenu')}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">{t(current.labelKey)}</h1>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarBody({
  onNavigate,
  onMyBusiness,
  onLogout,
}: {
  onNavigate: () => void;
  onMyBusiness: (() => void) | null;
  onLogout: () => void;
}) {
  const wordmark = useThemedGrumiWordmarkSrc();
  const { theme, setTheme } = useTheme();
  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
    );

  return (
    <div className="flex h-full w-64 flex-col overflow-hidden rounded-xl bg-sidebar shadow-sm">
      <div className="flex h-20 shrink-0 flex-col items-center justify-center gap-1 px-4">
        <img src={wordmark} alt="Grumi" className="h-8 w-auto" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('admin.nav.badge')}</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1" aria-label={t('admin.title')}>
        {NAV.map(({ to, end, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border/50 p-3">
        {onMyBusiness && (
          <button type="button" className={cn(linkClass(false), 'w-full')} onClick={onMyBusiness}>
            <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
            <span>{t('admin.nav.myBusiness')}</span>
          </button>
        )}
        <button type="button" className={cn(linkClass(false), 'w-full')} onClick={onLogout}>
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
          <span>{t('admin.logout')}</span>
        </button>
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <LanguageSwitcher variant="ghost" size="sm" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t('nav.darkMode')}
            title={t('nav.darkMode')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
