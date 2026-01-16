import { Link, useLocation } from 'react-router-dom';
import { Dog, Users, LayoutDashboard, Menu, X, Clock, MoreHorizontal, BarChart3, UserCog, DollarSign, Package, Calendar, Scissors, Palette } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings as SettingsType } from '@/hooks/useSupabaseData';
import { t, getLanguage } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  settings: SettingsType;
}

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/clients', labelKey: 'nav.clients', icon: Users },
  { path: '/pets', labelKey: 'nav.pets', icon: Dog },
  { path: '/appointments', labelKey: 'nav.appointments', icon: Calendar },
  { path: '/inventory', labelKey: 'nav.inventory', icon: Package },
];

const employeeItems = [
  { path: '/employee-management', labelKey: 'nav.employeeInfo', icon: UserCog },
  { path: '/employee-schedule', labelKey: 'nav.schedule', icon: Calendar },
  { path: '/time-tracking', labelKey: 'nav.timeTracking', icon: Clock },
];

const reportsItems = [
  { path: '/reports/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { path: '/reports/payroll', labelKey: 'nav.payroll', icon: DollarSign },
];

export function Layout({ children, settings }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language } = useLanguage();
  const [employeesMenuOpen, setEmployeesMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  
  // Force re-render when language changes by using language in state
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handleLanguageChange = () => {
      forceUpdate((prev) => prev + 1);
    };
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, []);

  // Apply dynamic colors
  useEffect(() => {
    const root = document.documentElement;
    if (settings.primary_color) {
      // Ensure format is correct (remove 'hsl(' and ')' if present)
      const primaryValue = settings.primary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--primary', primaryValue);
    }
    if (settings.secondary_color) {
      // Ensure format is correct (remove 'hsl(' and ')' if present)
      const secondaryValue = settings.secondary_color.replace(/hsl\(|\)/g, '').trim();
      root.style.setProperty('--secondary', secondaryValue);
    }
  }, [settings.primary_color, settings.secondary_color]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-[140px] h-[50px] flex items-center justify-center overflow-hidden bg-transparent -my-2">
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-semibold tracking-tight">{settings.business_name || 'Stratum Hub'}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex items-center gap-2 ${isActive ? 'shadow-sm' : ''}`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(item.labelKey)}
                  </Button>
                </Link>
              );
            })}
            {/* Employees Dropdown */}
            <DropdownMenu open={employeesMenuOpen} onOpenChange={setEmployeesMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/employee') || location.pathname === '/time-tracking' ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname.startsWith('/employee') || location.pathname === '/time-tracking' ? 'shadow-sm' : ''}`}
                  onMouseEnter={() => setEmployeesMenuOpen(true)}
                  onMouseLeave={() => setEmployeesMenuOpen(false)}
                >
                  <UserCog className="w-4 h-4" />
                  {t('nav.employees')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                onMouseEnter={() => setEmployeesMenuOpen(true)}
                onMouseLeave={() => setEmployeesMenuOpen(false)}
              >
                {employeeItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-2 ${isActive ? 'bg-accent' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        {t(item.labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Reports Dropdown */}
            <DropdownMenu open={reportsMenuOpen} onOpenChange={setReportsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/reports') ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname.startsWith('/reports') ? 'shadow-sm' : ''}`}
                  onMouseEnter={() => setReportsMenuOpen(true)}
                  onMouseLeave={() => setReportsMenuOpen(false)}
                >
                  <BarChart3 className="w-4 h-4" />
                  {t('nav.reports')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                onMouseEnter={() => setReportsMenuOpen(true)}
                onMouseLeave={() => setReportsMenuOpen(false)}
              >
                {reportsItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-2 ${isActive ? 'bg-accent' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        {t(item.labelKey)}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* More Dropdown */}
            <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/services') || location.pathname.startsWith('/personalization') ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname.startsWith('/services') || location.pathname.startsWith('/personalization') ? 'shadow-sm' : ''}`}
                  onMouseEnter={() => setMoreMenuOpen(true)}
                  onMouseLeave={() => setMoreMenuOpen(false)}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  {t('nav.more')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end"
                onMouseEnter={() => setMoreMenuOpen(true)}
                onMouseLeave={() => setMoreMenuOpen(false)}
              >
                <DropdownMenuItem asChild>
                  <Link
                    to="/services"
                    className={`flex items-center gap-2 ${location.pathname === '/services' ? 'bg-accent' : ''}`}
                  >
                    <Scissors className="w-4 h-4" />
                    {t('nav.services')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/personalization"
                    className={`flex items-center gap-2 ${location.pathname === '/personalization' ? 'bg-accent' : ''}`}
                  >
                    <Palette className="w-4 h-4" />
                    {t('nav.personalization')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-border bg-card animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border transition-colors ${
                    isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            {/* Employees Submenu for Mobile */}
            <div className="border-b border-border">
              <div className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('nav.employees')}</div>
              {employeeItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-8 py-3 border-b border-border transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
            {/* Reports Submenu for Mobile */}
            <div className="border-b border-border">
              <div className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('nav.reports')}</div>
              {reportsItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-8 py-3 border-b border-border transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
            {/* More Submenu for Mobile */}
            <div className="border-b border-border">
              <div className="px-4 py-3 text-sm font-medium text-muted-foreground">{t('nav.more')}</div>
              <Link
                to="/services"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-8 py-3 border-b border-border transition-colors ${
                  location.pathname === '/services' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
              >
                <Scissors className="w-5 h-5" />
                {t('nav.services')}
              </Link>
              <Link
                to="/personalization"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-8 py-3 border-b border-border transition-colors ${
                  location.pathname === '/personalization' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
              >
                <Palette className="w-5 h-5" />
                {t('nav.personalization')}
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
