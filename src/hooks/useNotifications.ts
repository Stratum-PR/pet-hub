import { useState, useEffect, useCallback } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useSettings } from '@/hooks/useSupabaseData';

export type NotificationType =
  | 'general'
  | 'appointment'
  | 'pet'
  | 'inventory'
  | 'payment'
  | 'service'
  | 'birthday';

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
  employee_id?: string | null;
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
  employeeId?: string | null;
  type?: NotificationType;
}

function asEnabled(raw: string | null | undefined, fallback = true): boolean {
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

export function useNotifications() {
  const { user } = useAuth();
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

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id || !businessId || !asEnabled(settings.notify_birthdays, true)) return;
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const run = async () => {
      // Uses birth_month only for now because pets don't store day-of-month.
      const { data: pets, error } = await supabase
        .from('pets')
        .select('id, name, birth_month, birth_year')
        .eq('business_id', businessId)
        .eq('birth_month', month);
      if (error || !pets || pets.length === 0) return;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), day).toISOString();
      for (const p of pets as Array<{ id: string; name: string; birth_month: number | null; birth_year: number | null }>) {
        const { data: existing } = await supabase
          .from('notifications' as any)
          .select('id')
          .eq('user_id', user.id)
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

      // Employee birthdays: match month + exact day.
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id, name, birth_month, birth_day')
        .eq('business_id', businessId)
        .eq('birth_month', month)
        .eq('birth_day', day);

      if (!employeeError && employees && employees.length > 0) {
        for (const emp of employees as Array<{ id: string; name: string; birth_month: number | null; birth_day: number | null }>) {
          const { data: existing } = await supabase
            .from('notifications' as any)
            .select('id')
            .eq('user_id', user.id)
            .eq('business_id', businessId)
            .eq('notification_type', 'birthday')
            .eq('employee_id', emp.id)
            .gte('created_at', todayStart)
            .limit(1);
          if (existing && existing.length > 0) continue;

          await createNotification(`Birthday reminder: ${emp.name}.`, businessId, {
            employeeId: emp.id,
            type: 'birthday',
          });
        }
      }
    };
    run();
  }, [user?.id, businessId, settings.notify_birthdays]);

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

  const createNotification = async (
    message: string,
    businessId: string,
    options?: CreateNotificationOptions
  ): Promise<boolean> => {
    if (!user?.id) return false;
    const type = options?.type ?? 'general';
    const enabledByType: Record<NotificationType, boolean> = {
      appointment: asEnabled(settings.notify_appointment_unbilled, true),
      inventory: asEnabled(settings.notify_inventory_low_stock, true),
      payment: asEnabled(settings.notify_payment_overdue, true),
      birthday: asEnabled(settings.notify_birthdays, true),
      general: asEnabled(settings.notify_general, true),
      pet: asEnabled(settings.notify_general, true),
      service: asEnabled(settings.notify_general, true),
    };
    if (!enabledByType[type]) return false;
    const payload: Record<string, unknown> = {
      user_id: user.id,
      business_id: businessId,
      message,
      read: false,
    };
    payload.notification_type = type;
    if (options?.productId) payload.product_id = options.productId;
    if (options?.appointmentId) payload.appointment_id = options.appointmentId;
    if (options?.petId) payload.pet_id = options.petId;
    if (options?.transactionId) payload.transaction_id = options.transactionId;
    if (options?.serviceId) payload.service_id = options.serviceId;
    if (options?.employeeId) payload.employee_id = options.employeeId;
    const { error } = await supabase.from('notifications' as any).insert(payload);
    return !error;
  };

  return { notifications, loading, markRead, markAllRead, createNotification, refetch: fetchNotifications };
}
