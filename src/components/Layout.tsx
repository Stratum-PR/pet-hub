import { Link, useLocation, useParams } from 'react-router-dom';
import { Menu, LogOut, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings as SettingsType } from '@/hooks/useSupabaseData';
import { t } from '@/lib/translations';
import { signOut } from '@/lib/auth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AdminImpersonationHeader } from '@/components/AdminImpersonationHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PetAnimations } from '@/components/PetAnimations';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { AppSidebar, getSidebarCollapsed, setSidebarCollapsed } from '@/components/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { usePageTransition } from '@/contexts/PageTransitionContext';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  settings: SettingsType;
}

function getPageTitle(pathname: string, businessSlug: string | undefined): string {
  const base = businessSlug ? `/${businessSlug}` : '';
  const path = pathname.replace(base, '') || '/';
  const segment = path.split('/').filter(Boolean)[0] || 'dashboard';
  if (segment === 'settings') {
    const sub = path.split('/').filter(Boolean)[1];
    if (sub === 'account') return t('nav.accountSettings');
    if (sub === 'business') return t('nav.businessSettings');
    if (sub === 'booking') return t('nav.bookingSettings');
    if (sub === 'billing') return t('nav.subscription');
    return t('nav.settings');
  }
  const titles: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    clients: t('nav.clients'),
    pets: t('nav.pets'),
    appointments: t('nav.appointments'),
    inventory: t('nav.inventory'),
    'employee-management': t('nav.employeeInfo'),
    'employee-schedule': t('nav.schedule'),
    'time-tracking': t('nav.timeTracking'),
    reports: t('nav.reports'),
    analytics: t('nav.analytics'),
    payroll: t('nav.payroll'),
    'appt-book': t('nav.apptBook'),
    services: t('nav.services'),
    checkout: 'Checkout',
    payment: 'Payment',
    help: t('nav.help'),
    transactions: t('nav.transactions'),
  };
  return titles[segment] || segment;
}

