import { getDemoStaffSeed, isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';

function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const readKey = (businessId: string) => `pet-hub-demo-browse-read:${businessId}:${localDayKey()}`;

export function getDemoBrowseReadIds(businessId: string): Set<string> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(readKey(businessId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function markDemoBrowseNotificationRead(businessId: string, id: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const s = getDemoBrowseReadIds(businessId);
  s.add(id);
  sessionStorage.setItem(readKey(businessId), JSON.stringify([...s]));
}

export function markDemoBrowseNotificationsAllRead(businessId: string, ids: string[]): void {
  if (typeof sessionStorage === 'undefined') return;
  const s = getDemoBrowseReadIds(businessId);
  for (const id of ids) s.add(id);
  sessionStorage.setItem(readKey(businessId), JSON.stringify([...s]));
}

/** Inbox rows for anonymous /demo so the bell can show a sample birthday workflow (no Supabase user). */
export function buildDemoBrowseSyntheticNotifications(
  businessId: string,
  notifyBirthdaysEnabled: boolean,
  businessName: string
): Array<{
  id: string;
  user_id: string;
  business_id: string;
  message: string;
  product_id: string | null;
  read: boolean;
  created_at: string;
  notification_type?: string | null;
  staff_id?: string | null;
  metadata?: unknown;
}> {
  if (!isDemoWorkspaceBusiness(businessId) || !notifyBirthdaysEnabled) return [];
  const mgr = getDemoStaffSeed().find((s) => s.access_role === 'admin' || s.access_role === 'manager');
  if (!mgr) return [];
  const n = new Date();
  if (mgr.birth_month !== n.getMonth() + 1 || mgr.birth_day !== n.getDate()) return [];
  const label = businessName.trim() || 'Demo';
  return [
    {
      id: 'demo-synthetic-birthday-team',
      user_id: '00000000-0000-0000-0000-000000000000',
      business_id: businessId,
      message: `🎉 Birthday Today! ${mgr.name}'s birthday is today!`,
      product_id: null,
      read: false,
      created_at: new Date().toISOString(),
      notification_type: 'birthday_team',
      staff_id: mgr.id,
      metadata: { kind: 'employee_birthday_team', employee_name: mgr.name, demo_browse: true },
    },
    {
      id: 'demo-synthetic-birthday-hint',
      user_id: '00000000-0000-0000-0000-000000000000',
      business_id: businessId,
      message: `Demo: Sign in to save staff birthdays and receive real notifications in ${label}.`,
      product_id: null,
      read: false,
      created_at: new Date().toISOString(),
      notification_type: 'general',
      staff_id: null,
      metadata: { demo_browse: true },
    },
  ];
}
