export const DEMO_SETTINGS_STORAGE_PREFIX = 'pet-hub-demo-settings-';

/** Extra fields saved only in-browser for unauthenticated demo. */
export type DemoLocalExtra = {
  receipt_header?: string;
  receipt_footer?: string;
  business_phone?: string;
  business_address?: string;
  /** Serialized tax rows for demo-only persistence */
  demo_tax_rows?: string;
};

/** Merged `settings` row fields + demo-only extras (avoid importing Settings from useSupabaseData — circular). */
export type DemoStored = Record<string, string | null | undefined> & DemoLocalExtra;

export function demoSettingsStorageKey(businessId: string): string {
  return `${DEMO_SETTINGS_STORAGE_PREFIX}${businessId}`;
}

export function loadDemoStored(businessId: string): DemoStored {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(demoSettingsStorageKey(businessId));
    if (!raw) return {};
    return JSON.parse(raw) as DemoStored;
  } catch {
    return {};
  }
}

export function patchDemoStored(businessId: string, patch: Partial<DemoStored>) {
  if (typeof window === 'undefined') return;
  const prev = loadDemoStored(businessId);
  localStorage.setItem(demoSettingsStorageKey(businessId), JSON.stringify({ ...prev, ...patch }));
}

export function clearAllDemoStoredSettings() {
  if (typeof window === 'undefined') return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(DEMO_SETTINGS_STORAGE_PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}
