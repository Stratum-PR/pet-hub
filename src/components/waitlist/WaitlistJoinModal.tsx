import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { WaitlistSurvey } from '@/components/waitlist/WaitlistSurvey';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';
import type { WaitlistSignupResponse } from '@/types/waitlist';
import { cn } from '@/lib/utils';

/** Aligned with `waitlist-signup` edge function — local part, @, domain with dot and 2+ char TLD. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidSignupEmail(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) return false;
  const at = s.lastIndexOf('@');
  if (at < 1) return false;
  const domain = s.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return false;
  const labels = domain.split('.');
  const tld = labels[labels.length - 1] ?? '';
  return tld.length >= 2 && labels.every((part) => part.length > 0);
}

function FloatingLabeledInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  name,
  autoComplete,
  inputMode,
  disabled,
  invalid,
  wrapperClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
  invalid?: boolean;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        name={name}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-14 w-full rounded-xl border border-border bg-background/90 px-3 text-base shadow-sm transition-colors',
          'placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
        )}
        aria-invalid={invalid}
      />
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  pricingTier?: string;
  /** Preloaded by WaitlistModalProvider before the modal is shown */
  mascotSrc: string;
};

export function WaitlistJoinModal({ open, onClose, pricingTier, mascotSrc }: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const completedSignupRef = useRef(false);

  const [step, setStep] = useState<'form' | 'survey'>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyToken, setSurveyToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setFirstName('');
    setLastName('');
    setBusinessName('');
    setEmail('');
    setError(null);
    setLoading(false);
    setSurveyToken(null);
    completedSignupRef.current = false;
  }, [open]);

  const finishFlow = useCallback(() => {
    navigate('/', { replace: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onClose();
  }, [navigate, onClose]);

  const handleModalClose = useCallback(() => {
    if (completedSignupRef.current) {
      finishFlow();
      return;
    }
    onClose();
  }, [finishFlow, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fn = firstName.trim();
    const ln = lastName.trim();
    const bizRaw = businessName.trim();
    const businessPayload = bizRaw.length >= 2 ? bizRaw : '';
    const trimmedEmail = email.trim().toLowerCase();
    const fullNameCombined = `${fn} ${ln}`.trim();
    if (fn.length < 1 || ln.length < 1) {
      setError(t('waitlist.errorRequiredProfile'));
      return;
    }
    if (fullNameCombined.length < 2) {
      setError(t('waitlist.errorRequiredProfile'));
      return;
    }
    if (!trimmedEmail || !isValidSignupEmail(trimmedEmail)) {
      setError(t('waitlist.errorInvalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const metadata: Record<string, string> = {};
      if (pricingTier) metadata.pricing_tier = pricingTier;
      const res = await waitlistFetch('waitlist-signup', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          full_name: fullNameCombined,
          business_name: businessPayload,
          locale: language,
          source: 'website',
          ...(Object.keys(metadata).length ? { metadata } : {}),
        }),
      });
      let data: WaitlistSignupResponse = {};
      try {
        data = (await res.json()) as WaitlistSignupResponse;
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
        toast.info(t('waitlist.alreadyRegistered'));
        onClose();
        return;
      }
      if (data.survey_token && typeof data.survey_token === 'string') {
        completedSignupRef.current = true;
        setSurveyToken(data.survey_token);
        try {
          await waitlistFetch('waitlist-schedule-admin-notify', {
            method: 'POST',
            body: JSON.stringify({ survey_token: data.survey_token }),
          });
        } catch {
          /* still advance UX */
        }
        setStep('survey');
      } else {
        setError(t('waitlist.errorGeneric'));
      }
    } catch {
      setError(t('waitlist.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  const titleId = 'waitlist-join-modal-title';
  const dialogTitle = step === 'form' ? t('waitlist.cardTitle') : t('waitlist.modalTitleSurvey');
  const businessFieldLabel = `${t('waitlist.labelBusinessName')} (${t('waitlist.optionalShort')})`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleModalClose();
      }}
    >
      <DialogContent
        className={cn(
          /* Do not add `relative` here — tailwind-merge drops `fixed` from DialogContent and the panel vanishes behind the overlay. */
          'border border-border bg-card text-card-foreground shadow-xl',
          step === 'form'
            ? 'w-[calc(100vw-2rem)] max-w-md gap-0 overflow-visible p-0 pt-7 sm:w-full sm:pt-8'
            : 'max-h-[min(90vh,720px)] gap-4 overflow-y-auto p-6 sm:max-w-md',
        )}
        aria-labelledby={titleId}
      >
        {step === 'form' ? (
          <div className="relative overflow-visible">
            {/* Scroll only the card body so the mascot can paint outside the panel without clipping */}
            <div className="max-h-[min(92dvh,880px)] overflow-y-auto overscroll-y-contain px-5 pb-8 pt-0 sm:px-8 sm:pb-10">
              <DialogHeader className="space-y-3 border-b border-border pb-5 text-center sm:text-center">
                <DialogTitle
                  id={titleId}
                  className="pr-10 text-xl font-semibold leading-snug tracking-tight text-foreground sm:pr-8 sm:text-2xl md:text-3xl"
                >
                  {dialogTitle}
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-center text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
                    {t('waitlist.founderLineBefore')}
                    <strong className="font-bold text-foreground">{t('waitlist.founderLineBold')}</strong>
                    {t('waitlist.founderLineAfter')}
                  </p>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={(e) => void onSubmit(e)} className="relative z-[1] space-y-4 pt-5" noValidate>
                <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 min-[400px]:gap-3">
                  <FloatingLabeledInput
                    id="waitlist-first-name"
                    label={`${t('waitlist.labelFirstName')} *`}
                    value={firstName}
                    onChange={setFirstName}
                    name="given-name"
                    autoComplete="given-name"
                    disabled={loading}
                    invalid={Boolean(error)}
                  />
                  <FloatingLabeledInput
                    id="waitlist-last-name"
                    label={`${t('waitlist.labelLastName')} *`}
                    value={lastName}
                    onChange={setLastName}
                    name="family-name"
                    autoComplete="family-name"
                    disabled={loading}
                    invalid={Boolean(error)}
                  />
                </div>
                <FloatingLabeledInput
                  id="waitlist-email"
                  label={`${t('waitlist.labelEmail')} *`}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  disabled={loading}
                  invalid={Boolean(error)}
                />
                <FloatingLabeledInput
                  id="waitlist-business-name"
                  label={businessFieldLabel}
                  value={businessName}
                  onChange={setBusinessName}
                  name="organization"
                  autoComplete="organization"
                  disabled={loading}
                  invalid={Boolean(error)}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-10 w-full rounded-xl bg-[#D4FF00] text-sm font-semibold text-black hover:bg-[#BFEF00] sm:text-base"
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

                {error ? (
                  <p id="waitlist-join-error" className="text-center text-sm font-medium text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </form>
            </div>

            <img
              src={mascotSrc}
              alt=""
              width={256}
              height={256}
              className="pointer-events-none absolute bottom-0 left-0 z-[70] h-[8.5rem] w-[8.5rem] -translate-x-[32%] translate-y-[48%] select-none object-contain drop-shadow-xl sm:h-[9.25rem] sm:w-[9.25rem] sm:-translate-x-[28%] sm:translate-y-[52%]"
              aria-hidden
              decoding="async"
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle id={titleId}>{dialogTitle}</DialogTitle>
              <DialogDescription>{t('waitlist.surveyIntro')}</DialogDescription>
            </DialogHeader>
            {surveyToken ? <WaitlistSurvey surveyToken={surveyToken} onFinished={finishFlow} /> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
