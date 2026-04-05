import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DEMO_LANGUAGE_STORAGE_KEY } from '@/lib/authRouting';
import { Language, getLanguage, setLanguage as setLang, t } from '@/lib/translations';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/** Minimum time the paw overlay stays visible so the switch feels intentional. */
const MIN_LANGUAGE_SWITCH_MS = 380;

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    typeof window !== 'undefined' ? getLanguage() : 'es',
  );
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguageState(getLanguage());
    };

    window.addEventListener('languagechange', handleLanguageChange);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'language' || e.key === DEMO_LANGUAGE_STORAGE_KEY) {
        setLanguageState(getLanguage());
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    if (typeof window !== 'undefined' && lang === getLanguage()) return;
    setSwitching(true);
    setLang(lang);
    setLanguageState(lang);
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    const finish = () => {
      const elapsed = typeof performance !== 'undefined' ? performance.now() - started : MIN_LANGUAGE_SWITCH_MS;
      const rest = Math.max(0, MIN_LANGUAGE_SWITCH_MS - elapsed);
      window.setTimeout(() => setSwitching(false), rest);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(finish);
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
      {switching && typeof document !== 'undefined'
        ? createPortal(
            <PawStagedLoadingFullscreen label={t('common.switchingLanguage')} zIndex={10100} />,
            document.body,
          )
        : null}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
