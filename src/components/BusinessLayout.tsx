import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Dog, 
  Scissors, 
  Settings,
  LogOut,
  BarChart3
} from 'lucide-react';
import { ImpersonationBanner } from './ImpersonationBanner';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface BusinessLayoutProps {
  children: React.ReactNode;
}

export function BusinessLayout({ children }: BusinessLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { business } = useAuth();
  const businessId = useBusinessId();
  const { resolvedTheme } = useTheme();
  const [settingsLogoLightUrl, setSettingsLogoLightUrl] = useState<string | null>(null);
  const [settingsLogoDarkUrl, setSettingsLogoDarkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    let isMounted = true;
    supabase
      .from('settings')
      .select('business_logo_url, business_logo_url_light, business_logo_url_dark')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        setSettingsLogoLightUrl(data?.business_logo_url_light ?? data?.business_logo_url ?? null);
        setSettingsLogoDarkUrl(data?.business_logo_url_dark ?? data?.business_logo_url_light ?? data?.business_logo_url ?? null);
      })
      .catch(() => {
        if (!isMounted) return;
        setSettingsLogoLightUrl(null);
        setSettingsLogoDarkUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const legacyLogoUrl = business?.logo_url ?? null;
  const logoLight = settingsLogoLightUrl ?? legacyLogoUrl;
  const logoDark = settingsLogoDarkUrl ?? settingsLogoLightUrl ?? legacyLogoUrl;
  const isDark = resolvedTheme === 'dark';
  const logoToShow = isDark ? logoDark : logoLight;

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/';
      toast.success(t('logout.confirmButton'));
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error al cerrar sesión');
      window.location.href = '/';
    }
  };

  const navItems = [
    { path: '/app', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { path: '/app/appointments', labelKey: 'nav.appointments', icon: Calendar },
    { path: '/app/clients', labelKey: 'nav.clients', icon: Users },
    { path: '/app/pets', labelKey: 'nav.pets', icon: Dog },
    { path: '/app/services', labelKey: 'nav.services', icon: Scissors },
    { path: '/app/reports', labelKey: 'nav.analytics', icon: BarChart3 },
    { path: '/app/settings', labelKey: 'nav.more', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <div className="w-[140px] h-[50px] flex items-center justify-center overflow-hidden bg-transparent -my-2">
              <img src="/pet-hub-logo.svg" alt="Pet Hub" className="w-full h-full object-contain" />
            </div>

            {/* Replace business name with logo (when present). */}
            {logoToShow ? (
              <img
                src={logoToShow}
                alt={business?.name || 'Business logo'}
                className="h-8 w-auto max-w-[240px] object-contain"
              />
            ) : (
              !!business && (
                <span className="text-xl font-semibold tracking-tight">
                  {business.name && business.name.toLowerCase().includes('demo') ? 'Demo' : business.name}
                </span>
              )
            )}
          </Link>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card min-h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path !== '/app' && location.pathname.startsWith(item.path));
              
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="w-full justify-start"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {t(item.labelKey)}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
