import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { WaitlistSurvey } from '@/components/waitlist/WaitlistSurvey';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { t } from '@/lib/translations';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/waitlist/confirmed')!;

export function WaitlistConfirmed() {
  const [searchParams] = useSearchParams();
  const surveyToken = searchParams.get('survey_token')?.trim() ?? '';

  return (
    <div className="min-h-screen flex flex-col relative">
      <PageMeta route={ROUTE} />

      <section className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-teal-900/80 to-slate-900/90">
          <img
            src="/hero_background.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-right md:object-center"
            aria-hidden
          />
          <div className="absolute inset-0 bg-black/[0.125] pointer-events-none" aria-hidden />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: 'rgba(140, 125, 100, 0.22)' }}
            aria-hidden
          />
        </div>
      </section>

      <div
        className="fixed inset-0 z-[1] animate-backdrop-blur-in bg-transparent pointer-events-none"
        aria-hidden
      />

      <header className="relative z-50 flex justify-center pt-3 px-4">
        <nav className="container mx-auto max-w-5xl w-full">
          <div className="flex items-center justify-between gap-4 rounded-full border border-white/30 bg-white/60 backdrop-blur-xl px-4 py-2 sm:px-6 sm:py-3 shadow-lg shadow-black/10">
            <Link
              to="/"
              className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4FF00] rounded-full"
            >
              <img src="/pet-hub-icon.svg" alt="" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
              <span className="text-slate-900 font-semibold text-lg sm:text-xl">Grumi</span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher
                variant="ghost"
                size="sm"
                className="text-slate-900 hover:bg-white/70 hover:text-slate-900"
              />
            </div>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex flex-col items-center flex-1 px-4 pt-24 pb-16">
        <div
          className="w-full max-w-2xl rounded-3xl bg-white/65 backdrop-blur-xl border border-white/40 shadow-2xl px-6 py-8 md:px-10 md:py-10"
          style={{
            boxShadow: '0 32px 64px rgba(0,0,0,0.18), 0 0 1px rgba(255,255,255,0.5)',
          }}
        >
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#D4FF00]/90 shadow-md shadow-[#D4FF00]/25">
              <Check className="h-8 w-8 text-slate-900" strokeWidth={2.5} aria-hidden />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              {t('waitlist.confirmedTitle')}
            </h1>
            <p className="text-lg font-medium text-slate-800 mb-1">{t('waitlist.confirmedSubtitle')}</p>
            <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
              {t('waitlist.confirmedNext')}
            </p>
          </div>

          {surveyToken ? (
            <div className="mt-8 pt-8 border-t border-border/60">
              <p className="text-center text-slate-900 font-semibold text-base md:text-lg">
                {t('waitlist.surveyIntro')}
              </p>
              <p className="text-center text-muted-foreground text-sm mt-2 mb-6 max-w-md mx-auto">
                {t('waitlist.surveyHint')}
              </p>
              <WaitlistSurvey surveyToken={surveyToken} />
            </div>
          ) : (
            <p className="mt-8 pt-8 border-t border-border/60 text-center text-sm text-muted-foreground">
              {t('waitlist.confirmedNoSurveyToken')}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <Button
              asChild
              className="rounded-full bg-[#D4FF00] text-black hover:bg-[#BFEF00] font-semibold px-8 shadow-md"
            >
              <Link to="/">{t('waitlist.backHome')}</Link>
            </Button>
          </div>
        </div>
      </main>

      <div className="relative z-10 mt-auto">
        <Footer />
      </div>
    </div>
  );
}
