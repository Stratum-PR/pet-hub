import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format, isValid, type Locale } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Business, Profile } from '@/lib/auth';
import { t } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';

/** Shared data and helpers for the super-admin portal (/admin). */

export const PROFILE_ROLES = ['client', 'employee', 'manager', 'super_admin'] as const;
export const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;
export const TIERS = ['basic', 'growth', 'pro', 'enterprise'] as const;
export const TRIAL_WARNING_DAYS = 7;
/** A business with no new appointment or sale for this many days counts as quiet. */
export const QUIET_DAYS = 30;

export type ListedProfile = Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'business_id' | 'is_super_admin'>;

export const adminQueryKeys = {
  businesses: ['admin', 'businesses'] as const,
  profiles: ['admin', 'profiles'] as const,
  lastActivity: (ids: string[]) => ['admin', 'last-activity', ids] as const,
};

export function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return isValid(d) ? d : null;
}

export function statusLabel(status: string): string {
  const key = `admin.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export function statusBadgeVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default' as const;
    case 'trialing':
      return 'secondary' as const;
    case 'canceled':
    case 'past_due':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

/** "Today", "Yesterday", "N days ago" for recent dates; the date itself after a month. */
export function relativeDay(d: Date, locale: Locale): string {
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return t('admin.today');
  if (days === 1) return t('admin.oneDayAgo');
  if (days < 31) return t('admin.daysAgo', { count: days });
  return format(d, 'PP', { locale });
}

/** Days left in a trial (negative once it ended), or null when the business isn't on a trial. */
export function trialDaysLeft(b: Business): number | null {
  if (b.subscription_status !== 'trialing') return null;
  const ends = parseDate(b.trial_ends_at);
  return ends ? differenceInCalendarDays(ends, new Date()) : null;
}

export function useAdminBusinesses() {
  return useQuery({
    queryKey: adminQueryKeys.businesses,
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('*').order('created_at', { ascending: false });
      if (error) {
        devConsole.error('[admin] businesses', error);
        throw error;
      }
      return (data ?? []) as Business[];
    },
  });
}

export function useAdminProfiles() {
  return useQuery({
    queryKey: adminQueryKeys.profiles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,business_id,is_super_admin')
        .order('created_at', { ascending: false });
      if (error) {
        devConsole.error('[admin] profiles', error);
        throw error;
      }
      return (data ?? []) as ListedProfile[];
    },
  });
}

/** Newest appointment or sale created in each business (two tiny queries per business). */
export function useAdminLastActivity(businesses: Business[] | undefined) {
  const ids = (businesses ?? []).map((b) => b.id);
  return useQuery({
    queryKey: adminQueryKeys.lastActivity(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const newest = async (table: 'appointments' | 'transactions', businessId: string) => {
        const { data, error } = await supabase
          .from(table)
          .select('created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          devConsole.error(`[admin] last ${table}`, error);
          return null;
        }
        return parseDate((data?.[0] as { created_at?: string | null } | undefined)?.created_at);
      };
      const entries = await Promise.all(
        ids.map(async (id) => {
          const dates = (await Promise.all([newest('appointments', id), newest('transactions', id)])).filter(
            (d): d is Date => d != null
          );
          const latest = dates.sort((a, z) => z.getTime() - a.getTime())[0] ?? null;
          return [id, latest] as const;
        })
      );
      return new Map<string, Date | null>(entries);
    },
  });
}

export function groupProfilesByBusiness(profiles: ListedProfile[] | undefined) {
  const m = new Map<string | null, ListedProfile[]>();
  for (const p of profiles ?? []) {
    const key = p.business_id ?? null;
    const list = m.get(key);
    if (list) list.push(p);
    else m.set(key, [p]);
  }
  return m;
}
