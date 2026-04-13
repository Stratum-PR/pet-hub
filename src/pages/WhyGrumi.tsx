import { useState } from 'react';
import { Check } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { Footer } from '@/components/Footer';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { MarketingBottomCta } from '@/components/marketing/MarketingBottomCta';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { t } from '@/lib/translations';
import { useLanguage } from '@/contexts/LanguageContext';

const WHY_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/why-grumi')!;

const problemKeys = ['card1', 'card2', 'card3'] as const;
const diffKeys = ['diff1', 'diff2', 'diff3', 'diff4'] as const;

export function WhyGrumi() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta route={WHY_ROUTE} />
      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />

      <main className="flex-1 relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(212,255,0,0.12),transparent_55%)]"
          aria-hidden
        />

        <div className="max-w-6xl mx-auto px-4 pt-28 pb-16 space-y-16 md:space-y-20">
          <section aria-labelledby="why-problem-heading" className="scroll-mt-28 space-y-10 md:space-y-12">
            <MarketingPageHero>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">
                {t('marketing.why.pageTag')}
              </p>
              <h1
                id="why-problem-heading"
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight max-w-3xl mx-auto leading-tight"
              >
                {t('marketing.why.problemTitle')}
              </h1>
            </MarketingPageHero>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {problemKeys.map((c, i) => (
                <article
                  key={c}
                  className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 md:p-7 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-md"
                >
                  <span
                    className="absolute -right-1 -top-1 flex h-14 w-14 items-center justify-center rounded-bl-2xl bg-[#D4FF00]/90 text-lg font-bold text-black tabular-nums"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h2 className="text-lg font-bold text-foreground pr-10 mb-3">{t(`marketing.why.${c}.title`)}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`marketing.why.${c}.body`)}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center"
            aria-labelledby="why-solution-heading"
          >
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t('marketing.why.solutionTag')}
              </p>
              <h2 id="why-solution-heading" className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {t('marketing.why.solutionTitle')}
              </h2>
            </div>
            <div className="rounded-2xl border border-border/80 bg-muted/25 p-6 md:p-8 shadow-inner">
              <p className="text-muted-foreground leading-relaxed text-sm sm:text-base">
                {t('marketing.why.solutionBody')}
              </p>
            </div>
          </section>

          <section className="space-y-8" aria-labelledby="why-diff-heading">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h2 id="why-diff-heading" className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {t('marketing.why.diffHeading')}
              </h2>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5 list-none p-0 m-0">
              {diffKeys.map((d) => (
                <li
                  key={d}
                  className="flex gap-4 rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm transition-colors hover:border-primary/20"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4FF00]/90 text-black">
                    <Check className="w-5 h-5" strokeWidth={2.5} aria-hidden />
                  </span>
                  <span className="text-foreground font-medium leading-snug pt-1.5 text-sm sm:text-base">
                    {t(`marketing.why.${d}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <MarketingBottomCta />
      </main>

      <Footer />
    </div>
  );
}
