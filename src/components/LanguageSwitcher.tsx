import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/lib/translations';

interface LanguageSwitcherProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function LanguageSwitcher({ variant = 'outline', size = 'default', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    const newLang: Language = language === 'en' ? 'es' : 'en';
    setLanguage(newLang);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleLanguage}
      className={`flex items-center gap-2 ${className}`}
      title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
    >
      <Languages className="w-4 h-4" />
      <span className="font-medium">{language === 'en' ? 'EN' : 'ES'}</span>
    </Button>
  );
}
