import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_POLICY_VERSION,
  clearPreferenceTierStorage,
  consentIsCurrent,
  getOrCreateConsentAnonId,
  readStoredCookieConsent,
  writeStoredCookieConsent,
  type StoredCookieConsent,
} from '@/lib/cookieConsent';
import { postCookieConsentRecord } from '@/lib/cookieConsentApi';
import { useLanguage } from '@/contexts/LanguageContext';

type Draft = Pick<StoredCookieConsent, 'preferences' | 'analytics' | 'marketing'>;

type CookieConsentContextValue = {
  consent: StoredCookieConsent | null;
  needsBanner: boolean;
  /** First-visit modal: user opened category toggles (Settings, or Cookie settings from the footer). */
  bannerGranularOpen: boolean;
  preferenceCookiesAllowed: boolean;
  analyticsCookiesAllowed: boolean;
  marketingCookiesAllowed: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  dismissBannerGranular: () => void;
  preferencesOpen: boolean;
  draft: Draft;
  setDraft: (next: Partial<Draft>) => void;
  acceptAll: () => void;
  rejectOptional: () => void;
  saveCustom: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function buildConsent(draft: Draft): StoredCookieConsent {
  return {
    ...draft,
    policyVersion: COOKIE_POLICY_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

async function syncBackend(
  draft: Draft,
  locale: 'en' | 'es',
): Promise<void> {
  const anonymous_id = getOrCreateConsentAnonId();
  if (!anonymous_id) return;
  await postCookieConsentRecord({
    anonymous_id,
    policy_version: COOKIE_POLICY_VERSION,
    preferences: draft.preferences,
    analytics: draft.analytics,
    marketing: draft.marketing,
    locale,
  });
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const [consent, setConsent] = useState<StoredCookieConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [bannerGranularOpen, setBannerGranularOpen] = useState(false);
  const [draft, setDraftState] = useState<Draft>({
    preferences: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (import.meta.env.DEV) {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('cookieBanner')) {
          window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
          params.delete('cookieBanner');
          const next = params.toString();
          const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`;
          window.history.replaceState(null, '', url);
        }
      } catch {
        /* ignore */
      }
    }
    setConsent(readStoredCookieConsent());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (consentIsCurrent(consent)) {
      setBannerGranularOpen(false);
    }
  }, [consent, hydrated]);

  const needsBanner = hydrated && !consentIsCurrent(consent);

  const applyAndPersist = useCallback(
    (nextDraft: Draft) => {
      const next = buildConsent(nextDraft);
      writeStoredCookieConsent(next);
      setConsent(next);
      if (!next.preferences) {
        clearPreferenceTierStorage();
      }
      void syncBackend(nextDraft, language);
    },
    [language],
  );

  const setDraft = useCallback((partial: Partial<Draft>) => {
    setDraftState((d) => ({ ...d, ...partial }));
  }, []);

  const openPreferences = useCallback(() => {
    const base = consentIsCurrent(consent) ? consent : null;
    setDraftState({
      preferences: base?.preferences ?? false,
      analytics: base?.analytics ?? false,
      marketing: base?.marketing ?? false,
    });
    if (!consentIsCurrent(consent)) {
      setBannerGranularOpen(true);
    } else {
      setPreferencesOpen(true);
    }
  }, [consent]);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
  }, []);

  const dismissBannerGranular = useCallback(() => {
    setBannerGranularOpen(false);
  }, []);

  const acceptAll = useCallback(() => {
    const nextDraft: Draft = { preferences: true, analytics: true, marketing: true };
    applyAndPersist(nextDraft);
    setDraftState(nextDraft);
    setPreferencesOpen(false);
    setBannerGranularOpen(false);
  }, [applyAndPersist]);

  const rejectOptional = useCallback(() => {
    const nextDraft: Draft = { preferences: false, analytics: false, marketing: false };
    applyAndPersist(nextDraft);
    setDraftState(nextDraft);
    setPreferencesOpen(false);
    setBannerGranularOpen(false);
  }, [applyAndPersist]);

  const saveCustom = useCallback(() => {
    applyAndPersist(draft);
    setPreferencesOpen(false);
    setBannerGranularOpen(false);
  }, [applyAndPersist, draft]);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      needsBanner,
      bannerGranularOpen,
      preferenceCookiesAllowed:
        consentIsCurrent(consent) && Boolean(consent?.preferences),
      analyticsCookiesAllowed: consentIsCurrent(consent) && Boolean(consent?.analytics),
      marketingCookiesAllowed: consentIsCurrent(consent) && Boolean(consent?.marketing),
      openPreferences,
      closePreferences,
      dismissBannerGranular,
      preferencesOpen,
      draft,
      setDraft,
      acceptAll,
      rejectOptional,
      saveCustom,
    }),
    [
      consent,
      needsBanner,
      bannerGranularOpen,
      openPreferences,
      closePreferences,
      dismissBannerGranular,
      preferencesOpen,
      draft,
      setDraft,
      acceptAll,
      rejectOptional,
      saveCustom,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within CookieConsentProvider');
  }
  return ctx;
}
