import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Dog, Users, LayoutDashboard, Menu, X, Clock, MoreHorizontal, BarChart3, UserCog, DollarSign, Package, Calendar, Scissors, Palette, LogOut } from 'lucide-react';
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
import { signOut } from '@/lib/auth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { AdminImpersonationHeader } from '@/components/AdminImpersonationHeader';
import { useAuth } from '@/contexts/AuthContext';
import { PetAnimations } from '@/components/PetAnimations';

interface LayoutProps {
  children: React.ReactNode;
  settings: SettingsType;
}

const navItems = [
  // Paths are relative to /:businessSlug/
  { path: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: 'clients', labelKey: 'nav.clients', icon: Users },
  { path: 'pets', labelKey: 'nav.pets', icon: Dog },
  { path: 'appointments', labelKey: 'nav.appointments', icon: Calendar },
  { path: 'inventory', labelKey: 'nav.inventory', icon: Package },
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

export function Layout({ children, settings }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { businessSlug } = useParams();
  const { isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language } = useLanguage();
  const [employeesMenuOpen, setEmployeesMenuOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  // Track if menus were clicked open (to keep them open) vs hovered
  const [employeesMenuClicked, setEmployeesMenuClicked] = useState(false);
  const [reportsMenuClicked, setReportsMenuClicked] = useState(false);
  const [moreMenuClicked, setMoreMenuClicked] = useState(false);
  
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

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(t('logout.success'));
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Error al cerrar sesión');
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [mobileMenuOpen]);

  // Check if admin impersonation header is showing
  const isImpersonating = typeof window !== 'undefined' && sessionStorage.getItem('is_impersonating') === 'true';
  const showAdminHeader = isAdmin && isImpersonating;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Impersonation Header - Fixed at top */}
      <AdminImpersonationHeader />
      
      {/* Header */}
      <header 
        className="border-b border-border bg-card shadow-sm sticky z-50 relative overflow-hidden"
        style={{ top: showAdminHeader ? '48px' : '0' }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between relative z-50">
          <Link
            to={businessSlug ? `/${businessSlug}/dashboard` : '/'}
            className="flex items-center gap-2"
          >
            <div className="w-[140px] h-[50px] flex items-center justify-center overflow-hidden bg-transparent -my-2">
              <img src="/stratum hub logo.svg" alt="Stratum Hub" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              {settings.business_name &&
              settings.business_name.toLowerCase().includes('demo')
                ? 'Demo'
                : settings.business_name || 'Stratum Hub'}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 relative z-50">
            {navItems.map((item) => {
              const Icon = item.icon;
              const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
              const isActive = location.pathname === targetPath;
              return (
                <Link key={item.path} to={targetPath}>
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
            <DropdownMenu 
              open={employeesMenuOpen} 
              onOpenChange={(open) => {
                setEmployeesMenuOpen(open);
                if (!open) setEmployeesMenuClicked(false);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant={
                    (businessSlug &&
                      (location.pathname.startsWith(`/${businessSlug}/employee`) ||
                        location.pathname === `/${businessSlug}/time-tracking`)) ||
                    (!businessSlug &&
                      (location.pathname.startsWith('/employee') ||
                        location.pathname === '/time-tracking'))
                      ? 'default'
                      : 'ghost'
                  }
                  size="sm"
                  className={`flex items-center gap-2 ${
                    (businessSlug &&
                      (location.pathname.startsWith(`/${businessSlug}/employee`) ||
                        location.pathname === `/${businessSlug}/time-tracking`)) ||
                    (!businessSlug &&
                      (location.pathname.startsWith('/employee') ||
                        location.pathname === '/time-tracking'))
                      ? 'shadow-sm'
                      : ''
                  }`}
                  onMouseEnter={() => {
                    if (!employeesMenuClicked) {
                      setEmployeesMenuOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!employeesMenuClicked) {
                      setEmployeesMenuOpen(false);
                    }
                  }}
                  onClick={() => {
                    const newState = !employeesMenuOpen;
                    setEmployeesMenuOpen(newState);
                    setEmployeesMenuClicked(newState);
                  }}
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
                  const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
                  const isActive = location.pathname === targetPath;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={targetPath}
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
            <DropdownMenu 
              open={reportsMenuOpen} 
              onOpenChange={(open) => {
                setReportsMenuOpen(open);
                if (!open) setReportsMenuClicked(false);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant={
                    (businessSlug &&
                      location.pathname.startsWith(`/${businessSlug}/reports`)) ||
                    (!businessSlug && location.pathname.startsWith('/reports'))
                      ? 'default'
                      : 'ghost'
                  }
                  size="sm"
                  className={`flex items-center gap-2 ${
                    (businessSlug &&
                      location.pathname.startsWith(`/${businessSlug}/reports`)) ||
                    (!businessSlug && location.pathname.startsWith('/reports'))
                      ? 'shadow-sm'
                      : ''
                  }`}
                  onMouseEnter={() => {
                    if (!reportsMenuClicked) {
                      setReportsMenuOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!reportsMenuClicked) {
                      setReportsMenuOpen(false);
                    }
                  }}
                  onClick={() => {
                    const newState = !reportsMenuOpen;
                    setReportsMenuOpen(newState);
                    setReportsMenuClicked(newState);
                  }}
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
                  const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
                  const isActive = location.pathname === targetPath;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link
                        to={targetPath}
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
            <DropdownMenu 
              open={moreMenuOpen} 
              onOpenChange={(open) => {
                setMoreMenuOpen(open);
                if (!open) setMoreMenuClicked(false);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant={
                    (businessSlug &&
                      (location.pathname.startsWith(`/${businessSlug}/services`) ||
                        location.pathname.startsWith(`/${businessSlug}/personalization`))) ||
                    (!businessSlug &&
                      (location.pathname.startsWith('/services') ||
                        location.pathname.startsWith('/personalization')))
                      ? 'default'
                      : 'ghost'
                  }
                  size="sm"
                  className={`flex items-center gap-2 ${
                    (businessSlug &&
                      (location.pathname.startsWith(`/${businessSlug}/services`) ||
                        location.pathname.startsWith(`/${businessSlug}/personalization`))) ||
                    (!businessSlug &&
                      (location.pathname.startsWith('/services') ||
                        location.pathname.startsWith('/personalization')))
                      ? 'shadow-sm'
                      : ''
                  }`}
                  onMouseEnter={() => {
                    if (!moreMenuClicked) {
                      setMoreMenuOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (!moreMenuClicked) {
                      setMoreMenuOpen(false);
                    }
                  }}
                  onClick={() => {
                    const newState = !moreMenuOpen;
                    setMoreMenuOpen(newState);
                    setMoreMenuClicked(newState);
                  }}
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
                    to={businessSlug ? `/${businessSlug}/appt-book` : '/appt-book'}
                    className={`flex items-center gap-2 ${
                      (businessSlug &&
                        location.pathname === `/${businessSlug}/appt-book`) ||
                      (!businessSlug && location.pathname === '/appt-book')
                        ? 'bg-accent'
                        : ''
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Appt Book
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to={businessSlug ? `/${businessSlug}/services` : '/services'}
                    className={`flex items-center gap-2 ${
                      (businessSlug &&
                        location.pathname === `/${businessSlug}/services`) ||
                      (!businessSlug && location.pathname === '/services')
                        ? 'bg-accent'
                        : ''
                    }`}
                  >
                    <Scissors className="w-4 h-4" />
                    {t('nav.services')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to={businessSlug ? `/${businessSlug}/personalization` : '/personalization'}
                    className={`flex items-center gap-2 ${
                      (businessSlug &&
                        location.pathname === `/${businessSlug}/personalization`) ||
                      (!businessSlug && location.pathname === '/personalization')
                        ? 'bg-accent'
                        : ''
                    }`}
                  >
                    <Palette className="w-4 h-4" />
                    {t('nav.personalization')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLogoutDialogOpen(true)}
                  className="flex items-center gap-2 text-destructive cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
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

        {/* Mobile Nav - Compact Sheet Sidebar (opens from the right) */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle>Menú</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col h-[calc(100vh-80px)] overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
                const isActive = location.pathname === targetPath;
                return (
                  <Link
                    key={item.path}
                    to={targetPath}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-6 py-3 border-b border-border transition-colors ${
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
                <div className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('nav.employees')}</div>
                {employeeItems.map((item) => {
                  const Icon = item.icon;
                  const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
                  const isActive = location.pathname === targetPath;
                  return (
                    <Link
                      key={item.path}
                      to={targetPath}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-10 py-3 border-b border-border transition-colors ${
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
                <div className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('nav.reports')}</div>
                {reportsItems.map((item) => {
                  const Icon = item.icon;
                  const targetPath = businessSlug ? `/${businessSlug}/${item.path}` : `/${item.path}`;
                  const isActive = location.pathname === targetPath;
                  return (
                    <Link
                      key={item.path}
                      to={targetPath}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-10 py-3 border-b border-border transition-colors ${
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
                <div className="px-6 py-3 text-sm font-medium text-muted-foreground">{t('nav.more')}</div>
                <Link
                  to={businessSlug ? `/${businessSlug}/services` : '/services'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-10 py-3 border-b border-border transition-colors ${
                    location.pathname.includes('/services') ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <Scissors className="w-5 h-5" />
                  {t('nav.services')}
                </Link>
                <Link
                  to={businessSlug ? `/${businessSlug}/personalization` : '/personalization'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-10 py-3 border-b border-border transition-colors ${
                    location.pathname.includes('/personalization') ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <Palette className="w-5 h-5" />
                  {t('nav.personalization')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLogoutDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-10 py-3 border-b border-border text-destructive text-left hover:bg-muted transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Impersonation / client view banner (admin mode) - Only show for non-impersonating admin views */}
      {!showAdminHeader && <ImpersonationBanner />}

      {/* Main Content */}
      <main 
        className="container mx-auto px-4 py-8 flex-1"
        style={{ paddingTop: showAdminHeader ? 'calc(2rem + 48px)' : '2rem' }}
      >
        {children}
      </main>

      {/* Global footer */}
      <footer className="border-t mt-8 bg-[#f9fafb]">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <a
              href="https://stratumpr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:opacity-90 transition-opacity"
            >
              <img
                src="/Logo 4.svg"
                alt="STRATUM PR LLC"
                className="object-contain w-[180px] max-w-[220px] h-auto sm:w-[160px] md:w-[190px] cursor-pointer"
              />
            </a>
            <div className="text-xs sm:text-sm text-muted-foreground">
              © 2025 STRATUM PR LLC. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Logout confirmation dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('logout.title')}</DialogTitle>
            <DialogDescription>
              {t('logout.confirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              {t('logout.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutDialogOpen(false);
                handleLogout();
              }}
            >
              {t('logout.confirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pet Animations - Random fun animations */}
      <PetAnimations />
    </div>
  );
}
