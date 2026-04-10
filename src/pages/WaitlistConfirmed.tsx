import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { WaitlistSurvey } from '@/components/waitlist/WaitlistSurvey';
import { t } from '@/lib/translations';

const ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/waitlist/confirmed')!;

export function WaitlistConfirmed() {
  const [searchParams] = useSearchParams();
  const surveyToken = searchParams.get('survey_token')?.trim() ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40">
      <PageMeta route={ROUTE} />
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 md:p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#D4FF00]/20">
            <Check className="h-8 w-8 text-[#D4FF00]" strokeWidth={2.5} aria-hidden />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('waitlist.confirmedTitle')}</h1>
          <p className="text-lg text-white/90 mb-1">{t('waitlist.confirmedSubtitle')}</p>
          <p className="text-muted-foreground text-sm md:text-base mb-6">{t('waitlist.confirmedNext')}</p>
          <div className="border-t border-white/10 pt-6">
            {surveyToken ? (
              <>
                <p className="text-white font-medium">{t('waitlist.surveyIntro')}</p>
                <p className="text-sm text-muted-foreground mt-1 mb-2">{t('waitlist.surveyHint')}</p>
                <WaitlistSurvey surveyToken={surveyToken} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('waitlist.confirmedNoSurveyToken')}</p>
            )}
          </div>
          <Button asChild variant="outline" className="mt-8 rounded-full border-white/30 text-white hover:bg-white/10">
            <Link to="/">{t('waitlist.backHome')}</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
