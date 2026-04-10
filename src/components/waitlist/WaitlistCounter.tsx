import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';
import type { WaitlistStatsResponse } from '@/types/waitlist';

export function WaitlistCounter({ className = '' }: { className?: string }) {
  const { language } = useLanguage();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await waitlistFetch('waitlist-stats', { method: 'GET' });
        const data = (await res.json()) as WaitlistStatsResponse;
        if (!cancelled && typeof data.confirmedCount === 'number') {
          setCount(data.confirmedCount);
        }
      } catch {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) {
    return (
      <p className={`text-sm text-white/70 ${className}`} aria-live="polite">
        {language === 'es' ? 'Únete a groomers en PR que ya reservaron su lugar.' : 'Join groomers in PR who have already reserved their spot.'}
      </p>
    );
  }

  return (
    <p className={`text-sm text-white/90 ${className}`} aria-live="polite">
      {t('waitlist.socialProof', { n: String(count) })}
    </p>
  );
}
