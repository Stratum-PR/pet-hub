import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Language } from '@/lib/translations';

interface LanguageSwitcherProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

function UsFlagIcon({ className }: { className?: string }) {
  const h = 10 / 13;
  return (
    <svg
      className={className}
      viewBox="0 0 19 10"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} y={h * i} width="19" height={h} fill={i % 2 === 0 ? '#B22234' : '#fff'} />
      ))}
      <rect width="7.6" height={(7 / 13) * 10} fill="#3C3B6E" />
    </svg>
  );
}

function PrFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 30 20"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="30" height="4" fill="#ED1C24" />
      <rect y="4" width="30" height="4" fill="#fff" />
      <rect y="8" width="30" height="4" fill="#ED1C24" />
      <rect y="12" width="30" height="4" fill="#fff" />
      <rect y="16" width="30" height="4" fill="#ED1C24" />
      <path fill="#0050A4" d="M0 0 L12.5 10 0 20z" />
      <g transform="translate(4.15 10)">
        <path
          fill="#fff"
          d="M0,-2.35 0.69,-0.73 2.24,-0.73 1.1,0.43 1.58,2.33 0,1.43 -1.58,2.33 -1.1,0.43 -2.24,-0.73 -0.69,-0.73z"
        />
      </g>
    </svg>
  );
}

export function LanguageSwitcher({ variant = 'outline', size = 'default', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    const newLang: Language = language === 'en' ? 'es' : 'en';
    setLanguage(newLang);
  };

  const Flag = language === 'en' ? UsFlagIcon : PrFlagIcon;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleLanguage}
      className={`flex items-center gap-2 ${className}`}
      title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
    >
      <Flag className="h-4 w-auto shrink-0 rounded-sm border border-black/10 sm:hidden dark:border-white/15" />
      <Languages className="hidden h-4 w-4 shrink-0 sm:block" />
      <span className="font-medium">{language === 'en' ? 'EN' : 'ES'}</span>
    </Button>
  );
}
