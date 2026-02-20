import { Link, useLocation, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Dog,
  Calendar,
  Package,
  UserCog,
  Clock,
  BarChart3,
  DollarSign,
  Scissors,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Mail,
  User,
  CreditCard,
  ChevronDown,
  ChevronRight,
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
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/translations';
import { cn } from '@/lib/utils';

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
  { path: 'appointments', labelKey: 'nav.appointments', icon: Calendar },
  { path: 'appt-book', labelKey: 'nav.apptBook', icon: Calendar },
  { path: 'inventory', labelKey: 'nav.inventory', icon: Package },
  { path: 'transactions', labelKey: 'nav.transactions', icon: DollarSign },
  { path: 'services', labelKey: 'nav.services', icon: Scissors },
];

const employeeItems = [
  { path: 'employee-management', labelKey: 'nav.employeeInfo', icon: UserCog },
  { path: 'employee-schedule', labelKey: 'nav.schedule', icon: Calendar },
  { path: 'time-tracking', labelKey: 'nav.timeTracking', icon: Clock },
  { path: 'time-kiosk', labelKey: 'nav.timeKiosk', icon: Clock },
];

const reportsItems = [
  { path: 'reports/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { path: 'reports/payroll', labelKey: 'nav.payroll', icon: DollarSign },
];

const settingsItems = [
  { path: 'settings/account', labelKey: 'nav.accountSettings', icon: User },
  { path: 'settings/business', labelKey: 'nav.businessSettings', icon: Settings },
  { path: 'settings/booking', labelKey: 'nav.bookingSettings', icon: Calendar },
  { path: 'settings/billing', labelKey: 'nav.subscription', icon: CreditCard },
];

interface AppSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  businessName?: string;
  /** When true, render for mobile sheet (no collapse button, full width) */
  mobile?: boolean;
}

