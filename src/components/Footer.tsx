import { Link } from 'react-router-dom';
import { t } from '@/lib/translations';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { openPreferences } = useCookieConsent();
  useLanguage();

  return (
    <footer className="border-t mt-12 bg-muted/30">
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Powered by</span>
          <a
            href="https://www.stratumpr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center hover:opacity-90 transition-opacity shrink-0"
          >
            <img
              src="/Logo 4.svg"
              alt="STRATUM PR LLC"
              className="object-contain h-6 w-auto max-w-[100px] cursor-pointer"
            />
          </a>
        </div>
        <nav
          className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground"
          aria-label="Legal"
        >
          <Link to="/terms" className="hover:text-foreground underline-offset-2 hover:underline">
            {t('footer.termsOfUse')}
          </Link>
          <span className="text-muted-foreground/50 select-none" aria-hidden>
            ·
          </span>
          <Link to="/website-terms" className="hover:text-foreground underline-offset-2 hover:underline">
            {t('footer.websiteTerms')}
          </Link>
          <span className="text-muted-foreground/50 select-none" aria-hidden>
            ·
          </span>
          <Link to="/privacy" className="hover:text-foreground underline-offset-2 hover:underline">
            {t('footer.privacyPolicy')}
          </Link>
          <span className="text-muted-foreground/50 select-none" aria-hidden>
            ·
          </span>
          <Link to="/cookie-notice" className="hover:text-foreground underline-offset-2 hover:underline">
            {t('footer.cookieNotice')}
          </Link>
          <span className="text-muted-foreground/50 select-none" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => openPreferences()}
            className="hover:text-foreground underline-offset-2 hover:underline bg-transparent p-0 font-inherit text-inherit"
          >
            {t('footer.cookieSettings')}
          </button>
        </nav>
        <div className="text-[10px] text-muted-foreground">© 2026 STRATUM PR LLC</div>
      </div>
    </footer>
  );
}

