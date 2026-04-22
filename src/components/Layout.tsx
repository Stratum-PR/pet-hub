import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import { Menu, LogOut, Bell, LayoutDashboard, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings as SettingsType } from '@/hooks/useSupabaseData';
import { t } from '@/lib/translations';
import { signOut } from '@/lib/auth';
import { setDemoMode, setAuthContext, AUTH_CONTEXTS, isDemoMode } from '@/lib/authRouting';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AdminImpersonationHeader } from '@/components/AdminImpersonationHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PetAnimations } from '@/components/PetAnimations';
import { useNotifications } from '@/hooks/useNotifications';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDemoLocalSettingsMode } from '@/hooks/useDemoLocalSettingsMode';
import { isDemoBrowseOnlyPath } from '@/hooks/useDemoBrowseOnly';
import { AppSidebar, getSidebarCollapsed, setSidebarCollapsed } from '@/components/AppSidebar';
import { PageTransition } from '@/components/PageTransition';
import { usePageTransition } from '@/contexts/PageTransitionContext';
import { cn } from '@/lib/utils';
import { getNotificationPath } from '@/lib/notificationNavigation';
import {
  getBirthdayCelebrationFromNotification,
  getNotificationDisplayMessage,
} from '@/lib/notificationDisplay';
import { BirthdayCelebrationModal } from '@/components/BirthdayCelebrationModal';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useFeatureRollout } from '@/hooks/useFeatureRollout';
import { SupportImpersonationDialogContent } from '@/components/SupportImpersonationDialog';
import { SupportSessionBanner } from '@/components/SupportSessionBanner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SuperAdminViewerTier } from '@/lib/featureRollout';
import { applyPrimarySecondaryToDocument, writeCachedBusinessTheme } from '@/lib/businessThemeCss';
import { isPublicDemoPath } from '@/lib/demoWorkspace';
import { isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';
import { clearStaffSummaryFilterIfOutsidePayroll } from '@/lib/timesheetsStaffSummaryFilterStorage';
import { devConsole } from '@/lib/clientDebug';

interface LayoutProps {
  children: React.ReactNode;
  settings: SettingsType;
}

function getPageTitle(
  pathname: string,
  businessSlug: string | undefined,
  role?: string | null,
): string {
  const base = businessSlug ? `/${businessSlug}` : '';
  const path = pathname.replace(base, '') || '/';
  const pathParts = path.split('/').filter(Boolean);
  const segment = pathParts[0] || 'dashboard';
  if (
    pathParts[0] === 'reports' &&
    pathParts[1] === 'payroll' &&
    pathParts[2] === 'staff' &&
    pathParts[4] === 'timesheet' &&
    role === 'employee'
  ) {
    return t('nav.timesheets');
  }
  if (segment === 'staff-management' && role === 'employee') {
    return t('nav.myStaffProfile');
  }
  if (segment === 'employee-schedule' && role === 'employee') {
    return t('nav.mySchedule');
  }
  if (pathParts[0] === 'employee-schedule' && pathParts[1] === 'change-requests') {
    return t('nav.shiftChangeRequests');
  }
  if (pathParts[0] === 'reports' && pathParts[1] === 'payroll' && pathParts.length === 2) {
    return t('nav.payroll');
  }
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
    'staff-management': t('nav.employeeInfo'),
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
    notifications: t('notifications.pageTitle'),
  };
  return titles[segment] || segment;
}

/** Appointment book + POS: hide ambient paw trails / Woof so navigation feels utilitarian (matches PageTransition quiet shells). */
function suppressWorkspacePetDecor(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.includes('appt-book') || parts.includes('transactions');
}

