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
import { Switch } from '@/components/ui/switch';
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
  { path: 'inventory', labelKey: 'nav.inventory', icon: Package },
  { path: 'transactions', labelKey: 'nav.transactions', icon: DollarSign },
  { path: 'appt-book', labelKey: 'nav.apptBook', icon: Calendar },
  { path: 'services', labelKey: 'nav.services', icon: Scissors },
];

const employeeItems = [
  { path: 'employee-management', labelKey: 'nav.employeeInfo', icon: UserCog },
  { path: 'employee-schedule', labelKey: 'nav.schedule', icon: Calendar },
  { path: 'time-tracking', labelKey: 'nav.timeTracking', icon: Clock },
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
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const basePath = businessSlug ? `/${businessSlug}` : '';
  const isActive = (path: string) => location.pathname === `${basePath}/${path}` || (path !== 'dashboard' && location.pathname.startsWith(`${basePath}/${path}`));

  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    );

  const NavLink = ({ path, labelKey, label, icon: Icon }: { path: string; labelKey?: string; label?: string; icon: React.ElementType }) => {
    const to = `${basePath}/${path}`;
    const active = isActive(path);
    return (
      <Link to={to} className={linkClass(active)}>
        <Icon className="h-5 w-5 shrink-0" />
        {(!collapsed || mobile) && <span>{labelKey ? t(labelKey) : label}</span>}
      </Link>
    );
  };

  return (
    <div className={cn('flex h-full flex-col bg-sidebar border-r border-sidebar-border overflow-hidden', mobile ? 'w-full' : collapsed ? 'w-[72px]' : 'w-60')}>
      {/* Logo + collapse: logo always visible; name only when expanded */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3 gap-2 min-w-0">
        <Link to={basePath || '/'} className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <img src="/pet-hub-logo.svg" alt="Pet Hub" className="h-8 w-8 shrink-0 object-contain flex-shrink-0" />
          {(!collapsed || mobile) && (
            <span className="font-semibold truncate text-sidebar-foreground">
              {businessName?.toLowerCase().includes('demo') ? 'Demo' : businessName || 'Pet Hub'}
            </span>
          )}
        </Link>
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 shrink-0"
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

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-1" style={{ overscrollBehavior: 'contain' }}>
        {mainNavItems.map((item) => (
          <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
        ))}

        {collapsed && !mobile ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn('w-full', linkClass(location.pathname.includes('employee') || location.pathname.includes('time-tracking')))}>
                  <UserCog className="h-5 w-5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                {employeeItems.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={`${basePath}/${item.path}`}>{t(item.labelKey)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn('w-full', linkClass(location.pathname.includes('reports')))}>
                  <BarChart3 className="h-5 w-5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                {reportsItems.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={`${basePath}/${item.path}`}>{t(item.labelKey)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn('w-full', linkClass(location.pathname.includes('/settings')))}>
                  <Settings className="h-5 w-5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                {settingsItems.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={`${basePath}/${item.path}`}>{t(item.labelKey)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
        <Collapsible open={employeesOpen} onOpenChange={setEmployeesOpen}>
          <CollapsibleTrigger className={cn('w-full', linkClass(location.pathname.includes('employee') || location.pathname.includes('time-tracking')))}>
            <UserCog className="h-5 w-5 shrink-0" />
            {(!collapsed || mobile) && <span className="flex-1 text-left">{t('nav.employees')}</span>}
            {(!collapsed || mobile) && (employeesOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />)}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-2 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
              {employeeItems.map((item) => (
                <NavLink key={item.path} path={item.path} labelKey={item.labelKey} icon={item.icon} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
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
        </Collapsible>

        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
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
        </Collapsible>
          </>
        )}

        <NavLink path="help" labelKey="nav.help" icon={Mail} />
      </nav>

      {/* Dark mode at bottom */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn('flex items-center justify-between gap-2', (collapsed && !mobile) && 'justify-center')}>
          {(!collapsed || mobile) && (
            <>
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('nav.darkMode')}</span>
            </>
          )}
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
          {(collapsed && !mobile) && <Sun className="h-4 w-4" />}
        </div>
      </div>
    </div>
  );
}
