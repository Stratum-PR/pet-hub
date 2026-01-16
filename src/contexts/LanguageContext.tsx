import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getLanguage, setLanguage as setLang } from '@/lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getLanguage());

  useEffect(() => {
    // Listen for language changes via custom event
    const handleLanguageChange = () => {
      const currentLang = getLanguage();
      setLanguageState(currentLang);
    };

    window.addEventListener('languagechange', handleLanguageChange);
    
    // Also listen for storage events (for cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'language') {
        setLanguageState((e.newValue as Language) || 'en');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('languagechange', handleLanguageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLang(lang);
    setLanguageState(lang);
    // Trigger a custom event to notify all components
    window.dispatchEvent(new Event('languagechange'));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
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
