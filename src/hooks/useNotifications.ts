import { useState, useEffect, useCallback } from 'react';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationType = 'general' | 'appointment' | 'pet' | 'inventory' | 'payment';

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
  type?: NotificationType;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
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
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (!error && data) setNotifications((data as any[]) as NotificationRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    if (!user?.id) return;
    await supabase.from('notifications' as any).update({ read: true }).eq('id', id).eq('user_id', user.id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const since = windowStartIso();
    await supabase
      .from('notifications' as any)
      .update({ read: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const createNotification = async (
    message: string,
    businessId: string,
    options?: CreateNotificationOptions
  ): Promise<boolean> => {
    if (!user?.id) return false;
    const payload: Record<string, unknown> = {
      user_id: user.id,
      business_id: businessId,
      message,
      read: false,
    };
    const type = options?.type ?? 'general';
    payload.notification_type = type;
    if (options?.productId) payload.product_id = options.productId;
    if (options?.appointmentId) payload.appointment_id = options.appointmentId;
    if (options?.petId) payload.pet_id = options.petId;
    if (options?.transactionId) payload.transaction_id = options.transactionId;
    const { error } = await supabase.from('notifications' as any).insert(payload);
    return !error;
  };

  return { notifications, loading, markRead, markAllRead, createNotification, refetch: fetchNotifications };
}
