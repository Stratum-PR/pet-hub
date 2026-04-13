import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SplashAuthModal } from '@/components/SplashAuthModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WaitlistSurvey } from '@/components/waitlist/WaitlistSurvey';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';
import { t } from '@/lib/translations';
import { waitlistFetch } from '@/lib/waitlistApi';
import type { WaitlistSignupResponse } from '@/types/waitlist';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  open: boolean;
  onClose: () => void;
  getPendingRef: () => string | undefined;
  pricingTier?: string;
  /** Preloaded by WaitlistModalProvider before the modal is shown */
  mascotSrc: string;
};

export function WaitlistJoinModal({ open, onClose, getPendingRef, pricingTier, mascotSrc }: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const grumiWordmarkSrc = useThemedGrumiWordmarkSrc();
  const completedSignupRef = useRef(false);

  const [step, setStep] = useState<'form' | 'referral' | 'survey'>('form');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyToken, setSurveyToken] = useState<string | null>(null);
  const [referralShareUrl, setReferralShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setFullName('');
    setBusinessName('');
    setEmail('');
    setReferralCodeInput(getPendingRef()?.trim() ?? '');
    setError(null);
    setLoading(false);
    setSurveyToken(null);
    setReferralShareUrl(null);
    completedSignupRef.current = false;
  }, [open, getPendingRef]);

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
      const urlRef = getPendingRef()?.trim();
      const typedRef = referralCodeInput.trim();
      const ref = (typedRef || urlRef || undefined)?.toLowerCase();
      const metadata: Record<string, string> = {};
      if (pricingTier) metadata.pricing_tier = pricingTier;
      const res = await waitlistFetch('waitlist-signup', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          full_name: nameTrim,
          business_name: bizTrim,
          locale: language,
          source: 'website',
          ...(ref ? { ref } : {}),
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
        setReferralShareUrl(
          typeof data.referral_share_url === 'string' ? data.referral_share_url : null,
        );
        setStep('referral');
      } else {
        setError(t('waitlist.errorGeneric'));
      }
    } catch {
      setError(t('waitlist.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }

  async function goToSurveyStep() {
    const token = surveyToken;
    if (!token) {
      setStep('survey');
      return;
    }
    try {
      await waitlistFetch('waitlist-schedule-admin-notify', {
        method: 'POST',
        body: JSON.stringify({ survey_token: token }),
      });
    } catch {
      /* still advance UX */
    }
    setStep('survey');
  }

  async function copyReferralLink() {
    if (!referralShareUrl) return;
    try {
      await navigator.clipboard.writeText(referralShareUrl);
      toast.success(t('waitlist.referralCopied'));
    } catch {
      toast.error(t('waitlist.errorGeneric'));
    }
  }

  const titleId = 'waitlist-join-modal-title';
  const title =
    step === 'form'
      ? t('waitlist.modalTitleJoin')
      : step === 'referral'
        ? t('waitlist.modalTitleReferral')
        : t('waitlist.modalTitleSurvey');

  return (
    <SplashAuthModal
      isOpen={open}
      onClose={handleModalClose}
      title={title}
      titleId={titleId}
      hideHeader
      closeButtonClassName="text-foreground/55 hover:bg-black/[0.06] hover:text-foreground"
      panelClassName="bg-muted/80 sm:bg-white"
      headerCenter={
        <img
          src={grumiWordmarkSrc}
          alt="Grumi"
          className="h-8 w-auto max-w-[min(200px,42vw)] object-contain object-center sm:h-12 md:h-14"
        />
      }
    >
      {step === 'form' ? (
        <div className="mx-auto w-full max-w-lg px-1 pb-1 pt-1 sm:px-0">
          <div className="mb-3 flex justify-center sm:mb-4">
            <img
              src={grumiWordmarkSrc}
              alt="Grumi"
              className="h-9 w-auto max-w-[min(220px,72vw)] object-contain object-center sm:h-10"
              decoding="async"
            />
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="relative" noValidate>
            <div className="pointer-events-none absolute -right-1 -top-[4.25rem] z-[2] h-[7.5rem] w-[7.5rem] sm:-right-2 sm:-top-[5rem] sm:h-[8.5rem] sm:w-[8.5rem]">
              <img
                src={mascotSrc}
                alt=""
                width={800}
                height={800}
                className="h-full w-full object-contain object-bottom drop-shadow-lg"
                aria-hidden
                decoding="async"
              />
            </div>

            <div className="relative z-[1] overflow-visible rounded-3xl border border-border/40 bg-card px-4 pb-4 pt-7 shadow-[0_18px_40px_rgba(0,0,0,0.08)] sm:px-6 sm:pb-5 sm:pt-8">
              <h2 className="text-center text-xl font-bold tracking-tight text-primary sm:text-2xl">
                {t('waitlist.cardTitle')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {t('waitlist.modalFormLead')}
              </p>
              <p className="mt-1 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
                {t('waitlist.founderLine')}
              </p>

              <div className="mt-5 flex flex-col gap-3.5 sm:mt-6 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-full-name" className="text-xs font-semibold text-foreground sm:text-sm">
                    {t('waitlist.labelFullName')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="waitlist-full-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder={t('waitlist.fullNamePlaceholder')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="h-10 rounded-xl border border-border/70 bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'waitlist-join-error' : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-business-name" className="text-xs font-semibold text-foreground sm:text-sm">
                    {t('waitlist.labelBusinessName')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="waitlist-business-name"
                    type="text"
                    name="business"
                    autoComplete="organization"
                    placeholder={t('waitlist.businessNamePlaceholder')}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={loading}
                    className="h-10 rounded-xl border border-border/70 bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'waitlist-join-error' : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-email" className="text-xs font-semibold text-foreground sm:text-sm">
                    {t('waitlist.labelEmail')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="waitlist-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t('waitlist.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-10 rounded-xl border border-border/70 bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'waitlist-join-error' : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-referral" className="text-xs font-semibold text-foreground sm:text-sm">
                    {t('waitlist.labelReferralCode')}
                    <span className="font-normal text-muted-foreground"> ({t('waitlist.optionalShort')})</span>
                  </Label>
                  <Input
                    id="waitlist-referral"
                    type="text"
                    name="referral_code"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('waitlist.referralCodePlaceholder')}
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    disabled={loading}
                    className="h-10 rounded-xl border border-border/70 bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    aria-describedby="waitlist-referral-code-hint"
                  />
                  <p id="waitlist-referral-code-hint" className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    {t('waitlist.referralCodeHint')}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-[#D4FF00] text-base font-semibold text-black hover:bg-[#BFEF00]"
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
            </div>

            {error ? (
              <p id="waitlist-join-error" className="mt-3 text-center text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      ) : step === 'referral' ? (
        <div className="space-y-6 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground text-center sm:text-left leading-relaxed">
            {t('waitlist.referralStepLead')}
          </p>

          {referralShareUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-50/90 via-white to-[#D4FF00]/12 p-5 shadow-md ring-1 ring-black/[0.04]">
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#D4FF00]/20 blur-2xl"
                aria-hidden
              />
              <div className="relative space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800/80">
                  {t('waitlist.referralBadge')}
                </p>
                <p className="text-sm font-semibold text-foreground">{t('waitlist.referralYourLink')}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('waitlist.referralExplain1')}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('waitlist.referralExplain2')}</p>
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white/80 p-3 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 break-all font-mono text-xs text-foreground sm:text-sm">
                    {referralShareUrl}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold"
                    onClick={() => void copyReferralLink()}
                  >
                    <Copy className="w-4 h-4 mr-1.5" aria-hidden />
                    {t('waitlist.referralCopy')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex justify-center">
            <Button
              type="button"
              className="h-12 rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-8 shadow-md"
              onClick={() => void goToSurveyStep()}
            >
              {t('waitlist.continueToSurvey')}
              <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-foreground text-center sm:text-left">{t('waitlist.surveyIntro')}</p>

          {surveyToken ? (
            <WaitlistSurvey surveyToken={surveyToken} onFinished={finishFlow} />
          ) : null}
        </div>
      )}
    </SplashAuthModal>
  );
}
