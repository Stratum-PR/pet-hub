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
  /** `hero` = landing splash (light text on dark). `light` = marketing card surfaces. */
  surface?: 'hero' | 'light';
};

export function WaitlistForm({ className = '', animate = true, surface = 'hero' }: Props) {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
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

  const isLight = surface === 'light';
  const fieldBase = isLight
    ? 'h-11 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary'
    : 'h-11 rounded-xl border-white/30 bg-white/15 text-white placeholder:text-white/60 focus-visible:ring-[#D4FF00] sm:bg-white sm:text-slate-900 sm:placeholder:text-slate-400';
  const fieldError = error ? 'border-red-500 ring-1 ring-red-500 sm:border-red-500' : '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nameTrim = fullName.trim();
    const bizTrim = businessName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (nameTrim.length < 2 || bizTrim.length < 2) {
      setError(t('waitlist.errorRequiredProfile'));
      return;
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError(t('waitlist.errorInvalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const metadata: Record<string, string> = {};
      if (tier) metadata.pricing_tier = tier;
      const redirectAfterConfirm =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? window.location.origin
          : undefined;

      const res = await waitlistFetch('waitlist-signup', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          full_name: nameTrim,
          business_name: bizTrim,
          locale: language,
          source: 'website',
          ...utm,
          metadata: Object.keys(metadata).length ? metadata : undefined,
          ...(redirectAfterConfirm ? { redirect_after_confirm: redirectAfterConfirm } : {}),
        }),
      });
      let data: WaitlistSignupResponse & { messageKey?: string } = {};
      try {
        data = (await res.json()) as WaitlistSignupResponse & { messageKey?: string };
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg =
          data.messageKey && typeof data.messageKey === 'string' ? t(data.messageKey) : t('waitlist.errorGeneric');
        setError(msg);
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
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 ${
          isLight
            ? 'border-primary/25 bg-primary/5 text-foreground'
            : 'border-white/25 bg-white/10 text-white'
        } ${anim} ${className}`}
        role="status"
      >
        <Check className={`h-5 w-5 shrink-0 ${isLight ? 'text-primary' : 'text-[#D4FF00]'}`} strokeWidth={2.5} />
        <span className="text-center text-sm font-medium sm:text-base">{t('waitlist.successCheckEmail')}</span>
      </div>
    );
  }

  if (successKind === 'already') {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 ${
          isLight
            ? 'border-primary/25 bg-primary/5 text-foreground'
            : 'border-white/25 bg-white/10 text-white'
        } ${anim} ${className}`}
        role="status"
      >
        <Check className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.5} />
        <span className="text-center text-sm font-medium sm:text-base">{t('waitlist.alreadyRegistered')}</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className={`mx-auto w-full max-w-lg ${anim} ${className}`}
      noValidate
    >
      <div className="flex flex-col gap-3">
        <Input
          type="text"
          name="name"
          autoComplete="name"
          placeholder={t('waitlist.fullNamePlaceholder')}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
          className={`${fieldBase} ${fieldError}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'waitlist-form-error' : undefined}
        />
        <Input
          type="text"
          name="business"
          autoComplete="organization"
          placeholder={t('waitlist.businessNamePlaceholder')}
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          disabled={loading}
          className={`${fieldBase} ${fieldError}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'waitlist-form-error' : undefined}
        />
        <Input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('waitlist.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className={`${fieldBase} ${fieldError}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'waitlist-form-error' : undefined}
        />
        <Button
          type="submit"
          disabled={loading}
          className={`h-12 font-semibold sm:h-11 ${
            isLight
              ? 'rounded-xl bg-primary text-primary-foreground hover:bg-primary/90'
              : 'rounded-xl bg-[#D4FF00] text-black hover:bg-[#BFEF00]'
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <>
              {t('waitlist.submitCta')}
              <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {error ? (
        <p
          id="waitlist-form-error"
          className={`mt-2 text-center text-sm ${isLight ? 'text-destructive' : 'text-red-300 sm:text-left'}`}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
