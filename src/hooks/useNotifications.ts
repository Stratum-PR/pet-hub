import { useState, useEffect, useCallback, useRef } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useSettings } from '@/hooks/useSupabaseData';
import { getDemoStaffSeed, isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';

function isPublicDemoPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/demo' || p.startsWith('/demo/');
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

export function useNotifications() {
  const { user, staffId } = useAuth();
  const businessId = useBusinessId();
  const { settings } = useSettings();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !businessId) {
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
  }, [user?.id, businessId]);

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
      if (error && import.meta.env.DEV) {
        console.warn('[useNotifications] createNotification insert failed:', error.message);
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
    if (!user?.id || !businessId || !asEnabled(settings.notify_birthdays, true)) return;
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), day).toISOString();
    const uid = user.id;
    const run = async () => {
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
              ? ` (${Math.max(0, now.getFullYear() - p.birth_year)} yrs)`
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
      if (rpcError && import.meta.env.DEV) {
        console.warn('[useNotifications] dispatch_staff_birthdays_for_business:', rpcError.message);
      }

      /** Client-side celebration so the signed-in user always gets a notice when their linked staff row matches today. */
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
              (settings.business_name && String(settings.business_name).trim()) || 'Pet Hub';
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

      if (isPublicDemoPath() && isDemoWorkspaceBusiness(businessId)) {
        const manager = getDemoStaffSeed().find(
          (s) => s.access_role === 'manager' && s.birth_month === month && s.birth_day === day
        );
        if (manager) {
          const { data: existingCeleb } = await supabase
            .from('notifications' as any)
            .select('id')
            .eq('user_id', uid)
            .eq('business_id', businessId)
            .eq('notification_type', 'birthday_celebration')
            .eq('staff_id', manager.id)
            .gte('created_at', todayStart)
            .limit(1);
          if (!existingCeleb?.length) {
            const rawFirst = manager.name.trim().split(/\s+/)[0];
            const firstName = rawFirst || manager.name || 'Friend';
            const businessName =
              (settings.business_name && String(settings.business_name).trim()) || 'Demo';
            await createNotification(
              "🎂 Happy Birthday! It's your special day! Click to see your birthday wishes",
              businessId,
              {
                staffId: manager.id,
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

      await fetchNotificationsRef.current();
    };
    run();
  }, [
    user?.id,
    staffId,
    businessId,
    settings.notify_birthdays,
    settings.business_name,
    createNotification,
  ]);

  const markRead = async (id: string) => {
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
    if (!user?.id || !businessId) return;
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
