import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { clearPetHubBirthdayJobLocalKey } from '@/lib/demoManagerBirthdaySync';
import { isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';
import { requestNotificationsRefetch } from '@/lib/notificationRefetch';
import { dispatchStaffBirthdaysForBusiness } from '@/lib/staffBirthdayDispatch';
import { useDemoLocalSettingsMode } from '@/hooks/useDemoLocalSettingsMode';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import {
  employeeBirthPartsToDateInput,
  employeeDobInputBounds,
  isValidEmployeeDob,
  parseEmployeeDobDateInput,
} from '@/lib/employeeDob';
import { Switch } from '@/components/ui/switch';
import { devConsole } from '@/lib/clientDebug';

interface AccountSettingsProps {
  settings: Settings;
  onSaveSettings: (s: Partial<Settings>) => Promise<{ ok: boolean; error?: string }>;
}

export function AccountSettings({ settings, onSaveSettings }: AccountSettingsProps) {
  const { user, profile, refreshAuth } = useAuth();
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const demoLocalOnly = useDemoLocalSettingsMode();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifyAppointmentUnbilled, setNotifyAppointmentUnbilled] = useState(settings.notify_appointment_unbilled !== 'false');
  const [notifyInventoryLowStock, setNotifyInventoryLowStock] = useState(settings.notify_inventory_low_stock !== 'false');
  const [notifyPaymentOverdue, setNotifyPaymentOverdue] = useState(settings.notify_payment_overdue !== 'false');
  const [notifyBirthdays, setNotifyBirthdays] = useState(settings.notify_birthdays !== 'false');
  const [notifyGeneral, setNotifyGeneral] = useState(settings.notify_general !== 'false');
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [preferAdminDashboardOnLogin, setPreferAdminDashboardOnLogin] = useState(
    !!profile?.prefer_admin_dashboard_on_login
  );
  const [savingLoginPreference, setSavingLoginPreference] = useState(false);
  const [staffDobDate, setStaffDobDate] = useState('');
  const [staffDobLoading, setStaffDobLoading] = useState(false);
  const [staffDobSaving, setStaffDobSaving] = useState(false);
  const staffDobBounds = useMemo(() => employeeDobInputBounds(), []);

  useEffect(() => {
    setPreferAdminDashboardOnLogin(!!profile?.prefer_admin_dashboard_on_login);
  }, [profile?.prefer_admin_dashboard_on_login]);

  useEffect(() => {
    if (demoLocalOnly || !profile?.staff_id) return;
    let cancelled = false;
    (async () => {
      setStaffDobLoading(true);
      const { data, error } = await supabase
        .from('staff')
        .select('birth_month, birth_day, birth_year')
        .eq('id', profile.staff_id)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data) {
          setStaffDobDate(
            employeeBirthPartsToDateInput(data.birth_month, data.birth_day, data.birth_year)
          );
        }
        setStaffDobLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demoLocalOnly, profile?.staff_id]);

  useEffect(() => {
    setNotifyAppointmentUnbilled(settings.notify_appointment_unbilled !== 'false');
    setNotifyInventoryLowStock(settings.notify_inventory_low_stock !== 'false');
    setNotifyPaymentOverdue(settings.notify_payment_overdue !== 'false');
    setNotifyBirthdays(settings.notify_birthdays !== 'false');
    setNotifyGeneral(settings.notify_general !== 'false');
  }, [
    settings.notify_appointment_unbilled,
    settings.notify_inventory_low_stock,
    settings.notify_payment_overdue,
    settings.notify_birthdays,
    settings.notify_general,
  ]);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    const result = await onSaveSettings({
      notify_appointment_unbilled: String(notifyAppointmentUnbilled),
      notify_inventory_low_stock: String(notifyInventoryLowStock),
      notify_payment_overdue: String(notifyPaymentOverdue),
      notify_birthdays: String(notifyBirthdays),
      notify_general: String(notifyGeneral),
    });
    setSavingNotifications(false);
    if (result.ok) toast.success(t('notifications.settingsSaved'));
    else {
      if (result.error) devConsole.error('[AccountSettings] save notifications', result.error);
      toast.error(t('common.genericError'));
    }
  };

  const handleSaveStaffBirthday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.staff_id) {
      toast.error(t('accountSettings.staffBirthdayNeedStaffLinkBody'));
      return;
    }
    const dobTrim = staffDobDate.trim();
    let payload: { birth_month: number | null; birth_day: number | null; birth_year: number | null };
    if (!dobTrim) {
      payload = { birth_month: null, birth_day: null, birth_year: null };
    } else {
      const parts = parseEmployeeDobDateInput(dobTrim);
      if (!parts) {
        toast.error(t('employeeManagement.dobInvalid'));
        return;
      }
      const { day, month, year } = parts;
      if (!isValidEmployeeDob(day, month, year)) {
        toast.error(t('employeeManagement.dobInvalid'));
        return;
      }
      payload = { birth_month: month, birth_day: day, birth_year: year };
    }
    setStaffDobSaving(true);
    const { error } = await supabase.from('staff').update(payload as any).eq('id', profile.staff_id);
    setStaffDobSaving(false);
    if (error) {
      devConsole.error('[AccountSettings] staff DOB update', error);
      toast.error(t('common.genericError'));
    } else {
      toast.success(t('accountSettings.staffBirthdaySaved'));
      if (payload.birth_month != null && payload.birth_day != null && !demoBrowseOnly) {
        const { error: bdayErr } = await dispatchStaffBirthdaysForBusiness(businessId);
        if (bdayErr) {
          devConsole.warn('[AccountSettings] dispatchStaffBirthdaysForBusiness', bdayErr);
          toast.error(t('common.genericError'));
        }
        else if (isDemoWorkspaceBusiness(businessId)) clearPetHubBirthdayJobLocalKey(businessId);
        requestNotificationsRefetch();
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error(t('accountSettings.currentPasswordRequired'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('accountSettings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('accountSettings.passwordTooShort'));
      return;
    }
    setChangingPassword(true);
    // Verify current password server-side by re-authenticating
    const credentials: Record<string, string> = { email: user?.email ?? '' };
    credentials['password'] = currentPassword;
    const { error: signInError } = await supabase.auth.signInWithPassword(credentials as Parameters<typeof supabase.auth.signInWithPassword>[0]);
    if (signInError) {
      setChangingPassword(false);
      devConsole.error('[AccountSettings] signInWithPassword for change password', signInError);
      toast.error(t('register.linkIncorrectPassword'));
      return;
    }
    const updatePayload: Record<string, string> = {};
    updatePayload['password'] = newPassword;
    const { error } = await supabase.auth.updateUser(updatePayload as Parameters<typeof supabase.auth.updateUser>[0]);
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (error) {
      devConsole.error('[AccountSettings] updateUser password', error);
      toast.error(t('common.genericError'));
    } else toast.success(t('accountSettings.passwordUpdated'));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {demoLocalOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountSettings.demoProfileTitle')}</CardTitle>
            <CardDescription>{t('accountSettings.demoProfileDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('accountSettings.demoProfileDisplayName')}</dt>
                <dd className="mt-1 font-medium text-foreground">{t('accountSettings.demoProfileDisplayNameValue')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('accountSettings.demoProfileRole')}</dt>
                <dd className="mt-1 font-medium text-foreground">{t('accountSettings.demoProfileRoleValue')}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">{t('accountSettings.demoProfileEmail')}</dt>
                <dd className="mt-1 font-medium text-foreground">{t('accountSettings.demoProfileEmailValue')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {!demoLocalOnly && profile?.is_super_admin ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin sign-in</CardTitle>
            <CardDescription>
              Choose where you land after signing in. You can always open the Admin Dashboard from the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Open Admin Dashboard after sign-in</p>
                <p className="text-xs text-muted-foreground">
                  When off, sign-in opens your business workspace first (if you have one assigned).
                </p>
              </div>
              <Switch
                checked={preferAdminDashboardOnLogin}
                disabled={savingLoginPreference}
                onCheckedChange={async (checked) => {
                  if (!user?.id) return;
                  setPreferAdminDashboardOnLogin(checked);
                  setSavingLoginPreference(true);
                  const { error } = await supabase
                    .from('profiles')
                    .update({ prefer_admin_dashboard_on_login: checked } as Record<string, unknown>)
                    .eq('id', user.id);
                  setSavingLoginPreference(false);
                  if (error) {
                    devConsole.error('[AccountSettings] prefer_admin_dashboard_on_login', error);
                    toast.error(t('common.genericError'));
                    setPreferAdminDashboardOnLogin(!checked);
                    return;
                  }
                  await refreshAuth();
                  toast.success('Sign-in preference saved');
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!demoLocalOnly && user && !profile?.staff_id ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountSettings.staffBirthdayNeedStaffLinkTitle')}</CardTitle>
            <CardDescription>{t('accountSettings.staffBirthdayNeedStaffLinkBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            {businessSlug ? (
              <Button asChild variant="outline">
                <Link to={`/${businessSlug}/staff-management`}>{t('accountSettings.staffBirthdayNeedStaffLinkCta')}</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('accountSettings.staffBirthdayNeedStaffLinkBody')}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!demoLocalOnly && profile?.staff_id ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountSettings.staffBirthdayTitle')}</CardTitle>
            <CardDescription>{t('accountSettings.staffBirthdayDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {staffDobLoading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <form onSubmit={handleSaveStaffBirthday} className="space-y-4 max-w-xl">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Label>{t('employeeManagement.dateOfBirthLabel')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setStaffDobDate('')}
                  >
                    {t('employeeManagement.dobClear')}
                  </Button>
                </div>
                <Input
                  type="date"
                  min={staffDobBounds.min}
                  max={staffDobBounds.max}
                  value={staffDobDate}
                  onChange={(e) => setStaffDobDate(e.target.value)}
                  className="max-w-xs"
                />
                <Button type="submit" disabled={staffDobSaving}>
                  {staffDobSaving ? t('common.saving') : t('accountSettings.staffBirthdaySave')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.settingsTitle')}</CardTitle>
          <CardDescription>{t('notifications.settingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t('notifications.pref.unbilledAppointments')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.pref.unbilledAppointmentsDesc')}</p>
            </div>
            <Switch checked={notifyAppointmentUnbilled} onCheckedChange={setNotifyAppointmentUnbilled} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t('notifications.pref.lowStock')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.pref.lowStockDesc')}</p>
            </div>
            <Switch checked={notifyInventoryLowStock} onCheckedChange={setNotifyInventoryLowStock} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t('notifications.pref.paymentOverdue')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.pref.paymentOverdueDesc')}</p>
            </div>
            <Switch checked={notifyPaymentOverdue} onCheckedChange={setNotifyPaymentOverdue} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t('notifications.pref.birthdays')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.pref.birthdaysDesc')}</p>
            </div>
            <Switch checked={notifyBirthdays} onCheckedChange={setNotifyBirthdays} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t('notifications.pref.general')}</p>
              <p className="text-xs text-muted-foreground">{t('notifications.pref.generalDesc')}</p>
            </div>
            <Switch checked={notifyGeneral} onCheckedChange={setNotifyGeneral} />
          </div>
          <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
            {savingNotifications ? t('common.saving') : t('common.save')}
          </Button>
        </CardContent>
      </Card>

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountSettings.changePassword')}</CardTitle>
            <CardDescription>{t('accountSettings.changePasswordDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label htmlFor="current-password">{t('accountSettings.currentPassword')}</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('accountSettings.newPassword')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('accountSettings.confirmPassword')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? t('common.saving') : t('accountSettings.updatePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : demoLocalOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('accountSettings.changePassword')}</CardTitle>
            <CardDescription>{t('accountSettings.demoPasswordNote')}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
