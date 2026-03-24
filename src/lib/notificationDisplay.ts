import { t } from '@/lib/translations';

export function parseNotificationMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export function getNotificationDisplayMessage(n: { message: string; metadata?: unknown }): string {
  const meta = parseNotificationMetadata(n.metadata);
  if (meta?.kind === 'employee_birthday_team' && typeof meta.employee_name === 'string') {
    return t('notifications.employeeBirthdayTeam', { name: meta.employee_name });
  }
  if (meta?.kind === 'employee_birthday_celebration' && typeof meta.first_name === 'string') {
    return t('notifications.employeeBirthdayCelebrationPreview', { name: meta.first_name });
  }
  return n.message;
}

export function getBirthdayCelebrationFromNotification(n: {
  metadata?: unknown;
  notification_type?: string | null;
  message?: string;
}): { firstName: string; businessName: string } | null {
  const meta = parseNotificationMetadata(n.metadata);
  if (meta?.kind === 'employee_birthday_celebration') {
    const firstName = meta.first_name;
    const businessName = meta.business_name;
    if (typeof firstName === 'string' && typeof businessName === 'string') {
      return { firstName, businessName };
    }
  }
  const raw = n.notification_type?.trim().toLowerCase();
  if (raw === 'birthday_celebration' && typeof n.message === 'string' && /birthday/i.test(n.message)) {
    return { firstName: 'Friend', businessName: 'Your team' };
  }
  return null;
}
