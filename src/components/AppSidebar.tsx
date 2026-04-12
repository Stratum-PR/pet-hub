import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useResolvedBusinessSlug } from '@/hooks/useResolvedBusinessSlug';
import {
  LayoutDashboard,
  Users,
  User,
  Dog,
  Calendar,
  CalendarDays,
  Package,
  UserCog,
  Clock,
  BarChart3,
  DollarSign,
  Scissors,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Mail,
  ChevronDown,
  ChevronRight,
  Building2,
  CalendarCog,
  CreditCard,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureRollout } from '@/hooks/useFeatureRollout';
import { useEmployees } from '@/hooks/useSupabaseData';
import { t } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { getBusinessSettingsAnchorNavItems } from '@/lib/businessSettingsSidebarAnchors';
import type { BusinessBrandingLayout } from '@/lib/businessBrandingLayout';
import { DEFAULT_BUSINESS_BRANDING_LAYOUT } from '@/lib/businessBrandingLayout';
import { BrandingIconCompact, BrandingLogoSidebarExpanded } from '@/components/BrandingMark';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';

const SIDEBAR_COLLAPSED_KEY = 'pet-hub-sidebar-collapsed';

export function getSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export function setSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

const mainNavItems = [
  { path: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: 'clients', labelKey: 'nav.clients', icon: Users },
  { path: 'pets', labelKey: 'nav.pets', icon: Dog },
  { path: 'appointments', labelKey: 'nav.appointments', icon: CalendarDays },
  { path: 'appt-book/calendar', labelKey: 'nav.apptBook', icon: Calendar },
  { path: 'inventory', labelKey: 'nav.inventory', icon: Package },
  { path: 'transactions', labelKey: 'nav.transactions', icon: DollarSign },
  { path: 'services', labelKey: 'nav.services', icon: Scissors },
];

const employeeItems = [
  { path: 'staff-management', labelKey: 'nav.employeeInfo', icon: UserCog },
  { path: 'employee-schedule', labelKey: 'nav.schedule', icon: Calendar },
  { path: 'employee-schedule/change-requests', labelKey: 'nav.shiftChangeRequests', icon: Inbox },
  { path: 'time-kiosk', labelKey: 'nav.timeKiosk', icon: Clock },
];

const reportsItems = [
  { path: 'reports/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { path: 'reports/payroll', labelKey: 'nav.payroll', icon: Clock },
];

interface AppSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  businessName?: string;
  businessLogoUrl?: string | null;
  /** Collapsed sidebar / mobile sheet; falls back to logo when unset. */
  businessIconUrl?: string | null;
  brandingLayout?: BusinessBrandingLayout;
  /** When true, employees may open punch clock from their own phones (business setting). */
  allowEmployeeMobilePunch?: boolean;
  /** When true, render for mobile sheet (no collapse button, full width) */
  mobile?: boolean;
}

