import { isDemoWorkspaceBusiness } from '@/lib/demoStaffSeed';

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

/** Inbox rows for anonymous /demo (no Supabase user). Birthday samples removed — bell stays clean on demo. */
export function buildDemoBrowseSyntheticNotifications(
  businessId: string,
  _notifyBirthdaysEnabled: boolean,
  _businessName: string
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
  if (!isDemoWorkspaceBusiness(businessId)) return [];
  return [];
}