export function AppSidebar({ collapsed, onCollapsedChange, businessName, mobile }: AppSidebarProps) {
  const { businessSlug } = useParams();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { role } = useAuth();
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scheduleLabelKey = role === 'employee' ? 'nav.mySchedule' : 'nav.schedule';

  const basePath = businessSlug ? `/${businessSlug}` : '';
  const isActive = (path: string) => location.pathname === `${basePath}/${path}` || (path !== 'dashboard' && location.pathname.startsWith(`${basePath}/${path}`));

  const isPill = !mobile;
  const linkClass = (active: boolean, isCollapsedNav = false) =>
    cn(
      'flex items-center gap-3 rounded-full text-sm font-medium transition-all duration-200',
      isCollapsedNav ? 'justify-center w-10 h-10 flex-shrink-0' : 'rounded-full w-10 h-10 flex-shrink-0 justify-center sm:justify-start sm:w-full sm:px-3 sm:py-2 sm:h-auto',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
    );

  const NavLink = ({ path, labelKey, label, icon: Icon }: { path: string; labelKey?: string; label?: string; icon: React.ElementType }) => {
    const to = `${basePath}/${path}`;
    const active = isActive(path);
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

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden transition-all duration-300',
        mobile
          ? 'w-full bg-sidebar border-sidebar-border'
          : 'h-[calc(100%-0px)] rounded-xl w-[72px] min-w-[72px] shadow-sm border-0 flex-shrink-0 bg-sidebar backdrop-blur-md dark:backdrop-blur-none',
        !mobile && !collapsed && 'w-60 min-w-[240px]'
      )}
    >
      {/* Logo + collapse */}
      <div className={cn('flex shrink-0 items-center min-w-0', isPill ? (collapsed ? 'h-14 px-0 justify-center' : 'h-14 px-3 gap-2 justify-between') : 'h-14 px-3 gap-2 border-b border-sidebar-border')}>
        <Link
          to={basePath || '/'}
          className={cn(
            'flex items-center gap-2 min-w-0 overflow-hidden',
            isPill && collapsed ? 'flex-none justify-center' : 'flex-1 justify-center min-w-0'
          )}
        >
          <span className="shrink-0 w-8 h-8 flex items-center justify-center overflow-visible animate-logo-appear">
            <img src="/pet-hub-icon.svg" alt="" className="h-8 w-8 object-contain" aria-hidden />
          </span>
          {(!collapsed || mobile) && (
            <span className="font-bold truncate text-sidebar-foreground text-sm mt-1.5 block" style={{ fontFamily: 'var(--font-telegraf)' }}>
              {businessName?.toLowerCase().includes('demo') ? 'Demo' : businessName || 'Pet Hub'}
            </span>
          )}
        </Link>
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 shrink-0 rounded-full', collapsed ? 'ml-0' : 'ml-auto')}
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

      <nav className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 space-y-1', isPill ? (collapsed ? 'px-3 flex flex-col items-center' : 'px-3') : 'px-2')} style={{ overscrollBehavior: 'contain' }}>
        {mainNavItems.map((item) => (
          <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
        ))}

        {collapsed && !mobile ? (
          <>
            <DropdownMenu open={employeesOpen} onOpenChange={setEmployeesOpen}>
              <div
                onMouseEnter={() => setEmployeesOpen(true)}
                onMouseLeave={() => setEmployeesOpen(false)}
              >
                <DropdownMenuTrigger asChild>
                  <button className={cn('w-full', linkClass(location.pathname.includes('employee') || location.pathname.includes('time-tracking'), true))}>
                    <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                      <UserCog className="h-5 w-5 shrink-0" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  {employeeItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={`${basePath}/${item.path}`}>{t(item.path === 'employee-schedule' ? scheduleLabelKey : item.labelKey)}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </div>
            </DropdownMenu>
            <DropdownMenu open={reportsOpen} onOpenChange={setReportsOpen}>
              <div
                onMouseEnter={() => setReportsOpen(true)}
                onMouseLeave={() => setReportsOpen(false)}
              >
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
                      <Link to={`${basePath}/${item.path}`}>{t(item.labelKey)}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </div>
            </DropdownMenu>
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <div
                onMouseEnter={() => setSettingsOpen(true)}
                onMouseLeave={() => setSettingsOpen(false)}
              >
                <DropdownMenuTrigger asChild>
                  <button className={cn('w-full', linkClass(location.pathname.includes('/settings'), true))}>
                    <span className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-inherit">
                      <Settings className="h-5 w-5 shrink-0" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  {settingsItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={`${basePath}/${item.path}`}>{t(item.labelKey)}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </div>
            </DropdownMenu>
          </>
        ) : (
          <>
        <Collapsible open={employeesOpen} onOpenChange={setEmployeesOpen}>
          <div
            onMouseEnter={() => setEmployeesOpen(true)}
            onMouseLeave={() => setEmployeesOpen(false)}
          >
            <CollapsibleTrigger className={cn('w-full', linkClass(location.pathname.includes('employee') || location.pathname.includes('time-tracking')))}>
              <UserCog className="h-5 w-5 shrink-0" />
              {(!collapsed || mobile) && <span className="flex-1 text-left">{t('nav.employees')}</span>}
              {(!collapsed || mobile) && (employeesOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {employeeItems.map((item) => (
                  <NavLink key={item.path} path={item.path} labelKey={item.path === 'employee-schedule' ? scheduleLabelKey : item.labelKey} icon={item.icon} />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
          <div
            onMouseEnter={() => setReportsOpen(true)}
            onMouseLeave={() => setReportsOpen(false)}
          >
            <CollapsibleTrigger className={cn('w-full', linkClass(location.pathname.includes('reports')))}>
              <BarChart3 className="h-5 w-5 shrink-0" />
              {(!collapsed || mobile) && <span className="flex-1 text-left">{t('nav.reports')}</span>}
              {(!collapsed || mobile) && (reportsOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {reportsItems.map((item) => (
                  <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <div
            onMouseEnter={() => setSettingsOpen(true)}
            onMouseLeave={() => setSettingsOpen(false)}
          >
            <CollapsibleTrigger className={cn('w-full', linkClass(location.pathname.includes('/settings')))}>
              <Settings className="h-5 w-5 shrink-0" />
              {(!collapsed || mobile) && <span className="flex-1 text-left">{t('nav.settings')}</span>}
              {(!collapsed || mobile) && (settingsOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {settingsItems.map((item) => (
                  <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
          </>
        )}

        <NavLink path="help" labelKey="nav.help" icon={Mail} />
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