export function Layout({ children, settings }: LayoutProps) {
  const { language } = useLanguage();
  const layoutRootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const suppressPetDecor = useMemo(() => suppressWorkspacePetDecor(location.pathname), [location.pathname]);
  const navigate = useNavigate();
  const businessSlug = useResolvedBusinessSlug();
  const businessId = useBusinessId();
  const { isAdmin, profile, role } = useAuth();
  const { viewerTier, setViewerTier, isSuperAdmin, isFeatureVisible } = useFeatureRollout();
  const { setTheme, resolvedTheme } = useTheme();
  const { notifications, markRead, markAllRead } = useNotifications(settings);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [supportImpersonationOpen, setSupportImpersonationOpen] = useState(false);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [birthdayModalPayload, setBirthdayModalPayload] = useState<{
    firstName: string;
    businessName: string;
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getSidebarCollapsed);
  const pageTransition = usePageTransition();
  const isRevealing = pageTransition?.isRevealing ?? false;
  const demoLocalOnly = useDemoLocalSettingsMode();
  const onDemoWorkspace = isDemoBrowseOnlyPath(location.pathname);
  const accountSettingsVisibleByFeatureGate = isFeatureVisible('account_settings');
  const bookingSettingsVisibleByFeatureGate = isFeatureVisible('booking_settings');

  const setCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
    setSidebarCollapsed(value);
  };

  // Close mobile sheet when route changes
  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
  }, [location.pathname]);

  /** Staff summary filter: persist across refresh; clear when leaving the payroll / timesheets section. */
  useEffect(() => {
    if (!businessSlug) return;
    const raw = location.pathname.replace(new RegExp(`^/${businessSlug}`), '') || '/';
    const pathWithinBusiness = raw.replace(/\/$/, '') || '/';
    clearStaffSummaryFilterIfOutsidePayroll(businessId, pathWithinBusiness);
  }, [location.pathname, businessId, businessSlug]);

  // Apply dynamic colors + persist for next refresh (noop if already set — avoids loader animation hitch).
  useEffect(() => {
    if (settings.primary_color && settings.secondary_color) {
      applyPrimarySecondaryToDocument(settings.primary_color, settings.secondary_color);
    }
    if (businessId && settings.primary_color && settings.secondary_color) {
      writeCachedBusinessTheme(businessId, settings.primary_color, settings.secondary_color);
    }
  }, [businessId, settings.primary_color, settings.secondary_color]);

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined' && isPublicDemoPath(window.location.pathname)) {
        setDemoMode(false);
      }
      setTheme('light');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('pet-hub-theme');
        localStorage.removeItem('pet-hub-theme-demo');
      }
      await signOut();
      toast.success(t('logout.success'));
      window.location.href = '/';
    } catch (err) {
      devConsole.error('Logout error:', err);
      toast.error('Error al cerrar sesión');
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (mobileMenuOpen) document.body.classList.add('menu-open');
    else document.body.classList.remove('menu-open');
    return () => document.body.classList.remove('menu-open');
  }, [mobileMenuOpen]);

  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent<{ firstName: string; businessName: string }>;
      if (ce.detail?.firstName && ce.detail?.businessName) {
        setBirthdayModalPayload(ce.detail);
        setBirthdayModalOpen(true);
      }
    };
    window.addEventListener('pet-hub-open-birthday-modal', h as EventListener);
    return () => window.removeEventListener('pet-hub-open-birthday-modal', h as EventListener);
  }, []);

  const isImpersonating = typeof window !== 'undefined' && sessionStorage.getItem('is_impersonating') === 'true';
  const showAdminHeader = isAdmin && isImpersonating;
  const pageTitle = useMemo(
    () => getPageTitle(location.pathname, businessSlug, role),
    [location.pathname, businessSlug, role, language],
  );
  const isHelpPage = /\/help\/?$/.test(location.pathname);
  /** Full-height in-layout scroll (calendar grid); avoid whole-page scroll so the grid fits the viewport. */
  const isApptBookPage = /\/appt-book(\/|$)/.test(location.pathname);
  const isTimeKioskPage = /\/time-kiosk(\/|$)/.test(location.pathname);
  /** Demo punch preview: lock main to viewport so the page fits without scrolling (mobile). */
  const timeKioskDemoViewportFit =
    isTimeKioskPage &&
    (isPublicDemoPath(location.pathname) || isDemoMode() || isDemoWorkspaceBusiness(businessId));
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  /** Match `/:businessSlug/dashboard` without relying on `useParams` (avoids missed triggers). */
  const isDashboardPath = /^\/[^/]+\/dashboard$/.test(normalizedPath);
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

  const logoLight = settings.business_logo_url_light ?? settings.business_logo_url;
  const logoDark = settings.business_logo_url_dark ?? settings.business_logo_url_light ?? settings.business_logo_url;
  const iconLight = settings.business_icon_url_light;
  const iconDark =
    settings.business_icon_url_dark ?? settings.business_icon_url_light;
  const isDark = resolvedTheme === 'dark';
  const logoToShow = isDark ? logoDark : logoLight;
  const iconToShow = isDark ? iconDark : iconLight;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentAll = notifications.slice(0, 7);
  const recentUnread = notifications.filter((n) => !n.read).slice(0, 7);
  const recentNotifications = notificationTab === 'unread' ? recentUnread : recentAll;

  const handleNotificationActivate = useCallback(
    async (n: (typeof notifications)[0]) => {
      await markRead(n.id);
      const raw = n.notification_type?.trim().toLowerCase();
      if (raw === 'birthday_celebration') {
        const d = getBirthdayCelebrationFromNotification(n);
        if (d) {
          setBirthdayModalPayload(d);
          setBirthdayModalOpen(true);
          return;
        }
      }
      navigate(getNotificationPath(n, businessSlug));
    },
    [markRead, navigate, businessSlug]
  );

  useEffect(() => {
    const rootWidth = layoutRootRef.current?.getBoundingClientRect().width ?? null;
    const contentWidth = contentRef.current?.getBoundingClientRect().width ?? null;
  }, [location.pathname, sidebarCollapsed, showAdminHeader, demoLocalOnly]);

  return (
    <>
    <div
      data-print-chain-root
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background print:h-auto print:min-h-0 print:overflow-visible"
    >
      {showAdminHeader && <AdminImpersonationHeader />}

      <div
        ref={layoutRootRef}
        className="flex min-h-0 w-full flex-1 overflow-hidden print:h-auto print:min-h-0 print:overflow-visible"
        style={{ paddingTop: showAdminHeader ? 48 : 0 }}
      >
        {/* Desktop sidebar: fills column height; main area scrolls separately */}
        <div className="hidden min-h-0 shrink-0 self-stretch pt-4 pb-4 pl-5 lg:flex lg:flex-col print:hidden">
          <AppSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setCollapsed}
            businessName={settings.business_name && settings.business_name.toLowerCase().includes('demo') ? 'Demo' : settings.business_name || 'Grumi'}
            businessLogoUrl={logoToShow}
            businessIconUrl={iconToShow}
            brandingLayout={settings.business_branding_layout}
            allowEmployeeMobilePunch={settings.allow_employee_mobile_punch === 'true'}
            mobile={false}
          />
        </div>

        {/* Main area: header fixed in column; body + footer scroll together */}
        <div
          ref={contentRef}
          data-print-main-column
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden print:h-auto print:min-h-0 print:overflow-visible"
        >
          {/* Transparent header — blends with page background */}
          <header
            className={cn(
              'shrink-0 items-center px-4 py-2 lg:px-6 bg-transparent print:hidden',
              demoLocalOnly
                ? 'flex flex-col gap-2 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-3 md:gap-y-1.5 md:py-3'
                : 'flex justify-between gap-4'
            )}
            style={{ minHeight: demoLocalOnly ? undefined : 52 }}
          >
            <div
              className={cn(
                demoLocalOnly
                  ? 'flex w-full min-w-0 items-center justify-between gap-2 min-h-[48px] md:contents'
                  : 'contents'
              )}
            >
            <div
              className={cn(
                'flex items-center gap-2 min-w-0 sm:gap-3',
                demoLocalOnly ? 'min-w-0 flex-1 md:col-start-1 md:row-start-1' : 'flex-1'
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={cn(
                    'relative h-8 min-w-0 flex-1 overflow-hidden',
                    demoLocalOnly
                      ? 'md:max-w-[min(calc(100vw-13rem),28rem)]'
                      : 'md:max-w-[min(calc(100vw-16rem),26rem)]',
                  )}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    {prevTitle && (
                      <div
                        className="absolute inset-0 flex items-center animate-fade-out-up text-lg font-semibold"
                        aria-hidden
                      >
                        <span className="min-w-0 truncate">{prevTitle}</span>
                      </div>
                    )}
                    <h1
                      title={displayTitle}
                      className={`absolute inset-0 m-0 flex items-center text-lg font-semibold ${prevTitle ? 'opacity-0 animate-fade-in-up' : ''}`}
                    >
                      <span className="min-w-0 truncate">{displayTitle}</span>
                    </h1>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="hidden shrink-0 cursor-default rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary sm:inline">
                      BETA
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {t('layout.betaTooltip')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 shrink-0',
                demoLocalOnly && 'md:col-start-3 md:row-start-1 md:justify-self-end'
              )}
            >
              <LanguageSwitcher
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 rounded-full px-2.5 text-foreground hover:bg-muted/80 hover:text-foreground max-sm:px-2 max-sm:[&>span]:sr-only"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label={t('nav.notifications')}>
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[360px] p-0">
                  <div className="flex items-center justify-between px-3 py-2">
                    <DropdownMenuLabel className="p-0">{t('nav.notifications')}</DropdownMenuLabel>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => markAllRead()}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {t('nav.dismissAll')}
                      </button>
                    ) : null}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="px-3 py-2">
                    <div className="inline-flex w-fit overflow-hidden rounded-md border border-border/80 p-0.5">
                      <button
                        type="button"
                        onClick={() => setNotificationTab('all')}
                        className={cn(
                          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                          notificationTab === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {t('notifications.all')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationTab('unread')}
                        className={cn(
                          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                          notificationTab === 'unread'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {t('notifications.unread')}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto px-1 pb-1">
                    {recentNotifications.length === 0 ? (
                      <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('nav.noNotifications')}</p>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleNotificationActivate(n)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            void handleNotificationActivate(n);
                          }}
                          className={cn(
                            'mb-1 flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/60',
                            !n.read && 'bg-primary/[0.07]',
                            n.notification_type?.trim().toLowerCase() === 'birthday_celebration' &&
                              'ring-2 ring-amber-400/50 bg-gradient-to-r from-amber-500/12 to-fuchsia-500/10'
                          )}
                        >
                          <p className={cn('line-clamp-2 text-sm text-foreground', !n.read && 'font-semibold')}>
                            {getNotificationDisplayMessage(n)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="h-8 w-full justify-center text-xs"
                      onClick={() => navigate(businessSlug ? `/${businessSlug}/notifications` : '/notifications')}
                    >
                      {t('notifications.seeHistory')}
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu: full name as trigger — Log out only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 max-w-[min(100vw-12rem,220px)] px-2 font-normal text-foreground hover:bg-muted/80 max-sm:max-w-10 max-sm:min-w-10 max-sm:justify-center max-sm:px-0"
                    aria-label={
                      onDemoWorkspace
                        ? t('layout.demoUserName')
                        : profile?.full_name?.trim() ||
                            profile?.email?.trim() ||
                            (demoLocalOnly ? t('layout.demoProfileMenuLabel') : t('layout.accountLabel'))
                    }
                  >
                    <User className="hidden h-4 w-4 shrink-0 max-sm:block" aria-hidden />
                    <span className="truncate max-sm:sr-only">
                      {onDemoWorkspace
                        ? t('layout.demoUserName')
                        : profile?.full_name?.trim() ||
                          profile?.email?.trim() ||
                          (demoLocalOnly ? t('layout.demoProfileMenuLabel') : t('layout.accountLabel'))}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={cn(
                    'w-56',
                    isSuperAdmin &&
                      !onDemoWorkspace &&
                      'w-[min(100vw-2rem,22rem)] max-h-[min(85vh,36rem)] overflow-y-auto'
                  )}
                >
                  {onDemoWorkspace && (
                    <>
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground leading-snug">
                        {demoLocalOnly ? t('layout.demoProfileMenuHint') : t('layout.demoSignedInWorkspaceHint')}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isSuperAdmin && !onDemoWorkspace && (
                    <>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {t('layout.featurePreviewChannel')}
                      </DropdownMenuLabel>
                      <div className="flex gap-1 px-2 pb-2" role="group" aria-label={t('layout.featurePreviewChannel')}>
                        {(['development', 'production'] as const satisfies readonly SuperAdminViewerTier[]).map(
                          (tier) => (
                            <Button
                              key={tier}
                              type="button"
                              size="sm"
                              variant={viewerTier === tier ? 'default' : 'outline'}
                              className="h-8 flex-1 px-1 text-xs leading-tight"
                              onClick={() => setViewerTier(tier)}
                            >
                              {tier === 'development'
                                ? t('layout.tierDevelopment')
                                : t('layout.tierProduction')}
                            </Button>
                          )
                        )}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setSupportImpersonationOpen(true);
                        }}
                      >
                        {t('layout.supportSignInAsUser')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isSuperAdmin && !onDemoWorkspace && (
                    <DropdownMenuItem
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        setAuthContext(AUTH_CONTEXTS.ADMIN);
                        navigate('/admin');
                      }}
                    >
                      <LayoutDashboard className="w-4 h-4 shrink-0" />
                      {t('nav.adminHome')}
                    </DropdownMenuItem>
                  )}
                  {accountSettingsVisibleByFeatureGate && (
                    <DropdownMenuItem asChild>
                      <Link to={`${settingsBase}/account`}>
                        {t('nav.accountSettings')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {role !== 'employee' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to={`${settingsBase}/business`}>
                          {t('nav.businessSettings')}
                        </Link>
                      </DropdownMenuItem>
                      {bookingSettingsVisibleByFeatureGate && (
                        <DropdownMenuItem asChild>
                          <Link to={`${settingsBase}/booking`}>
                            {t('nav.bookingSettings')}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to={`${settingsBase}/billing`}>
                          {t('nav.subscription')}
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
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
            </div>

            {demoLocalOnly ? (
              <div className="flex w-full justify-center px-1 md:col-start-2 md:row-start-1 md:w-auto md:self-center md:px-2">
                <span
                  className="max-w-full bg-white px-3 py-1.5 text-center text-xs font-bold leading-snug text-amber-950 sm:max-w-[22rem] sm:px-4 sm:py-2 sm:text-sm dark:bg-white dark:text-amber-950"
                  role="status"
                  aria-label={t('layout.demoLocalSettingsHint')}
                >
                  {t('layout.demoLocalSettingsHint')}
                </span>
              </div>
            ) : null}
          </header>

          {!showAdminHeader && (
            <div className="print:hidden">
              <ImpersonationBanner />
              <SupportSessionBanner />
            </div>
          )}

          <div
            data-print-scroll-region
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-x-hidden print:h-auto print:min-h-0 print:overflow-visible',
              isHelpPage || isApptBookPage || timeKioskDemoViewportFit ? 'overflow-y-hidden' : 'overflow-y-auto',
            )}
          >
            <main
              className={cn(
                'flex w-full flex-1 flex-col px-4 lg:px-6 print:overflow-visible print:min-h-0',
                isHelpPage || isApptBookPage || timeKioskDemoViewportFit
                  ? 'min-h-0 overflow-hidden py-3 print:overflow-visible'
                  : 'min-h-0 overflow-x-hidden py-6',
              )}
            >
              <PageTransition>
                {children}
              </PageTransition>
            </main>

            <footer className="shrink-0 border-t bg-muted/30 print:hidden">
              <div className="mx-auto flex max-w-[320px] flex-col items-center gap-1 px-4 py-4">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Powered by</span>
                  <a
                    href="https://stratumpr.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center rounded-sm transition-opacity hover:opacity-90"
                  >
                    <span
                      key={isDashboardPath ? normalizedPath : 'footer-stratum-logo'}
                      className={cn(
                        'relative inline-block rounded-sm',
                        isDashboardPath && 'footer-logo-shine-mount'
                      )}
                    >
                      <img
                        src={resolvedTheme === 'dark' ? '/Logo 2.svg' : '/Logo 4.svg'}
                        alt="STRATUM PR LLC"
                        className="relative z-0 block h-6 max-w-[100px] cursor-pointer object-contain"
                      />
                    </span>
                  </a>
                </div>
                <div className="text-[10px] text-muted-foreground">© 2025 STRATUM PR LLC</div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Mobile: hamburger opens sheet with full expanded sidebar (same as laptop) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-1rem,340px)] sm:w-[340px] max-w-[92vw] p-0 overflow-hidden flex flex-col"
        >
          <AppSidebar
            collapsed={false}
            onCollapsedChange={() => {}}
            businessName={settings.business_name && settings.business_name.toLowerCase().includes('demo') ? 'Demo' : settings.business_name || 'Grumi'}
            businessLogoUrl={logoToShow}
            businessIconUrl={iconToShow}
            brandingLayout={settings.business_branding_layout}
            allowEmployeeMobilePunch={settings.allow_employee_mobile_punch === 'true'}
            mobile={true}
          />
        </SheetContent>
      </Sheet>

      <SupportImpersonationDialogContent
        open={supportImpersonationOpen}
        onOpenChange={setSupportImpersonationOpen}
      />

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
    </div>
    {/* Outside overflow-hidden root so fixed paw overlays aren’t clipped mid-viewport */}
    {!suppressPetDecor ? <PetAnimations /> : null}
    {birthdayModalPayload && (
      <BirthdayCelebrationModal
        open={birthdayModalOpen}
        onOpenChange={(open) => {
          setBirthdayModalOpen(open);
          if (!open) setBirthdayModalPayload(null);
        }}
        firstName={birthdayModalPayload.firstName}
        businessName={birthdayModalPayload.businessName}
      />
    )}
    </>
  );
}
