import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { enUS, es as esLocale } from 'date-fns/locale';
import { Building2, Loader2, LogIn, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { type Business, type Profile, setImpersonation } from '@/lib/auth';
import {
  PROFILE_ROLES,
  STATUSES,
  TIERS,
  TRIAL_WARNING_DAYS,
  adminQueryKeys,
  groupProfilesByBusiness,
  parseDate,
  relativeDay,
  statusBadgeVariant,
  statusLabel,
  trialDaysLeft,
  useAdminBusinesses,
  useAdminLastActivity,
  useAdminProfiles,
  type ListedProfile,
} from '@/lib/adminData';
import { beginSupportUserSession } from '@/lib/supportSession';
import { devConsole } from '@/lib/clientDebug';
import { t } from '@/lib/translations';

type StaffLogin = { id: string; user_id: string; access_role: string; status: string };

/** Which group of users the panel shows: one business, or accounts with no business. */
type UsersPanelTarget = { kind: 'business'; business: Business } | { kind: 'none' };

export function AdminBusinesses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const dateLocale = language === 'es' ? esLocale : enUS;
  const { profile } = useAuth();

  const businessesQuery = useAdminBusinesses();
  const profilesQuery = useAdminProfiles();
  const activityQuery = useAdminLastActivity(businessesQuery.data);
  const businesses = useMemo(() => businessesQuery.data ?? [], [businessesQuery.data]);
  const profilesByBusiness = useMemo(() => groupProfilesByBusiness(profilesQuery.data), [profilesQuery.data]);

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [usersPanel, setUsersPanel] = useState<UsersPanelTarget | null>(null);
  const [panelStaff, setPanelStaff] = useState<StaffLogin[]>([]);
  const [loadingPanelStaff, setLoadingPanelStaff] = useState(false);
  const [signingInAs, setSigningInAs] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (businessesQuery.isError) toast.error(t('admin.loadBusinessesError'));
  }, [businessesQuery.isError]);
  useEffect(() => {
    if (profilesQuery.isError) toast.error(t('admin.loadUsersError'));
  }, [profilesQuery.isError]);

  const filtered = useMemo(() => {
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
    return profilesByBusiness.get(usersPanel.kind === 'business' ? usersPanel.business.id : null) ?? [];
  }, [usersPanel, profilesByBusiness]);

  const staffByUserId = useMemo(() => new Map(panelStaff.map((s) => [s.user_id, s])), [panelStaff]);

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
        devConsole.error('[admin] staff logins', error);
        setPanelStaff([]);
        return;
      }
      setPanelStaff((data ?? []) as StaffLogin[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [usersPanel]);

  const viewBusiness = async (business: Business) => {
    const slug = business.slug?.trim();
    if (!slug) {
      toast.error(t('admin.noSlug'));
      return;
    }
    setViewingId(business.id);
    try {
      const { data: tokenData, error: tokenError } = await supabase.rpc('generate_impersonation_token', {
        target_business_id: business.id,
      });
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

  const signInAs = async (business: Business, staff: StaffLogin) => {
    setSigningInAs(staff.id);
    try {
      const result = await beginSupportUserSession(supabase, {
        staffId: staff.id,
        businessId: business.id,
        slug: business.slug,
      });
      if (result.ok === false) {
        devConsole.error('[admin] support sign-in failed', result.detail);
        toast.error(t('layout.supportInvokeFailedShort'));
      }
    } catch (err: unknown) {
      devConsole.error('[admin] support sign-in error', err);
      toast.error(t('common.genericError'));
    } finally {
      setSigningInAs(null);
    }
  };

  const changeRole = async (profileId: string, newRole: string) => {
    setRoleUpdatingId(profileId);
    try {
      const { error } = await supabase.rpc('admin_set_profile_role', { p_profile_id: profileId, p_role: newRole });
      if (error) throw error;
      queryClient.setQueryData<ListedProfile[]>(adminQueryKeys.profiles, (prev) =>
        (prev ?? []).map((p) => (p.id === profileId ? { ...p, role: newRole as Profile['role'] } : p))
      );
      toast.success(t('admin.roleUpdated'));
    } catch (err: unknown) {
      devConsole.error('Role update error:', err);
      toast.error(t('common.genericError'));
      void queryClient.invalidateQueries({ queryKey: adminQueryKeys.profiles });
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const noBusinessCount = profilesByBusiness.get(null)?.length ?? 0;

  const activityText = (id: string) => {
    if (activityQuery.isLoading) return '…';
    const d = activityQuery.data?.get(id);
    return d ? relativeDay(d, dateLocale) : t('admin.lastActivityNone');
  };

  return (
    <PawLoadedContent loading={businessesQuery.isLoading || profilesQuery.isLoading} loaderLabel={t('admin.loading')}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchBusinesses')}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-[180px]" aria-label={t('admin.colStatus')}>
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
            <SelectTrigger className="sm:w-[180px]" aria-label={t('admin.colTier')}>
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

        {businesses.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t('admin.noBusinesses')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">{t('admin.noBusinessesMatch')}</p>
        ) : (
          <>
            {/* Phone: stacked list */}
            <ul className="space-y-3 lg:hidden">
              {filtered.map((b) => {
                const left = trialDaysLeft(b);
                const userCount = profilesByBusiness.get(b.id)?.length ?? 0;
                return (
                  <li key={b.id} className="rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{b.name}</p>
                        <p className="text-sm text-muted-foreground break-all">{b.email}</p>
                      </div>
                      <Badge variant={statusBadgeVariant(b.subscription_status)}>{statusLabel(b.subscription_status)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="capitalize">{b.subscription_tier}</span> · {t('admin.colLastActivity')}: {activityText(b.id)}
                      {left != null && ` · ${left < 0 ? t('admin.trialEnded') : t('admin.trialEndsIn', { count: left })}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setUsersPanel({ kind: 'business', business: b })}>
                        <Users className="mr-2 h-4 w-4" />
                        {userCount}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!viewingId || !b.slug?.trim()}
                        onClick={() => void viewBusiness(b)}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {viewingId === b.id ? t('admin.opening') : t('admin.viewBusiness')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-lg bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colBusiness')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colTier')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colStatus')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colUsers')}</th>
                    <th className="px-3 py-2 text-left font-medium" title={t('admin.lastActivityHint')}>
                      {t('admin.colLastActivity')}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">{t('admin.colCreated')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const created = parseDate(b.created_at);
                    const left = trialDaysLeft(b);
                    return (
                      <tr key={b.id} className="border-t hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground break-all">{b.email}</p>
                        </td>
                        <td className="px-3 py-2.5 capitalize">{b.subscription_tier}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={statusBadgeVariant(b.subscription_status)}>{statusLabel(b.subscription_status)}</Badge>
                          {left != null && (
                            <p
                              className={`mt-1 text-xs ${
                                left <= TRIAL_WARNING_DAYS ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
                              }`}
                            >
                              {left < 0 ? t('admin.trialEnded') : t('admin.trialEndsIn', { count: left })}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="tabular-nums"
                            onClick={() => setUsersPanel({ kind: 'business', business: b })}
                            aria-label={t('admin.seeUsersOf', { name: b.name })}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            {profilesByBusiness.get(b.id)?.length ?? 0}
                          </Button>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{activityText(b.id)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {created ? format(created, 'PP', { locale: dateLocale }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!!viewingId || !b.slug?.trim()}
                            onClick={() => void viewBusiness(b)}
                          >
                            <Building2 className="mr-2 h-4 w-4" />
                            {viewingId === b.id ? t('admin.opening') : t('admin.viewBusiness')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {noBusinessCount > 0 && (
          <Button variant="link" size="sm" className="px-0" onClick={() => setUsersPanel({ kind: 'none' })}>
            {t('admin.accountsNoBusiness', { count: noBusinessCount })}
          </Button>
        )}
      </div>

      <Dialog open={!!usersPanel} onOpenChange={(open) => !open && setUsersPanel(null)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
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
                    {usersPanel?.kind === 'business' && <th className="px-3 py-2" />}
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
                            onValueChange={(v) => void changeRole(p.id, v)}
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
                          <td className="px-3 py-2 capitalize text-muted-foreground">
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
                            {canSignInAs && staff ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!!signingInAs}
                                onClick={() => void signInAs(usersPanel.business, staff)}
                              >
                                {signingInAs === staff.id ? (
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
