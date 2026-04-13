import { useState, useEffect, useCallback, useRef } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useDemoBrowseOnly } from '@/hooks/useDemoBrowseOnly';
import type { Settings } from '@/hooks/useSupabaseData';
import {
  buildDemoBrowseSyntheticNotifications,
  getDemoBrowseReadIds,
  markDemoBrowseNotificationRead,
  markDemoBrowseNotificationsAllRead,
} from '@/lib/demoBrowseNotifications';
import { isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';
import { syncDemoManagerBirthdayToClientToday } from '@/lib/demoManagerBirthdaySync';
import { PET_HUB_REFETCH_NOTIFICATIONS } from '@/lib/notificationRefetch';
import { dispatchStaffMissingEmailReminders } from '@/lib/staffBirthdayDispatch';
import { devConsole } from '@/lib/clientDebug';

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Calendar Y-M-D for `date` in `timeZone` (IANA), matching `dispatch_staff_birthdays_for_business` (business settings TZ). */
function getCalendarYmdInZone(
  date: Date,
  timeZone: string | null | undefined
): { year: number; month: number; day: number } {
  const tz = (timeZone && String(timeZone).trim()) || 'America/New_York';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const mo = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
      return { year: y, month: mo, day: d };
    }
  } catch {
    /* invalid TZ */
  }
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** UTC instant for the first 00:00:00 on civil date y-m-d in `timeZone` (dedup `gte(created_at, …)`). */
function zonedDayStartUtcIso(y: number, m: number, d: number, timeZone: string | null | undefined): string {
  const tz = (timeZone && String(timeZone).trim()) || 'America/New_York';
  const matchesMidnight = (tMs: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(tMs));
    const py = Number(parts.find((p) => p.type === 'year')?.value);
    const pm = Number(parts.find((p) => p.type === 'month')?.value);
    const pd = Number(parts.find((p) => p.type === 'day')?.value);
    const ph = Number(parts.find((p) => p.type === 'hour')?.value);
    const pmin = Number(parts.find((p) => p.type === 'minute')?.value);
    const ps = Number(parts.find((p) => p.type === 'second')?.value);
    return py === y && pm === m && pd === d && ph === 0 && pmin === 0 && ps === 0;
  };
  const anchor = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let h = -36; h <= 36; h++) {
    const t = anchor + h * 3600000;
    if (matchesMidnight(t)) return new Date(t).toISOString();
  }
  return new Date(anchor).toISOString();
}

function msUntilNextLocal6am(now = new Date()): number {
  const next = new Date(now.getTime());
  next.setHours(6, 0, 0, 0);
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return Math.max(0, next.getTime() - now.getTime());
}

export type NotificationType =
  | 'general'
  | 'appointment'
  | 'pet'
  | 'inventory'
  | 'payment'
  | 'service'
  | 'birthday'
  | 'birthday_team'
  | 'birthday_celebration';

export interface NotificationRow {
  id: string;
  user_id: string;
  business_id: string;
  message: string;
  product_id: string | null;
  read: boolean;
  created_at: string;
  notification_type?: string | null;
  appointment_id?: string | null;
  pet_id?: string | null;
  transaction_id?: string | null;
  service_id?: string | null;
  staff_id?: string | null;
  metadata?: unknown;
}

const NOTIFICATION_WINDOW_DAYS = 60;

function windowStartIso(): string {
  return subDays(new Date(), NOTIFICATION_WINDOW_DAYS).toISOString();
}

export interface CreateNotificationOptions {
  productId?: string | null;
  appointmentId?: string | null;
  petId?: string | null;
  transactionId?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  /** @deprecated use staffId */
  employeeId?: string | null;
  type?: NotificationType;
  /** Stored as JSON (e.g. birthday_celebration deep-link payload). */
  metadata?: Record<string, unknown> | null;
}

