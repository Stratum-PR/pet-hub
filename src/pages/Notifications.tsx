import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Bell, Calendar, Dog, Package, DollarSign, Cake, Scissors, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications, type NotificationRow } from '@/hooks/useNotifications';
import { t, getLanguage } from '@/lib/translations';
import {
  getNotificationPath,
  resolveNotificationType,
  type ResolvedNotificationType,
} from '@/lib/notificationNavigation';
import { cn } from '@/lib/utils';

function TypeIcon({ type, className }: { type: ResolvedNotificationType; className?: string }) {
  const cls = cn('h-4 w-4 shrink-0 text-muted-foreground', className);
  switch (type) {
    case 'appointment':
      return <Calendar className={cls} aria-hidden />;
    case 'pet':
      return <Dog className={cls} aria-hidden />;
    case 'inventory':
      return <Package className={cls} aria-hidden />;
    case 'payment':
      return <DollarSign className={cls} aria-hidden />;
    case 'service':
      return <Scissors className={cls} aria-hidden />;
    case 'birthday':
      return <Cake className={cls} aria-hidden />;
    default:
      return <Bell className={cls} aria-hidden />;
  }
}

function typeTitleKey(type: ResolvedNotificationType): string {
  switch (type) {
    case 'appointment':
      return 'notifications.type.appointment';
    case 'pet':
      return 'notifications.type.pet';
    case 'inventory':
      return 'notifications.type.inventory';
    case 'payment':
      return 'notifications.type.payment';
    case 'service':
      return 'notifications.type.service';
    case 'birthday':
      return 'notifications.type.birthday';
    default:
      return 'notifications.type.general';
  }
}

function groupLabelForDate(d: Date, locale: typeof enUS): string {
  if (isToday(d)) return t('dashboard.today');
  if (isYesterday(d)) return t('notifications.yesterday');
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear ? format(d, 'MMMM d', { locale }) : format(d, 'MMMM d, yyyy', { locale });
}

export function Notifications() {
  const navigate = useNavigate();
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const { notifications, loading, markRead, markAllRead } = useNotifications();
  const locale = getLanguage() === 'es' ? es : enUS;
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const shownNotifications = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, tab]
  );

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: NotificationRow[] }[] = [];
    for (const n of shownNotifications) {
      const d = new Date(n.created_at);
      const key = format(d, 'yyyy-MM-dd');
      const label = groupLabelForDate(d, locale);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(n);
      else groups.push({ key, label, items: [n] });
    }
    return groups;
  }, [shownNotifications, locale]);

  const hasUnread = notifications.some((n) => !n.read);

  const handleRowClick = async (n: NotificationRow) => {
    await markRead(n.id);
    navigate(getNotificationPath(n, businessSlug));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('notifications.pageTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('notifications.subtitle')}</p>
        </div>
        {hasUnread && (
          <Button type="button" variant="outline" size="sm" onClick={() => markAllRead()}>
            {t('nav.dismissAll')}
          </Button>
        )}
      </div>

      <div className="inline-flex w-fit overflow-hidden rounded-md border border-border/80 p-0.5">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {t('notifications.all')}
        </button>
        <button
          type="button"
          onClick={() => setTab('unread')}
          className={cn(
            'rounded px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'unread' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {t('notifications.unread')}
        </button>
      </div>

      {shownNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('notifications.empty60Days')}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map((section) => (
            <section key={section.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</h3>
              <Card className="overflow-hidden border-border/80">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/60">
                    {section.items.map((n) => {
                      const kind = resolveNotificationType(n);
                      const timeStr = format(new Date(n.created_at), 'p', { locale });
                      return (
                        <li key={n.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleRowClick(n)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              void handleRowClick(n);
                            }}
                            className={cn(
                              'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                              !n.read && 'bg-primary/[0.06]'
                            )}
                          >
                            <span className="mt-0.5 flex shrink-0 items-start">
                              <TypeIcon type={kind} />
                            </span>
                            <span className="min-w-0 flex-1 space-y-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    'text-sm leading-snug text-foreground',
                                    !n.read && 'font-semibold'
                                  )}
                                >
                                  {n.message}
                                </span>
                                {!n.read && (
                                  <span
                                    className="inline-flex h-2 w-2 shrink-0 rounded-full bg-primary"
                                    title={t('notifications.unread')}
                                    aria-label={t('notifications.unread')}
                                  />
                                )}
                              </span>
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="tabular-nums">{timeStr}</span>
                                <span className="text-border">·</span>
                                <span>{t(typeTitleKey(kind))}</span>
                              </span>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