export function Layout({ children, settings }: LayoutProps) {
  const location = useLocation();
  const { businessSlug } = useParams();
  const { isAdmin, profile } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const { notifications, markRead, markAllRead } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getSidebarCollapsed);
  const pageTransition = usePageTransition();
  const isRevealing = pageTransition?.isRevealing ?? false;

  const setCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
    setSidebarCollapsed(value);
  };

  // Close mobile sheet when route changes
  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }, [location.pathname]);

  // Apply dynamic colors
  useEffect(() => {
    const root = document.documentElement;
    if (settings.primary_color) {
      const primaryValue = settings.primary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--primary', primaryValue);
    }
    if (settings.secondary_color) {
      const secondaryValue = settings.secondary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--secondary', secondaryValue);
    }
  }, [settings.primary_color, settings.secondary_color]);

  const handleLogout = async () => {
    try {
      setTheme('light');
      if (typeof localStorage !== 'undefined') localStorage.removeItem('pet-hub-theme');
      await signOut();
      toast.success(t('logout.success'));
      window.location.href = '/';
    } catch (err) {
      if (import.meta.env.DEV) console.error('Logout error:', err);
      toast.error('Error al cerrar sesión');
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (mobileMenuOpen) document.body.classList.add('menu-open');
    else document.body.classList.remove('menu-open');
    return () => document.body.classList.remove('menu-open');
  }, [mobileMenuOpen]);

  const isImpersonating = typeof window !== 'undefined' && sessionStorage.getItem('is_impersonating') === 'true';
  const showAdminHeader = isAdmin && isImpersonating;
  const pageTitle = getPageTitle(location.pathname, businessSlug);
  const settingsBase = businessSlug ? `/${businessSlug}/settings` : '/settings';

  const [displayTitle, setDisplayTitle] = useState(pageTitle);
  const [prevTitle, setPrevTitle] = useState<string | null>(null);

  useEffect(() => {
    if (pageTitle === displayTitle && !prevTitle) return;
    if (pageTitle !== displayTitle) {
      setPrevTitle(displayTitle);
      setDisplayTitle(pageTitle);
    }
  }, [pageTitle]);

  useEffect(() => {
    if (!prevTitle) return;
    const t = setTimeout(() => setPrevTitle(null), 220);
    return () => clearTimeout(t);
  }, [prevTitle]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      {showAdminHeader && <AdminImpersonationHeader />}

      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ paddingTop: showAdminHeader ? 48 : 0 }}>
        {/* Desktop sidebar: floating pill, detached from edge */}
        <div className="hidden lg:flex flex-col shrink-0 h-full pt-4 pb-4 pl-5">
          <AppSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setCollapsed}
            businessName={settings.business_name && settings.business_name.toLowerCase().includes('demo') ? 'Demo' : settings.business_name || 'Pet Hub'}
            mobile={false}
          />
        </div>

        {/* Main area: only this content scrolls when page is long */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Transparent header — blends with page background */}
          <header
            className="shrink-0 flex items-center justify-between gap-4 px-4 py-2 lg:px-6 bg-transparent"
            style={{ minHeight: '52px' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="relative h-8 min-w-[120px] overflow-hidden flex items-center">
                {prevTitle && (
                  <div
                    className="absolute inset-0 flex items-center animate-fade-out-up text-lg font-semibold truncate"
                    aria-hidden
                  >
                    {prevTitle}
                  </div>
                )}
                <h1
                  className={`absolute inset-0 flex items-center text-lg font-semibold truncate ${prevTitle ? 'opacity-0 animate-fade-in-up' : ''}`}
                >
                  {displayTitle}
                </h1>
              </div>
              <span
                className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                title="Gracias por ayudarnos a perfeccionar este programa!"
              >
                BETA
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]" title={profile?.full_name || profile?.email || ''}>
                {profile?.full_name?.trim() || profile?.email || ''}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-4 h-4" />
                    {notifications.filter((n) => !n.read).length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                        {notifications.filter((n) => !n.read).length > 9 ? '9+' : notifications.filter((n) => !n.read).length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[360px] overflow-y-auto">
                  <div className="px-2 py-1.5 flex items-center justify-between border-b">
                    <span className="font-medium text-sm">{t('nav.notifications')}</span>
                    {notifications.some((n) => !n.read) && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllRead()}>
                        {t('nav.markAllRead')}
                      </Button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">{t('nav.noNotifications')}</div>
                  ) : (
                    notifications.slice(0, 15).map((n) => (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => markRead(n.id)}
                        onKeyDown={(e) => e.key === 'Enter' && markRead(n.id)}
                        className={`px-3 py-2 text-left text-sm cursor-pointer hover:bg-muted/50 ${!n.read ? 'bg-muted/30' : ''}`}
                      >
                        <p className="font-medium truncate">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(n.created_at), 'MMM d, HH:mm')}</p>
                      </div>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu: avatar — Log out only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                      <AvatarFallback className="text-xs">
                        {(profile?.full_name || profile?.email || 'U').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => setLogoutDialogOpen(true)}
                    className="flex items-center gap-2 text-destructive cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('nav.logOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {!showAdminHeader && <ImpersonationBanner />}

          <main className="flex-1 min-h-0 overflow-auto container mx-auto px-4 py-6 flex flex-col">
            <PageTransition>
              {children}
            </PageTransition>
          </main>

          <footer className="border-t shrink-0 bg-muted/30">
            <div className="max-w-[320px] mx-auto px-4 py-4 flex flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Powered by</span>
                <a href="https://stratumpr.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:opacity-90 transition-opacity shrink-0">
                  <img src={resolvedTheme === 'dark' ? '/Logo 2.svg' : '/Logo 4.svg'} alt="STRATUM PR LLC" className="object-contain h-6 w-auto max-w-[100px] cursor-pointer" />
                </a>
              </div>
              <div className="text-[10px] text-muted-foreground">© 2025 STRATUM PR LLC</div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile: hamburger opens sheet with full expanded sidebar (same as laptop) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px] max-w-[85vw] p-0 overflow-hidden flex flex-col">
          <AppSidebar
            collapsed={false}
            onCollapsedChange={() => {}}
            businessName={settings.business_name && settings.business_name.toLowerCase().includes('demo') ? 'Demo' : settings.business_name || 'Pet Hub'}
            mobile={true}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('logout.title')}</DialogTitle>
            <DialogDescription>{t('logout.confirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              {t('logout.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => { setLogoutDialogOpen(false); handleLogout(); }}>
              {t('logout.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PetAnimations />
    </div>
  );
}
