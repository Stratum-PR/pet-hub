import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';
import type { WaitlistSignupResponse } from '@/types/waitlist';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  className?: string;
  /** When false, skip entrance animation classes (e.g. in modal). */
  animate?: boolean;
};

export function WaitlistForm({ className = '', animate = true }: Props) {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successKind, setSuccessKind] = useState<'confirm' | 'already' | null>(null);

  const utm = useMemo(() => {
    return {
      utm_source: searchParams.get('utm_source') ?? undefined,
      utm_medium: searchParams.get('utm_medium') ?? undefined,
      utm_campaign: searchParams.get('utm_campaign') ?? undefined,
    };
  }, [searchParams]);

  const tier = searchParams.get('tier') ?? undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError(t('waitlist.errorInvalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const metadata: Record<string, string> = {};
      if (tier) metadata.pricing_tier = tier;
      const res = await waitlistFetch('waitlist-signup', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmed,
          locale: language,
          source: 'website',
          ...utm,
          metadata: Object.keys(metadata).length ? metadata : undefined,
        }),
      });
      const data = (await res.json()) as WaitlistSignupResponse;
      if (!res.ok) {
        setError(t('waitlist.errorGeneric'));
        return;
      }
      if (data.alreadyRegistered) {
        setSuccessKind('already');
      } else {
        setSuccessKind('confirm');
      }
    } catch {
      setError(t('waitlist.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  const anim = animate ? 'opacity-0 motion-reduce:!opacity-100 animate-cta-reveal' : '';

  if (successKind === 'confirm') {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-white ${anim} ${className}`}
        role="status"
      >
        <Check className="h-5 w-5 shrink-0 text-[#D4FF00]" strokeWidth={2.5} />
        <span className="text-sm sm:text-base font-medium text-center">{t('waitlist.successCheckEmail')}</span>
      </div>
    );
  }

  if (successKind === 'already') {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-white ${anim} ${className}`}
        role="status"
      >
        <Check className="h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2.5} />
        <span className="text-sm sm:text-base font-medium text-center">{t('waitlist.alreadyRegistered')}</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={`w-full max-w-lg mx-auto ${anim} ${className}`}
      noValidate
    >
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:rounded-xl sm:overflow-hidden sm:border sm:border-white/25 sm:bg-white/95 sm:shadow-lg">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('waitlist.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className={`min-w-0 h-12 sm:h-14 rounded-xl sm:rounded-none border-white/30 bg-white/15 sm:bg-white text-white sm:text-slate-900 placeholder:text-white/60 sm:placeholder:text-slate-400 focus-visible:ring-[#D4FF00] ${
            error ? 'border-red-400 ring-1 ring-red-400' : ''
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'waitlist-email-error' : undefined}
        />
        <Button
          type="submit"
          disabled={loading}
          className="h-12 sm:h-14 shrink-0 rounded-xl sm:rounded-none px-6 font-semibold text-black bg-[#D4FF00] hover:bg-[#BFEF00] sm:px-8"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <>
              {t('waitlist.submitCta')}
              <ArrowRight className="ml-2 h-4 w-4 inline" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p id="waitlist-email-error" className="mt-2 text-sm text-red-300 text-center sm:text-left">
          {error}
        </p>
      ) : null}
    </form>
  );
}
