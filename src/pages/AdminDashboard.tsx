import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Business, type Profile, signOut, setImpersonation } from '@/lib/auth';
import { differenceInCalendarDays, format, isValid, startOfMonth, type Locale } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { Building2, LogOut, ArrowLeft, Users, LogIn, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import {
  setAuthContext,
  AUTH_CONTEXTS,
  setBusinessSlugForSession,
  getBusinessDashboardPath,
} from '@/lib/authRouting';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { t } from '@/lib/translations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeatureSettingsTable } from '@/components/FeatureSettingsTable';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { beginSupportUserSession } from '@/lib/supportSession';
import { devConsole } from '@/lib/clientDebug';

const PROFILE_ROLES = ['client', 'employee', 'manager', 'super_admin'] as const;
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;
const TIERS = ['basic', 'growth', 'pro', 'enterprise'] as const;
const TRIAL_WARNING_DAYS = 7;

type ListedProfile = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'role' | 'business_id' | 'is_super_admin'
>;

type StaffLogin = { id: string; user_id: string; access_role: string; status: string };

/** Which group of users the panel shows: one business, or accounts with no business. */
type UsersPanelTarget = { kind: 'business'; business: Business } | { kind: 'none' };

function parseDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return isValid(d) ? d : null;
}

function statusLabel(status: string): string {
  const key = `admin.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function getStatusBadgeVariant(status: string) {
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
function relativeDay(d: Date, locale: Locale): string {
  const days = differenceInCalendarDays(new Date(), d);
  if (days <= 0) return t('admin.today');
  if (days === 1) return t('admin.oneDayAgo');
  if (days < 31) return t('admin.daysAgo', { count: days });
  return format(d, 'PP', { locale });
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const { profile, business: myBusiness } = useAuth();
  const exitToMainBusinessPath = useMemo(() => {
    if (!profile?.business_id || !myBusiness) return null;
    return getBusinessDashboardPath(myBusiness);
  }, [profile?.business_id, myBusiness]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [profiles, setProfiles] = useState<ListedProfile[]>([]);
  const [lastActivity, setLastActivity] = useState<Map<string, Date | null>>(new Map());
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [usersPanel, setUsersPanel] = useState<UsersPanelTarget | null>(null);
  const [panelStaff, setPanelStaff] = useState<StaffLogin[]>([]);
  const [loadingPanelStaff, setLoadingPanelStaff] = useState(false);
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const loading = loadingBiz || loadingProfiles;

  const fetchBusinesses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses((data as Business[]) || []);
    } catch (error) {
      devConsole.error('Error fetching businesses:', error);
      toast.error(t('admin.loadBusinessesError'));
    } finally {
      setLoadingBiz(false);
    }
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,business_id,is_super_admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles((data as ListedProfile[]) || []);
    } catch (error) {
      devConsole.error('Error fetching profiles:', error);
      toast.error(t('admin.loadUsersError'));
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    void fetchBusinesses();
    void fetchProfiles();
  }, [fetchBusinesses, fetchProfiles]);

  // Last activity = newest appointment or sale created in each business (two tiny queries per business).
  useEffect(() => {
    if (businesses.length === 0) return;
    let cancelled = false;
    setLoadingActivity(true);
    (async () => {
      const newest = async (table: 'appointments' | 'transactions', businessId: string) => {
        const { data, error } = await supabase
          .from(table)
          .select('created_at')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          devConsole.error(`[AdminDashboard] last ${table}`, error);
          return null;
        }
        return parseDate((data?.[0] as { created_at?: string | null } | undefined)?.created_at);
      };
      const entries = await Promise.all(
        businesses.map(async (b) => {
          const [appt, txn] = await Promise.all([newest('appointments', b.id), newest('transactions', b.id)]);
          const latest = [appt, txn].filter((d): d is Date => d != null).sort((a, z) => z.getTime() - a.getTime())[0];
          return [b.id, latest ?? null] as const;
        })
      );
      if (cancelled) return;
      setLastActivity(new Map(entries));
      setLoadingActivity(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [businesses]);

  const profilesByBusiness = useMemo(() => {
    const m = new Map<string | null, ListedProfile[]>();
    for (const p of profiles) {
      const key = p.business_id ?? null;
      const list = m.get(key);
      if (list) list.push(p);
      else m.set(key, [p]);
    }
    return m;
  }, [profiles]);

  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    let active = 0;
    let trialing = 0;
    let trialEndingSoon = 0;
    let newThisMonth = 0;
    for (const b of businesses) {
      if (b.subscription_status === 'active') active += 1;
      if (b.subscription_status === 'trialing') {
        trialing += 1;
        const ends = parseDate(b.trial_ends_at);
        if (ends) {
          const left = differenceInCalendarDays(ends, new Date());
          if (left >= 0 && left <= TRIAL_WARNING_DAYS) trialEndingSoon += 1;
        }
      }
      const created = parseDate(b.created_at);
      if (created && created >= monthStart) newThisMonth += 1;
    }
    return { total: businesses.length, active, trialing, trialEndingSoon, newThisMonth, users: profiles.length };
  }, [businesses, profiles.length]);

  const filteredBusinesses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return businesses.filter((b) => {
      if (statusFilter !== 'all' && b.subscription_status !== statusFilter) return false;
      if (tierFilter !== 'all' && b.subscription_tier !== tierFilter) return false;
      if (!q) return true;
      return [b.name, b.email, b.slug].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [businesses, search, statusFilter, tierFilter]);

  const panelUsers = useMemo(() => {
    if (!usersPanel) return [];
    const key = usersPanel.kind === 'business' ? usersPanel.business.id : null;
    return profilesByBusiness.get(key) ?? [];
  }, [usersPanel, profilesByBusiness]);

  const staffByUserId = useMemo(() => {
    const m = new Map<string, StaffLogin>();
    for (const s of panelStaff) m.set(s.user_id, s);
    return m;
  }, [panelStaff]);

  // Staff logins for the open business: needed to offer "Sign in as" (support session).
  useEffect(() => {
    if (usersPanel?.kind !== 'business') {
      setPanelStaff([]);
      return;
    }
    let cancelled = false;
    setLoadingPanelStaff(true);
    (async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id,user_id,access_role,status')
        .eq('business_id', usersPanel.business.id)
        .not('user_id', 'is', null);
      if (cancelled) return;
      setLoadingPanelStaff(false);
      if (error) {
        devConsole.error('[AdminDashboard] staff logins', error);
        setPanelStaff([]);
        return;
      }
      setPanelStaff((data ?? []) as StaffLogin[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [usersPanel]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      devConsole.error('Logout error:', error);
    }
  };

  const handleExitAdminView = () => {
    if (!exitToMainBusinessPath || !myBusiness) return;
    setAuthContext(AUTH_CONTEXTS.BUSINESS);
    setBusinessSlugForSession(myBusiness);
    navigate(exitToMainBusinessPath);
  };

  const handleViewBusiness = async (business: Business) => {
    const slug = business.slug?.trim();
    if (!slug) {
      toast.error(t('admin.noSlug'));
      return;
    }

    setViewingId(business.id);
    try {
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        'generate_impersonation_token',
        { target_business_id: business.id }
      );

      if (tokenError) throw new Error(tokenError.message);

      const tokenResult = Array.isArray(tokenData) ? tokenData[0] : tokenData;
      const token =
        tokenResult && typeof tokenResult === 'object' && 'token' in tokenResult
          ? (tokenResult as { token: string }).token
          : null;

      if (!token) throw new Error('Failed to generate token');

      const { data: businessId, error: useError } = await supabase.rpc('use_impersonation_token', {
        impersonation_token: token,
      });

      if (useError) throw new Error(useError.message);
      if (!businessId) throw new Error('Invalid token response');

      setImpersonation(String(businessId), business.name);
      toast.success(t('admin.openingBusiness', { name: business.name }));
      navigate(`/${slug}/dashboard`);
    } catch (err: unknown) {
      devConsole.error('View business error:', err);
      toast.error(t('common.genericError'));
    } finally {
      setViewingId(null);
    }
  };

  const handleSignInAs = async (business: Business, staff: StaffLogin) => {
    setSigningInAs(staff.id);
    try {
      const result = await beginSupportUserSession(supabase, {
        staffId: staff.id,
        businessId: business.id,
        slug: business.slug,
      });
      if (result.ok === false) {
        devConsole.error('[AdminDashboard] support sign-in failed', result.detail);
        toast.error(t('layout.supportInvokeFailedShort'));
      }
    } catch (err: unknown) {
      devConsole.error('[AdminDashboard] support sign-in error', err);
      toast.error(t('common.genericError'));
    } finally {
      setSigningInAs(null);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    setRoleUpdatingId(profileId);
    try {
      const { error } = await supabase.rpc('admin_set_profile_role', {
        p_profile_id: profileId,
        p_role: newRole,
      });
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: newRole as Profile['role'] } : p))
      );
      toast.success(t('admin.roleUpdated'));
    } catch (err: unknown) {
      devConsole.error('Role update error:', err);
      toast.error(t('common.genericError'));
      void fetchProfiles();
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const noBusinessCount = profilesByBusiness.get(null)?.length ?? 0;

  const statTiles: { label: string; value: number; note?: string }[] = [
    { label: t('admin.statBusinesses'), value: stats.total },
    { label: t('admin.statActive'), value: stats.active },
    {
      label: t('admin.statTrialing'),
      value: stats.trialing,
      note: stats.trialEndingSoon > 0 ? t('admin.statTrialEndingSoon', { count: stats.trialEndingSoon }) : undefined,
    },
    { label: t('admin.statNewThisMonth'), value: stats.newThisMonth },
    { label: t('admin.statUsers'), value: stats.users },
  ];

  return (
    <PawLoadedContent loading={loading} loaderLabel={t('admin.loading')}>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LanguageSwitcher variant="outline" size="sm" />
              {exitToMainBusinessPath && (
                <Button variant="secondary" onClick={handleExitAdminView}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('admin.exitAdminView')}
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('admin.logout')}
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto space-y-8 px-4 py-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={t('admin.title')}>
            {statTiles.map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
                  {s.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{s.note}</p>}
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader className="space-y-4">
              <CardTitle>{t('admin.allBusinesses')}</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('admin.searchBusinesses')}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="sm:w-[170px]" aria-label={t('admin.colStatus')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.filterAllStatuses')}</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="sm:w-[150px]" aria-label={t('admin.colTier')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.filterAllTiers')}</SelectItem>
                    {TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier} className="capitalize">
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {businesses.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t('admin.noBusinesses')}</p>
              ) : filteredBusinesses.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t('admin.noBusinessesMatch')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colBusiness')}</th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colOwnerEmail')}</th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colTier')}</th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colStatus')}</th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colUsers')}</th>
                        <th className="px-3 py-3 text-left font-medium" title={t('admin.lastActivityHint')}>
                          {t('admin.colLastActivity')}
                        </th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colCreated')}</th>
                        <th className="px-3 py-3 text-left font-medium">{t('admin.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBusinesses.map((business) => {
                        const created = parseDate(business.created_at);
                        const activity = lastActivity.get(business.id);
                        const trialEnds =
                          business.subscription_status === 'trialing' ? parseDate(business.trial_ends_at) : null;
                        const trialDaysLeft = trialEnds ? differenceInCalendarDays(trialEnds, new Date()) : null;
                        return (
                          <tr key={business.id} className="border-b hover:bg-muted/50">
                            <td className="px-3 py-3 font-medium">{business.name}</td>
                            <td className="px-3 py-3 break-all">{business.email}</td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="capitalize">
                                {business.subscription_tier}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={getStatusBadgeVariant(business.subscription_status)}>
                                {statusLabel(business.subscription_status)}
                              </Badge>
                              {trialDaysLeft != null && (
                                <p
                                  className={`mt-1 text-xs ${
                                    trialDaysLeft <= TRIAL_WARNING_DAYS
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {trialDaysLeft < 0
                                    ? t('admin.trialEnded')
                                    : t('admin.trialEndsIn', { count: trialDaysLeft })}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="tabular-nums"
                                onClick={() => setUsersPanel({ kind: 'business', business })}
                                aria-label={t('admin.seeUsersOf', { name: business.name })}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                {profilesByBusiness.get(business.id)?.length ?? 0}
                              </Button>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                              {loadingActivity && activity === undefined
                                ? '…'
                                : activity
                                  ? relativeDay(activity, dateLocale)
                                  : t('admin.lastActivityNone')}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                              {created ? format(created, 'PP', { locale: dateLocale }) : '—'}
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!!viewingId || !business.slug?.trim()}
                                onClick={() => handleViewBusiness(business)}
                              >
                                <Building2 className="mr-2 h-4 w-4" />
                                {viewingId === business.id ? t('admin.opening') : t('admin.viewBusiness')}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {noBusinessCount > 0 && (
                <div className="mt-4 flex justify-end">
                  <Button variant="link" size="sm" onClick={() => setUsersPanel({ kind: 'none' })}>
                    {t('admin.accountsNoBusiness', { count: noBusinessCount })}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.featureSettings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FeatureSettingsTable />
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={!!usersPanel} onOpenChange={(open) => !open && setUsersPanel(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {usersPanel?.kind === 'business'
                ? t('admin.usersOf', { name: usersPanel.business.name })
                : t('admin.accountsNoBusinessTitle')}
            </DialogTitle>
            <DialogDescription>
              {usersPanel?.kind === 'business' ? t('admin.usersDesc') : t('admin.accountsNoBusinessDesc')}
            </DialogDescription>
          </DialogHeader>
          {panelUsers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('admin.noUsers')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colName')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colEmail')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colRole')}</th>
                    {usersPanel?.kind === 'business' && (
                      <th className="px-3 py-2 text-left font-medium">{t('admin.colStaffAccess')}</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colSuperAdmin')}</th>
                    {usersPanel?.kind === 'business' && <th className="px-3 py-2 text-left font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {panelUsers.map((p) => {
                    const staff = staffByUserId.get(p.id);
                    const canSignInAs = !!staff && staff.status === 'active' && p.id !== profile?.id;
                    return (
                      <tr key={p.id} className="border-t hover:bg-muted/40">
                        <td className="px-3 py-2">{p.full_name ?? '—'}</td>
                        <td className="px-3 py-2 break-all">{p.email}</td>
                        <td className="px-3 py-2">
                          <Select
                            value={p.role ?? 'client'}
                            disabled={roleUpdatingId === p.id}
                            onValueChange={(v) => handleRoleChange(p.id, v)}
                          >
                            <SelectTrigger className="h-8 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROFILE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {usersPanel?.kind === 'business' && (
                          <td className="px-3 py-2 text-muted-foreground capitalize">
                            {loadingPanelStaff
                              ? '…'
                              : staff
                                ? `${staff.access_role}${staff.status !== 'active' ? ` · ${staff.status}` : ''}`
                                : '—'}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {p.is_super_admin ? (
                            <Badge variant="default">{t('admin.yes')}</Badge>
                          ) : (
                            <span className="text-muted-foreground">{t('admin.no')}</span>
                          )}
                        </td>
                        {usersPanel?.kind === 'business' && (
                          <td className="px-3 py-2 text-right">
                            {canSignInAs ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!!signingInAs}
                                onClick={() => staff && void handleSignInAs(usersPanel.business, staff)}
                              >
                                {signingInAs === staff?.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <LogIn className="mr-2 h-4 w-4" />
                                )}
                                {t('admin.signInAs')}
                              </Button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PawLoadedContent>
  );
}
