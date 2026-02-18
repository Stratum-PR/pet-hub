import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationRow {
  id: string;
  user_id: string;
  business_id: string;
  message: string;
  product_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('notifications' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setNotifications((data as any[]) as NotificationRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const markRead = async (id: string) => {
    if (!user?.id) return;
    await supabase.from('notifications' as any).update({ read: true }).eq('id', id).eq('user_id', user.id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications' as any).update({ read: true }).eq('user_id', user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const createNotification = async (
    message: string,
    businessId: string,
    productId?: string | null
  ): Promise<boolean> => {
    if (!user?.id) return false;
    const { error } = await supabase.from('notifications' as any).insert({
      user_id: user.id,
      business_id: businessId,
      message,
      product_id: productId ?? null,
      read: false,
    });
    return !error;
  };

  return { notifications, loading, markRead, markAllRead, createNotification, refetch: fetchNotifications };
}