function asEnabled(raw: string | null | undefined, fallback = true): boolean {
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export function useNotifications(settings: Settings) {
  const { user, staffId } = useAuth();
  const businessId = useBusinessId();
  const demoBrowseOnly = useDemoBrowseOnly();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!businessId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (demoBrowseOnly && isDemoWorkspaceBusiness(businessId)) {
      setLoading(true);
      const raw = buildDemoBrowseSyntheticNotifications(
        businessId,
        asEnabled(settings.notify_birthdays, true),
        String(settings.business_name ?? '')
      );
      const readIds = getDemoBrowseReadIds(businessId);
      const rows: NotificationRow[] = raw.map((n) => ({
        ...n,
        read: readIds.has(n.id),
      }));
      setNotifications(rows);
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const since = windowStartIso();
    const { data, error } = await supabase
      .from('notifications' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    let rows = (data as any[]) as NotificationRow[];

    // Demo backfill: payment notifications created previously may lack transaction_id.
    // If so, attach the most relevant currently-partial transaction so navigation works.
    const missingPaymentTx = rows.filter((n) => n.notification_type === 'payment' && !n.transaction_id);
    if (missingPaymentTx.length > 0) {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const twentyFourHoursAgoIso = new Date(twentyFourHoursAgo).toISOString();
      const { data: partials } = await supabase
        .from('transactions' as any)
        .select('id, created_at')
        .eq('business_id', businessId)
        .eq('status', 'partial')
        .lt('created_at', twentyFourHoursAgoIso)
        .order('created_at', { ascending: false })
        .limit(10);

      const candidateTxId = (partials?.[0] as any)?.id as string | undefined;
      if (candidateTxId) {
        for (const n of missingPaymentTx) {
          await supabase
            .from('notifications' as any)
            .update({ transaction_id: candidateTxId })
            .eq('id', n.id)
            .eq('user_id', user.id)
            .eq('business_id', businessId);
          n.transaction_id = candidateTxId;
        }
      }
    }

    setNotifications(rows);
    setLoading(false);
  }, [user?.id, businessId, demoBrowseOnly, settings.notify_birthdays, settings.business_name]);

  const fetchNotificationsRef = useRef(fetchNotifications);
  fetchNotificationsRef.current = fetchNotifications;

  const createNotification = useCallback(
    async (
      message: string,
      targetBusinessId: string,
      options?: CreateNotificationOptions
    ): Promise<boolean> => {
      if (!user?.id) return false;
      const type = options?.type ?? 'general';
      const bday = asEnabled(settings.notify_birthdays, true);
      const enabledByType: Record<NotificationType, boolean> = {
        appointment: asEnabled(settings.notify_appointment_unbilled, true),
        inventory: asEnabled(settings.notify_inventory_low_stock, true),
        payment: asEnabled(settings.notify_payment_overdue, true),
        birthday: bday,
        birthday_team: bday,
        birthday_celebration: bday,
        general: asEnabled(settings.notify_general, true),
        pet: asEnabled(settings.notify_general, true),
        service: asEnabled(settings.notify_general, true),
      };
      if (!enabledByType[type]) return false;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        business_id: targetBusinessId,
        message,
        read: false,
      };
      payload.notification_type = type;
      if (options?.productId) payload.product_id = options.productId;
      if (options?.appointmentId) payload.appointment_id = options.appointmentId;
      if (options?.petId) payload.pet_id = options.petId;
      if (options?.transactionId) payload.transaction_id = options.transactionId;
      if (options?.serviceId) payload.service_id = options.serviceId;
      const sid = options?.staffId ?? options?.employeeId;
      if (sid) payload.staff_id = sid;
      if (options?.metadata && typeof options.metadata === 'object') {
        payload.metadata = options.metadata;
      }
      const { error } = await supabase.from('notifications' as any).insert(payload);
      if (error) {
        devConsole.warn('[useNotifications] createNotification insert failed:', error.message);
      }
      return !error;
    },
    [
      user?.id,
      settings.notify_birthdays,
      settings.notify_appointment_unbilled,
      settings.notify_inventory_low_stock,
      settings.notify_payment_overdue,
      settings.notify_general,
    ]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const onRefetch = () => {
      void fetchNotificationsRef.current();
    };
    window.addEventListener(PET_HUB_REFETCH_NOTIFICATIONS, onRefetch);
    return () => window.removeEventListener(PET_HUB_REFETCH_NOTIFICATIONS, onRefetch);
  }, []);

  /** Pet month reminders, staff birthday RPC + client fallbacks (business TZ), manager email reminders — at most once per browser-local calendar day per business; retries same day if RPC fails. */
  useEffect(() => {
    if (demoBrowseOnly && businessId && isDemoWorkspaceBusiness(businessId)) return;

    if (!user?.id) {
      devConsole.debug(
        '[pet-hub] Notifications / birthday jobs need a signed-in user. Browse-only /demo uses synthetic inbox rows instead.'
      );
      return;
    }
    if (!businessId) {
      devConsole.debug('[pet-hub] Birthday jobs skipped: businessId not ready yet.');
      return;
    }
    if (!asEnabled(settings.notify_birthdays, true)) {
      devConsole.debug('[pet-hub] Birthday jobs skipped: notify_birthdays is off for this business (Settings).');
      return;
    }

    const uid = user.id;
    const storageKeyForDay = () =>
      `pet-hub-daily-birthday-jobs:${businessId}:${localDayKey(new Date())}`;

    const runDailyBirthdayJobs = async () => {
      const now = new Date();
      const key = `pet-hub-daily-birthday-jobs:${businessId}:${localDayKey(now)}`;
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1') {
          devConsole.debug(
            `[pet-hub] Birthday jobs already ran today (${key}). In DevTools → Application → Local Storage, delete this key to re-test.`
          );
          await fetchNotificationsRef.current();
          return;
        }
      } catch {
        /* ignore */
      }

      const bizTz = settings.timezone;
      const { year: bizYear, month, day } = getCalendarYmdInZone(now, bizTz);
      const todayStart = zonedDayStartUtcIso(bizYear, month, day, bizTz);

      const { data: pets, error: petErr } = await supabase
        .from('pets')
        .select('id, name, birth_month, birth_year')
        .eq('business_id', businessId)
        .eq('birth_month', month);

      if (!petErr && pets && pets.length > 0) {
        for (const p of pets as Array<{ id: string; name: string; birth_month: number | null; birth_year: number | null }>) {
          const { data: existing } = await supabase
            .from('notifications' as any)
            .select('id')
            .eq('user_id', uid)
            .eq('business_id', businessId)
            .eq('notification_type', 'birthday')
            .eq('pet_id', p.id)
            .gte('created_at', todayStart)
            .limit(1);
          if (existing && existing.length > 0) continue;
          const ageText =
            typeof p.birth_year === 'number' && Number.isFinite(p.birth_year)
              ? ` (${Math.max(0, bizYear - p.birth_year)} yrs)`
              : '';
          await createNotification(`Birthday month reminder: ${p.name}${ageText}.`, businessId, {
            petId: p.id,
            type: 'birthday',
          });
        }
      }

      const { error: rpcError } = await supabase.rpc('dispatch_staff_birthdays_for_business', {
        p_business_id: businessId,
      });
      if (rpcError) {
        devConsole.warn(
          '[pet-hub] dispatch_staff_birthdays_for_business failed — apply Supabase migrations (staff birthday RPC).',
          rpcError.message
        );
      }

      if (staffId) {
        const { data: myStaff, error: staffRowErr } = await supabase
          .from('staff')
          .select('id, name, birth_month, birth_day, status, business_id')
          .eq('id', staffId)
          .maybeSingle();
        const row = myStaff as
          | {
              id: string;
              name: string;
              birth_month: number | null;
              birth_day: number | null;
              status: string | null;
              business_id: string | null;
            }
          | null;
        const bm = row?.birth_month != null ? Number(row.birth_month) : NaN;
        const bd = row?.birth_day != null ? Number(row.birth_day) : NaN;
        if (
          !staffRowErr &&
          row &&
          row.business_id === businessId &&
          row.status === 'active' &&
          bm === month &&
          bd === day
        ) {
          const { data: existingMine } = await supabase
            .from('notifications' as any)
            .select('id')
            .eq('user_id', uid)
            .eq('business_id', businessId)
            .eq('notification_type', 'birthday_celebration')
            .eq('staff_id', row.id)
            .gte('created_at', todayStart)
            .limit(1);
          if (!existingMine?.length) {
            const rawFirst = row.name.trim().split(/\s+/)[0];
            const firstName = rawFirst || row.name || 'Friend';
            const businessName =
              (settings.business_name && String(settings.business_name).trim()) || 'Grumi';
            await createNotification(
              "🎂 Happy Birthday! It's your special day! Click to see your birthday wishes",
              businessId,
              {
                staffId: row.id,
                type: 'birthday_celebration',
                metadata: {
                  kind: 'employee_birthday_celebration',
                  first_name: firstName,
                  business_name: businessName,
                },
              }
            );
          }
        }
      }

      if (isDemoWorkspaceBusiness(businessId)) {
        const { data: demoMgr, error: demoMgrErr } = await supabase
          .from('staff')
          .select('id, name, birth_month, birth_day, status')
          .eq('business_id', businessId)
          .eq('email', 'demo.manager@pethub.demo')
          .maybeSingle();
        const mgr = demoMgr as
          | {
              id: string;
              name: string;
              birth_month: number | null;
              birth_day: number | null;
              status: string | null;
            }
          | null;
        const mm = mgr?.birth_month != null ? Number(mgr.birth_month) : NaN;
        const md = mgr?.birth_day != null ? Number(mgr.birth_day) : NaN;
        if (
          !demoMgrErr &&
          mgr &&
          mgr.status === 'active' &&
          mm === month &&
          md === day
        ) {
          const { data: existingCeleb } = await supabase
            .from('notifications' as any)
            .select('id')
            .eq('user_id', uid)
            .eq('business_id', businessId)
            .eq('notification_type', 'birthday_celebration')
            .eq('staff_id', mgr.id)
            .gte('created_at', todayStart)
            .limit(1);
          if (!existingCeleb?.length) {
            const rawFirst = mgr.name.trim().split(/\s+/)[0];
            const firstName = rawFirst || mgr.name || 'Friend';
            const businessName =
              (settings.business_name && String(settings.business_name).trim()) || 'Demo';
            await createNotification(
              "🎂 Happy Birthday! It's your special day! Click to see your birthday wishes",
              businessId,
              {
                staffId: mgr.id,
                type: 'birthday_celebration',
                metadata: {
                  kind: 'employee_birthday_celebration',
                  first_name: firstName,
                  business_name: businessName,
                },
              }
            );
          }
        }
      }

      // Do not mark the day "done" if the RPC failed; otherwise we never retry staff/team birthday inserts until tomorrow.
      if (!rpcError) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, '1');
          }
        } catch {
          /* ignore */
        }
      }

      await fetchNotificationsRef.current();
      devConsole.debug('[pet-hub] Daily birthday job finished for business', businessId);
    };

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext6am = () => {
      if (cancelled) return;
      const delay = msUntilNextLocal6am();
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        void runDailyBirthdayJobs().finally(() => {
          if (!cancelled) scheduleNext6am();
        });
      }, delay);
    };

    void (async () => {
      if (cancelled) return;
      if (isDemoWorkspaceBusiness(businessId)) {
        const sk = `pet-hub-demo-mgr-dob-sync:${businessId}:${localDayKey(new Date())}`;
        try {
          if (typeof localStorage !== 'undefined' && localStorage.getItem(sk) !== '1') {
            const { ok, changed } = await syncDemoManagerBirthdayToClientToday(businessId);
            if (ok && changed && typeof localStorage !== 'undefined') {
              localStorage.removeItem(`pet-hub-daily-birthday-jobs:${businessId}:${localDayKey(new Date())}`);
            }
            if (ok && typeof localStorage !== 'undefined') localStorage.setItem(sk, '1');
          }
        } catch {
          /* ignore */
        }
      }

      if (cancelled) return;

      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKeyForDay()) !== '1') {
          if (!cancelled) await runDailyBirthdayJobs();
        } else if (!cancelled) {
          await fetchNotificationsRef.current();
        }
      } catch {
        if (!cancelled) await runDailyBirthdayJobs();
      }

      if (!cancelled) scheduleNext6am();
    })();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [
    user?.id,
    staffId,
    businessId,
    settings.notify_birthdays,
    settings.business_name,
    settings.timezone,
    createNotification,
    demoBrowseOnly,
  ]);

  /** Managers: daily reminder for active staff missing email (6am local, independent of birthday toggle). */
  useEffect(() => {
    if (!user?.id || !businessId) return;

    const runEmailReminderJob = async () => {
      const key = `pet-hub-daily-staff-email:${businessId}:${localDayKey(new Date())}`;
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1') {
          await fetchNotificationsRef.current();
          return;
        }
      } catch {
        /* ignore */
      }
      await dispatchStaffMissingEmailReminders(businessId);
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
      await fetchNotificationsRef.current();
    };

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext6am = () => {
      if (cancelled) return;
      const delay = msUntilNextLocal6am();
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        void runEmailReminderJob().finally(() => {
          if (!cancelled) scheduleNext6am();
        });
      }, delay);
    };

    const now = new Date();
    const dayKey = `pet-hub-daily-staff-email:${businessId}:${localDayKey(now)}`;
    if (now.getHours() >= 6) {
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(dayKey) !== '1') {
          void runEmailReminderJob();
        } else {
          void fetchNotificationsRef.current();
        }
      } catch {
        void runEmailReminderJob();
      }
    }

    scheduleNext6am();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [user?.id, businessId]);

  const markRead = async (id: string) => {
    if (!businessId) return;
    if (demoBrowseOnly && isDemoWorkspaceBusiness(businessId)) {
      markDemoBrowseNotificationRead(businessId, id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      return;
    }
    if (!user?.id) return;
    await supabase
      .from('notifications' as any)
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('business_id', businessId);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!businessId) return;
    if (demoBrowseOnly && isDemoWorkspaceBusiness(businessId)) {
      setNotifications((prev) => {
        markDemoBrowseNotificationsAllRead(
          businessId,
          prev.map((n) => n.id)
        );
        return prev.map((n) => ({ ...n, read: true }));
      });
      return;
    }
    if (!user?.id) return;
    const since = windowStartIso();
    await supabase
      .from('notifications' as any)
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .gte('created_at', since);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { notifications, loading, markRead, markAllRead, createNotification, refetch: fetchNotifications };
}
