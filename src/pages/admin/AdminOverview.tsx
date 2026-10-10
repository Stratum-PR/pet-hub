import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminGrowthPanel } from '@/components/AdminGrowthPanel';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  QUIET_DAYS,
  TRIAL_WARNING_DAYS,
  relativeDay,
  trialDaysLeft,
  useAdminBusinesses,
  useAdminLastActivity,
} from '@/lib/adminData';
import { t } from '@/lib/translations';

type AttentionItem = { id: string; name: string; reason: string; icon: typeof Clock; tone: 'warn' | 'muted' };

export function AdminOverview() {
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const businessesQuery = useAdminBusinesses();
  const businesses = useMemo(() => businessesQuery.data ?? [], [businessesQuery.data]);
  const activityQuery = useAdminLastActivity(businessesQuery.data);
  const createdDates = useMemo(() => businesses.map((b) => b.created_at), [businesses]);

  /** Businesses that need a look: payment problems, trials ending, or no recent activity. */
  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const b of businesses) {
      if (b.subscription_status === 'past_due') {
        items.push({ id: `${b.id}-due`, name: b.name, reason: t('admin.overview.pastDue'), icon: AlertTriangle, tone: 'warn' });
      }
      const left = trialDaysLeft(b);
      if (left != null && left <= TRIAL_WARNING_DAYS) {
        items.push({
          id: `${b.id}-trial`,
          name: b.name,
          reason: left < 0 ? t('admin.trialEnded') : t('admin.trialEndsIn', { count: left }),
          icon: Clock,
          tone: 'warn',
        });
      }
      if (activityQuery.data) {
        const last = activityQuery.data.get(b.id) ?? null;
        if (!last) {
          items.push({ id: `${b.id}-quiet`, name: b.name, reason: t('admin.overview.noActivity'), icon: Moon, tone: 'muted' });
        } else if (differenceInCalendarDays(new Date(), last) >= QUIET_DAYS) {
          items.push({
            id: `${b.id}-quiet`,
            name: b.name,
            reason: t('admin.overview.quietSince', { when: relativeDay(last, dateLocale) }),
            icon: Moon,
            tone: 'muted',
          });
        }
      }
    }
    return items;
  }, [businesses, activityQuery.data, dateLocale]);

  return (
    <PawLoadedContent loading={businessesQuery.isLoading} loaderLabel={t('admin.loading')}>
      <div className="grid max-w-4xl gap-6">
        <AdminGrowthPanel createdDates={createdDates} />

        <Card className="max-w-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('admin.overview.attentionTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {activityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">…</p>
            ) : attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {t('admin.overview.allGood')}
              </p>
            ) : (
              <ul className="divide-y">
                {attention.map(({ id, name, reason, icon: Icon, tone }) => (
                  <li key={id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}
                      aria-hidden
                    />
                    <Link
                      to={`/admin/businesses?q=${encodeURIComponent(name)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {name}
                    </Link>
                    <span className="text-muted-foreground">{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PawLoadedContent>
  );
}
