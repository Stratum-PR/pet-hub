import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, User, Settings, Calendar, CreditCard } from 'lucide-react';
import { t } from '@/lib/translations';
import { cn } from '@/lib/utils';

const settingsNav = [
  { path: 'account', labelKey: 'nav.accountSettings', icon: User },
  { path: 'business', labelKey: 'nav.businessSettings', icon: Settings },
  { path: 'booking', labelKey: 'nav.bookingSettings', icon: Calendar },
  { path: 'billing', labelKey: 'nav.subscription', icon: CreditCard },
];

export function SettingsLayout() {
  const { businessSlug } = useParams();
  const location = useLocation();
  const basePath = businessSlug ? `/${businessSlug}/settings` : '/settings';

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-3 border-b border-border">
          <Link
            to={businessSlug ? `/${businessSlug}/dashboard` : '/dashboard'}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('settings.backToMain')}
          </Link>
        </div>
        <nav className="p-2 flex-1">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const to = `${basePath}/${item.path}`;
            const active = location.pathname === to;
            return (
              <Link
                key={item.path}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
