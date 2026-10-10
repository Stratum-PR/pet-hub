import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Business, type Profile, signOut, setImpersonation } from '@/lib/auth';
import { format, isValid } from 'date-fns';
import { Building2, LogOut, ArrowLeft, Users, LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PawLoadedContent } from '@/components/PawLoadedContent';
import {
  setAuthContext,
  AUTH_CONTEXTS,
  setBusinessSlugForSession,
  getBusinessDashboardPath,
} from '@/lib/authRouting';
import { useAuth } from '@/contexts/AuthContext';
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

/** Columns of the super-admin business list (table + "View business"). */
const ADMIN_BUSINESS_LIST_COLUMNS = 'id, name, email, slug, subscription_tier, subscription_status, created_at';

type ListedBusiness = Pick<
  Business,
  'id' | 'name' | 'email' | 'slug' | 'subscription_tier' | 'subscription_status' | 'created_at'
>;

type ListedProfile = Pick<
  Profile,
  'id' | 'email' | 'full_name' | 'role' | 'business_id' | 'is_super_admin'
>;

type StaffLogin = { id: string; user_id: string; access_role: string; status: string };

/** Which group of users the panel shows: one business, or accounts with no business. */
type UsersPanelTarget = { kind: 'business'; business: ListedBusiness } | { kind: 'none' };

function safeFormatDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (!isValid(d)) return '—';
  return format(d, 'MMM d, yyyy');
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, business: myBusiness } = useAuth();
  const exitToMainBusinessPath = useMemo(() => {
    if (!profile?.business_id || !myBusiness) return null;
    return getBusinessDashboardPath(myBusiness);
  }, [profile?.business_id, myBusiness]);
  const [businesses, setBusinesses] = useState<ListedBusiness[]>([]);
  const [profiles, setProfiles] = useState<ListedProfile[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [usersPanel, setUsersPanel] = useState<UsersPanelTarget | null>(null);
  const [panelStaff, setPanelStaff] = useState<StaffLogin[]>([]);
  const [loadingPanelStaff, setLoadingPanelStaff] = useState(false);
  const [signingInAs, setSigningInAs] = useState<string | null>(null);

  const loading = loadingBiz || loadingProfiles;

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

  const fetchBusinesses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select(ADMIN_BUSINESS_LIST_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses((data as ListedBusiness[]) || []);
    } catch (error) {
      devConsole.error('Error fetching businesses:', error);
      toast.error('Failed to load businesses');
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
      toast.error('Failed to load users');
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    void fetchBusinesses();
    void fetchProfiles();
  }, [fetchBusinesses, fetchProfiles]);

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

  const handleViewBusiness = async (business: ListedBusiness) => {
    const slug = business.slug?.trim();
    if (!slug) {
      toast.error('This business has no slug; assign a slug before opening the app.');
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
      toast.success(`Opening ${business.name}`);
      navigate(`/${slug}/dashboard`);
    } catch (err: unknown) {
      devConsole.error('View business error:', err);
      toast.error(t('common.genericError'));
    } finally {
      setViewingId(null);
    }
  };

  const handleSignInAs = async (business: ListedBusiness, staff: StaffLogin) => {
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
      toast.success('Role updated');
    } catch (err: unknown) {
      devConsole.error('Role update error:', err);
      toast.error(t('common.genericError'));
      void fetchProfiles();
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'secondary';
      case 'canceled':
      case 'past_due':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'default';
      case 'pro':
      case 'growth':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <PawLoadedContent loading={loading} loaderLabel="Loading admin data">
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage all businesses</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {exitToMainBusinessPath && (
                <Button variant="secondary" onClick={handleExitAdminView}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Exit Admin View
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto space-y-8 px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>All Businesses</CardTitle>
            </CardHeader>
            <CardContent>
              {businesses.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No businesses found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-3 text-left font-medium">Business Name</th>
                        <th className="px-4 py-3 text-left font-medium">Business Owner Email</th>
                        <th className="px-4 py-3 text-left font-medium">Tier</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Users</th>
                        <th className="px-4 py-3 text-left font-medium">Created</th>
                        <th className="px-4 py-3 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.map((business) => (
                        <tr key={business.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{business.name}</td>
                          <td className="px-4 py-3">{business.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant={getTierBadgeVariant(business.subscription_tier)}>
                              {business.subscription_tier}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={getStatusBadgeVariant(business.subscription_status)}>
                              {business.subscription_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="tabular-nums"
                              onClick={() => setUsersPanel({ kind: 'business', business })}
                              aria-label={`See users of ${business.name}`}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              {profilesByBusiness.get(business.id)?.length ?? 0}
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {safeFormatDate(business.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!!viewingId || !business.slug?.trim()}
                              onClick={() => handleViewBusiness(business)}
                            >
                              <Building2 className="mr-2 h-4 w-4" />
                              {viewingId === business.id ? 'Opening…' : 'View Business'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(profilesByBusiness.get(null)?.length ?? 0) > 0 && (
                <div className="mt-4 flex justify-end">
                  <Button variant="link" size="sm" onClick={() => setUsersPanel({ kind: 'none' })}>
                    Accounts with no business ({profilesByBusiness.get(null)?.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Settings</CardTitle>
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
              {usersPanel?.kind === 'business' ? `${usersPanel.business.name}: users` : 'Accounts with no business'}
            </DialogTitle>
            <DialogDescription>
              {usersPanel?.kind === 'business'
                ? '“Sign in as” opens the app as that person (support session). To look around as yourself, use View Business.'
                : 'Clients and other accounts not linked to a business.'}
            </DialogDescription>
          </DialogHeader>
          {panelUsers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No users</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    {usersPanel?.kind === 'business' && (
                      <th className="px-3 py-2 text-left font-medium">Staff access</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium">Super admin</th>
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
                            {loadingPanelStaff ? '…' : staff ? `${staff.access_role}${staff.status !== 'active' ? ` · ${staff.status}` : ''}` : '—'}
                          </td>
                        )}
                        <td className="px-3 py-2">
                          {p.is_super_admin ? <Badge variant="default">Yes</Badge> : <span className="text-muted-foreground">No</span>}
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
                                Sign in as
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
