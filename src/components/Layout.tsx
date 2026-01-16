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

interface LayoutProps {
  children: React.ReactNode;
  settings: SettingsType;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/pets', label: 'Pets', icon: Dog },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/time-tracking', label: 'Time Tracking', icon: Clock },
];

const employeeItems = [
  { path: '/employee-management', label: 'Employee Info', icon: UserCog },
  { path: '/employee-schedule', label: 'Schedule', icon: Calendar },
];

const settingsItem = { path: '/admin', label: 'More', icon: MoreHorizontal };

const reportsItems = [
  { path: '/reports/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/reports/payroll', label: 'Payroll', icon: DollarSign },
];

export function Layout({ children, settings }: LayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            {/* Employees Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/employee') ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname.startsWith('/employee') ? 'shadow-sm' : ''}`}
                >
                  <UserCog className="w-4 h-4" />
                  Employees
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Reports Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname.startsWith('/reports') ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname.startsWith('/reports') ? 'shadow-sm' : ''}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Reports
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* More Dropdown - positioned at the end */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={location.pathname === settingsItem.path ? 'default' : 'ghost'}
                  size="sm"
                  className={`flex items-center gap-2 ${location.pathname === settingsItem.path ? 'shadow-sm' : ''}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    to="/admin"
                    state={{ tab: 'services' }}
                    className={`flex items-center gap-2 ${location.pathname === '/admin' ? 'bg-accent' : ''}`}
                  >
                    <Scissors className="w-4 h-4" />
                    Services
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/admin"
                    state={{ tab: 'personalization' }}
                    className={`flex items-center gap-2 ${location.pathname === '/admin' ? 'bg-accent' : ''}`}
                  >
                    <Palette className="w-4 h-4" />
                    Personalization
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
                  {item.label}
                </Link>
              );
            })}
            {/* Employees Submenu for Mobile */}
            <div className="border-b border-border">
              <div className="px-4 py-3 text-sm font-medium text-muted-foreground">Employees</div>
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {/* Reports Submenu for Mobile */}
            <div className="border-b border-border">
              <div className="px-4 py-3 text-sm font-medium text-muted-foreground">Reports</div>
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
            {/* More - positioned at the end for mobile */}
            <Link
              to={settingsItem.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-border transition-colors ${
                location.pathname === settingsItem.path ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              {settingsItem.label}
            </Link>
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
