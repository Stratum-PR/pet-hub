import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DEMO_LANGUAGE_STORAGE_KEY } from '@/lib/authRouting';
import { Language, getLanguage, setLanguage as setLang } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/** Re-renders when `language` changes so `t()` calls across the subtree update immediately (no route remount). */
function LanguageSubtreeSync({ children }: { children: ReactNode }) {
  const ctx = useContext(LanguageContext);
  if (ctx === undefined) {
    throw new Error('LanguageSubtreeSync must be used within LanguageContext.Provider');
  }
  void ctx.language;
  return <>{children}</>;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    typeof window !== 'undefined' ? getLanguage() : 'es',
  );

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
    setLang(lang);
    setLanguageState(lang);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <LanguageSubtreeSync>{children}</LanguageSubtreeSync>
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
