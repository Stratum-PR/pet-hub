import { DEMO_LANGUAGE_STORAGE_KEY } from '@/lib/authRouting';

/** Bump when cookie categories or privacy text materially change (must align with banner copy / privacy policy). */
export const COOKIE_POLICY_VERSION = '2026-04-12';

export const COOKIE_CONSENT_STORAGE_KEY = 'grumi_cookie_consent_v1';
const CONSENT_ANON_ID_KEY = 'grumi_consent_anon_id';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';

export type StoredCookieConsent = {
  policyVersion: string;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

function newAnonId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable pseudonymous id for consent log rows (not PII). */
export function getOrCreateConsentAnonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(CONSENT_ANON_ID_KEY);
    if (existing && existing.length >= 32) return existing;
    const id = newAnonId();
    window.localStorage.setItem(CONSENT_ANON_ID_KEY, id);
    return id;
  } catch {
    return newAnonId();
  }
}

export function readStoredCookieConsent(): StoredCookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCookieConsent>;
    if (
      typeof parsed.policyVersion !== 'string' ||
      typeof parsed.preferences !== 'boolean' ||
      typeof parsed.analytics !== 'boolean' ||
      typeof parsed.marketing !== 'boolean' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return {
      policyVersion: parsed.policyVersion,
      preferences: parsed.preferences,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeStoredCookieConsent(value: StoredCookieConsent): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function consentIsCurrent(value: StoredCookieConsent | null): boolean {
  return value != null && value.policyVersion === COOKIE_POLICY_VERSION;
}

/** UI persistence cookies (sidebar) and similar. */
export function preferenceCookiesAllowed(): boolean {
  const c = readStoredCookieConsent();
  return consentIsCurrent(c) && Boolean(c?.preferences);
}

export function analyticsCookiesAllowed(): boolean {
  const c = readStoredCookieConsent();
  return consentIsCurrent(c) && Boolean(c?.analytics);
}

export function marketingCookiesAllowed(): boolean {
  const c = readStoredCookieConsent();
  return consentIsCurrent(c) && Boolean(c?.marketing);
}

/** Clears preference-tier browser storage (not auth session). */
export function clearPreferenceTierStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('language');
    window.localStorage.removeItem(DEMO_LANGUAGE_STORAGE_KEY);
    window.localStorage.removeItem('pet-hub-theme');
    window.localStorage.removeItem('pet-hub-theme-demo');
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
  } catch {
    /* ignore */
  }
}