export function AppSidebar({
  collapsed,
  onCollapsedChange,
  businessName,
  businessLogoUrl,
  businessIconUrl = null,
  brandingLayout = DEFAULT_BUSINESS_BRANDING_LAYOUT,
  allowEmployeeMobilePunch = false,
  mobile,
}: AppSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const businessSlug = useResolvedBusinessSlug();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { role, staffId } = useAuth();
  const { employees: navEmployees, loading: navEmployeesLoading } = useEmployees();
  const { isFeatureVisible } = useFeatureRollout();
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const themedGrumiWordmarkSrc = useThemedGrumiWordmarkSrc();

  const featureGateSnapshot = {
    appointments: isFeatureVisible('appointments'),
    appointment_book: isFeatureVisible('appointment_book'),
    inventory: isFeatureVisible('inventory'),
    transactions_list: isFeatureVisible('transactions_list'),
    barcode_lookup: isFeatureVisible('barcode_lookup'),
    booking_settings: isFeatureVisible('booking_settings'),
    payments: isFeatureVisible('payments'),
    transaction_create: isFeatureVisible('transaction_create'),
    transaction_detail: isFeatureVisible('transaction_detail'),
  };

  const scheduleLabelKey = role === 'employee' ? 'nav.mySchedule' : 'nav.schedule';

  const isEmployeeRole = role === 'employee';
  const selfStaffRecord = useMemo(
    () => (staffId ? navEmployees.find((e) => e.id === staffId) : undefined),
    [navEmployees, staffId]
  );
  const employeeNavInactive =
    isEmployeeRole && !navEmployeesLoading && selfStaffRecord?.status === 'inactive';

  const employeeFlatNav = useMemo(() => {
    const helpItem = { path: 'help', labelKey: 'nav.help', icon: Mail } as const;
    const profileItem = {
      path: 'staff-management',
      labelKey: 'nav.myStaffProfile',
      icon: UserCog,
    } as const;
    const timesheetItem = staffId
      ? ({
          path: `reports/payroll/staff/${staffId}/timesheet`,
          labelKey: 'nav.timesheets',
          icon: DollarSign,
        } as const)
      : null;

    const scheduleItem = {
      path: 'employee-schedule',
      labelKey: 'nav.mySchedule',
      icon: Calendar,
    } as const;

    if (employeeNavInactive) {
      const items: { path: string; labelKey: string; icon: LucideIcon }[] = [profileItem];
      if (timesheetItem) items.push(timesheetItem);
      items.push(helpItem);
      return items;
    }

    const items: { path: string; labelKey: string; icon: LucideIcon }[] = [
      { path: 'clients', labelKey: 'nav.clients', icon: Users },
      { path: 'pets', labelKey: 'nav.pets', icon: Dog },
      scheduleItem,
      profileItem,
    ];
    if (allowEmployeeMobilePunch) {
      items.push({ path: 'time-kiosk', labelKey: 'nav.timeKiosk', icon: Clock });
    }
    if (timesheetItem) items.push(timesheetItem);
    items.push(helpItem);
    return items;
  }, [allowEmployeeMobilePunch, staffId, employeeNavInactive]);

  const basePath = businessSlug ? `/${businessSlug}` : '';
  const employeeHomeSegment = employeeNavInactive ? 'staff-management' : 'clients';
  const logoTarget =
    isEmployeeRole && basePath ? `${basePath}/${employeeHomeSegment}` : basePath || '/';

  const pathWithinBusiness = useMemo(() => {
    if (!businessSlug) return '/';
    const raw = location.pathname.replace(new RegExp(`^/${businessSlug}`), '') || '/';
    return raw.replace(/\/$/, '') || '/';
  }, [location.pathname, businessSlug]);

  const isSettingsRoute =
    pathWithinBusiness === '/settings' || pathWithinBusiness.startsWith('/settings/');
  const settingsChildSegment = /^\/settings\/([^/]+)/.exec(pathWithinBusiness)?.[1] ?? null;
  const isBusinessSettingsSubPage = settingsChildSegment === 'business';
  const accountSettingsVisibleNav = isFeatureVisible('account_settings');
  const bookingSettingsVisibleNav = isFeatureVisible('booking_settings');

  const logoLinkTo =
    isSettingsRoute && basePath
      ? isEmployeeRole
        ? `${basePath}/${employeeHomeSegment}`
        : `${basePath}/dashboard`
      : logoTarget;

  const prevPathWithinBusinessRef = useRef(pathWithinBusiness);
  useEffect(() => {
    const prev = prevPathWithinBusinessRef.current;
    prevPathWithinBusinessRef.current = pathWithinBusiness;
    const nowSettings = pathWithinBusiness === '/settings' || pathWithinBusiness.startsWith('/settings/');
    const prevSettings = prev === '/settings' || prev.startsWith('/settings/');
    if (nowSettings && !prevSettings && !mobile) {
      onCollapsedChange(false);
    }
  }, [pathWithinBusiness, mobile, onCollapsedChange]);

  const hashId = (location.hash || '').replace(/^#/, '');
  const businessAnchorActive = (id: string) =>
    isBusinessSettingsSubPage && (hashId === id || (!hashId && id === 'general'));
  const staffNavSectionActive =
    location.pathname.includes('/staff-management') ||
    location.pathname.includes('/employee-management') ||
    location.pathname.includes('/employee-schedule') ||
    location.pathname.includes('/time-kiosk') ||
    location.pathname.includes('/time-tracking');
  const isActive = (path: string) => location.pathname === `${basePath}/${path}` || (path !== 'dashboard' && location.pathname.startsWith(`${basePath}/${path}`));

  const isPill = !mobile;
  const useCompactBrand = mobile || collapsed;
  const compactImageUrl = businessIconUrl || businessLogoUrl || null;
  const expandedLogoUrl = businessLogoUrl || null;
  const showBrandImage = useCompactBrand ? !!compactImageUrl : !!expandedLogoUrl;
  const linkClass = (active: boolean, isCollapsedNav = false) =>
    cn(
      'flex items-center gap-3 rounded-full text-sm font-medium transition-all duration-200 min-w-0',
      isCollapsedNav ? 'justify-center w-10 h-9 flex-shrink-0' : 'rounded-full w-10 h-9 flex-shrink-0 justify-center sm:justify-start sm:w-full sm:px-3 sm:py-1 sm:h-auto',
      mobile && !isCollapsedNav && 'justify-start w-full px-3 py-1.5 h-auto',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
    );

  const NavLink = ({ path, labelKey, label, icon: Icon }: { path: string; labelKey?: string; label?: string; icon: React.ElementType }) => {
    const to = `${basePath}/${path}`;
    const active =
      path === 'employee-schedule'
        ? location.pathname === `${basePath}/employee-schedule`
        : path.startsWith('appt-book')
          ? basePath
            ? location.pathname.startsWith(`${basePath}/appt-book`)
            : location.pathname.includes('/appt-book')
          : isActive(path);
    const collapsedNav = collapsed && !mobile;
    return (
      <Link to={to} className={linkClass(active, collapsedNav)}>
        <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
          <Icon className="h-5 w-5 shrink-0" />
        </span>
        {(!collapsed || mobile) && <span className="truncate">{labelKey ? t(labelKey) : label}</span>}
      </Link>
    );
  };

  const visibleMainNavItems = mainNavItems.filter((item) => {
    if (item.path === 'appointments') return isFeatureVisible('appointments');
    if (item.path.startsWith('appt-book')) return isFeatureVisible('appointment_book');
    if (item.path === 'inventory') return isFeatureVisible('inventory');
    if (item.path === 'transactions') return isFeatureVisible('transactions_list');
    return true;
  });

  useEffect(() => {
    const width = sidebarRef.current?.getBoundingClientRect().width ?? null;
  }, [collapsed, mobile, visibleMainNavItems, location.pathname]);

  return (
    <div
      ref={sidebarRef}
      className={cn(
        'flex h-full flex-col overflow-hidden transition-all duration-300',
        mobile
          ? 'w-full bg-sidebar border-sidebar-border'
          : cn(
              'h-[calc(100%-0px)] rounded-xl shadow-sm border-0 flex-shrink-0 bg-sidebar backdrop-blur-md dark:backdrop-blur-none',
              collapsed ? 'w-[72px] min-w-[72px]' : 'w-60 min-w-[240px]'
            )
      )}
    >
      {/* Logo + collapse */}
      <div
        className={cn(
          'relative flex shrink-0 items-center min-w-0',
          isPill
            ? (collapsed ? 'h-20 px-0 justify-center' : 'h-20 px-3 gap-2 justify-between')
            : 'h-20 px-3 gap-2 border-b border-sidebar-border',
        )}
      >
        <Link
          to={logoLinkTo}
          className={cn(
            'flex items-center gap-2 min-w-0 overflow-hidden',
            isPill && collapsed ? 'flex-none justify-center' : 'flex-1 justify-center min-w-0'
          )}
        >
          {showBrandImage ? (
            <span className="shrink-0 flex items-center justify-center overflow-visible animate-logo-appear">
              {useCompactBrand && compactImageUrl ? (
                <BrandingIconCompact
                  imageUrl={compactImageUrl}
                  layout={mobile ? brandingLayout.icon.mobile : brandingLayout.icon.sidebarCollapsed}
                />
              ) : expandedLogoUrl ? (
                <BrandingLogoSidebarExpanded logoUrl={expandedLogoUrl} layout={brandingLayout.logo.sidebarExpanded} />
              ) : null}
            </span>
          ) : (
            <span
              className={cn(
                'shrink-0 flex items-center justify-center overflow-visible animate-logo-appear',
                collapsed && !mobile ? 'max-w-[52px]' : 'min-w-0 max-w-full'
              )}
            >
              <img
                src={themedGrumiWordmarkSrc}
                alt="Grumi"
                className={cn(
                  'object-contain object-left',
                  collapsed && !mobile
                    ? 'h-8 w-auto max-w-[52px]'
                    : 'h-8 sm:h-9 w-auto max-w-[min(200px,calc(100%-0.5rem))]'
                )}
              />
            </span>
          )}
        </Link>
        {!mobile && !isSettingsRoute && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 rounded-full',
              collapsed
                ? 'absolute right-0 top-0'
                : 'absolute right-2 top-2'
            )}
            onClick={() => {
              const next = !collapsed;
              onCollapsedChange(next);
              setSidebarCollapsed(next);
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <nav className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-1 space-y-0.5', isPill ? (collapsed ? 'px-0 flex flex-col items-center' : 'px-3') : 'px-2')} style={{ overscrollBehavior: 'contain' }}>
        {isSettingsRoute ? (
          <>
            <Link
              to={isEmployeeRole ? `${basePath}/${employeeHomeSegment}` : `${basePath}/dashboard`}
              className={linkClass(false, collapsed && !mobile)}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                <LayoutDashboard className="h-5 w-5 shrink-0" />
              </span>
              {(!collapsed || mobile) && <span className="truncate">{t('nav.backToApp')}</span>}
            </Link>
            {isEmployeeRole ? (
              accountSettingsVisibleNav ? (
                <NavLink path="settings/account" labelKey="nav.accountSettings" icon={User} />
              ) : null
            ) : (
              <>
                {!isBusinessSettingsSubPage ? (
                  <>
                    {accountSettingsVisibleNav ? (
                      <NavLink path="settings/account" labelKey="nav.accountSettings" icon={User} />
                    ) : null}
                    <NavLink path="settings/business" labelKey="nav.businessSettings" icon={Building2} />
                    {bookingSettingsVisibleNav ? (
                      <NavLink path="settings/booking" labelKey="nav.bookingSettings" icon={CalendarCog} />
                    ) : null}
                    <NavLink path="settings/billing" labelKey="nav.billing" icon={CreditCard} />
                  </>
                ) : null}
                {isBusinessSettingsSubPage ? (
                  <>
                    {(!collapsed || mobile) && (
                      <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                        {t('businessSettings.onThisPage')}
                      </p>
                    )}
                    {getBusinessSettingsAnchorNavItems(isFeatureVisible).map((item) => {
                      const collapsedNav = collapsed && !mobile;
                      return (
                        <a
                          key={item.id}
                          href={`${basePath}/settings/business#${item.id}`}
                          className={linkClass(businessAnchorActive(item.id), collapsedNav)}
                        >
                          <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                          </span>
                          {(!collapsed || mobile) && <span className="truncate">{t(item.labelKey)}</span>}
                        </a>
                      );
                    })}
                  </>
                ) : null}
              </>
            )}
          </>
        ) : isEmployeeRole ? (
          employeeFlatNav.map((item) => (
            <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
          ))
        ) : (
          <>
            {visibleMainNavItems.map((item) => (
              <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
            ))}

            {collapsed && !mobile ? (
              <>
                <DropdownMenu open={employeesOpen} onOpenChange={setEmployeesOpen}>
                  <div className="w-full flex justify-center">
                    <DropdownMenuTrigger asChild>
                      <button className={cn('w-full', linkClass(staffNavSectionActive, true))}>
                        <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                          <UserCog className="h-5 w-5 shrink-0" />
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48">
                      {employeeItems.map((item) => (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link to={`${basePath}/${item.path}`}>
                            {t(item.path === 'employee-schedule' ? scheduleLabelKey : item.labelKey)}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </div>
                </DropdownMenu>
                <DropdownMenu open={reportsOpen} onOpenChange={setReportsOpen}>
                  <div className="w-full flex justify-center">
                    <DropdownMenuTrigger asChild>
                      <button className={cn('w-full', linkClass(location.pathname.includes('reports'), true))}>
                        <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                          <BarChart3 className="h-5 w-5 shrink-0" />
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-48">
                      {reportsItems.map((item) => (
                        <DropdownMenuItem key={item.path} asChild>
                          <Link to={`${basePath}/${item.path}`}>
                            {t(item.labelKey)}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </div>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Collapsible open={employeesOpen} onOpenChange={setEmployeesOpen}>
                  <div className="w-full">
                    <CollapsibleTrigger className={cn('w-full min-w-0', linkClass(staffNavSectionActive))}>
                      <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                        <UserCog className="h-5 w-5 shrink-0" />
                      </span>
                      {(!collapsed || mobile) && <span className="flex-1 min-w-0 text-left truncate">{t('nav.employees')}</span>}
                      {(!collapsed || mobile) && (employeesOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                        {employeeItems.map((item) => (
                          <NavLink key={item.path} path={item.path} labelKey={item.path === 'employee-schedule' ? scheduleLabelKey : item.labelKey} icon={item.icon} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
                  <div className="w-full">
                    <CollapsibleTrigger className={cn('w-full min-w-0', linkClass(location.pathname.includes('reports')))}>
                      <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                        <BarChart3 className="h-5 w-5 shrink-0" />
                      </span>
                      {(!collapsed || mobile) && <span className="flex-1 min-w-0 text-left truncate">{t('nav.reports')}</span>}
                      {(!collapsed || mobile) && (reportsOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-2 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                        {reportsItems.map((item) => (
                          <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </>
            )}

            <NavLink path="help" labelKey="nav.help" icon={Mail} />
          </>
        )}
      </nav>

      {/* Theme toggle */}
      <div className={cn('border-t p-3', isPill ? 'border-border/50' : 'border-sidebar-border')}>
        <div className={cn('flex items-center gap-2', isPill && collapsed && 'justify-center')}>
          {(!collapsed || mobile) && (
            <span className="text-sm text-muted-foreground">{t('nav.darkMode')}</span>
          )}
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
                'absolute top-1 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full shadow ring-0 transition-transform duration-200',
                theme === 'dark' ? 'translate-x-7 left-0 bg-background' : 'translate-x-0 left-1 bg-background'
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
      </div>
    </div>
  );
}
