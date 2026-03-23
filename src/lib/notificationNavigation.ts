import type { NotificationRow } from '@/hooks/useNotifications';

export type ResolvedNotificationType =
  | 'appointment'
  | 'pet'
  | 'inventory'
  | 'payment'
  | 'service'
  | 'birthday'
  | 'general';

export function resolveNotificationType(n: NotificationRow): ResolvedNotificationType {
  const raw = n.notification_type?.trim().toLowerCase();
  if (
    raw === 'appointment' ||
    raw === 'pet' ||
    raw === 'inventory' ||
    raw === 'payment' ||
    raw === 'service' ||
    raw === 'birthday'
  ) return raw;
  if (n.service_id) return 'service';
  if (n.transaction_id) return 'payment';
  if (n.appointment_id) return 'appointment';
  if (n.employee_id) return 'birthday';
  if (n.pet_id) return 'pet';
  if (n.product_id) return 'inventory';
  return 'general';
}

/** Target path for in-app navigation; supports both slug and non-slug routes (e.g. demo). */
export function getNotificationPath(n: NotificationRow, businessSlug?: string): string {
  const base = businessSlug ? `/${businessSlug}` : '';
  if (n.transaction_id) return `${base}/transactions/${n.transaction_id}`;
  if (n.service_id) return `${base}/services?service=${encodeURIComponent(n.service_id)}`;
  if (n.appointment_id) return `${base}/appointments?appointment=${encodeURIComponent(n.appointment_id)}`;
  if (n.employee_id) return `${base}/employee-management?employee=${encodeURIComponent(n.employee_id)}`;
  if (n.pet_id) return `${base}/pets?highlight=${encodeURIComponent(n.pet_id)}`;
  if (n.product_id) return `${base}/inventory?product=${encodeURIComponent(n.product_id)}`;
  return `${base}/dashboard`;
}
