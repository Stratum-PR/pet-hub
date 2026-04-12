import { useEffect } from 'react';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/**
 * Loads Google Analytics (gtag.js) only when `VITE_GA_MEASUREMENT_ID` is set and the user opted into analytics cookies.
 */
export function ConditionalAnalytics() {
  const { analyticsCookiesAllowed } = useCookieConsent();

  useEffect(() => {
    if (!GA_ID || !analyticsCookiesAllowed) return;

    const w = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args);
    };
    w.gtag('js', new Date());
    w.gtag('config', GA_ID, { anonymize_ip: true });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(script);

    return () => {
      script.remove();
      delete w.gtag;
      w.dataLayer = [];
    };
  }, [analyticsCookiesAllowed]);

  return null;
}
