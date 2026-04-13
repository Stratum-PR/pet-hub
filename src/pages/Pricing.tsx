import { useState, useCallback, Fragment, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { Check, ArrowRight, ChevronDown } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader';
import { MarketingPageHero } from '@/components/marketing/MarketingPageHero';
import {
  PRICING_TIERS_CONFIG,
  PRICING_ADDONS,
  COMPARISON_SECTIONS,
  COMPARISON_PLAN_COLUMNS,
  pick,
  PRICE_TBD,
  type BillingPeriod,
  type CompareCell,
  type PricingLocale,
} from '@/content/pricing-page-data';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWaitlistModal } from '@/contexts/WaitlistModalContext';
import { t } from '@/lib/translations';

const PRICING_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/pricing')!;
const COMPARISON_TABLE_ID = 'comparison-table';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'sales@example.com';

/** Subtle column tints over banded rows. */
const COMPARISON_PLAN_HEADER_BG: readonly [string, string, string] = [
  'border-l border-border/70 bg-muted/35',
  'border-l border-primary/20 bg-primary/[0.08]',
  'border-l border-border/70 bg-secondary/40',
];

/** Body cells: light tints so row banding remains dominant. */
const COMPARISON_PLAN_CELL_BG: readonly [string, string, string] = [
  'border-l border-border/50 bg-muted/15',
  'border-l border-primary/15 bg-primary/[0.045]',
  'border-l border-border/50 bg-secondary/24',
];

function scrollToComparison() {
  const el = document.getElementById(COMPARISON_TABLE_ID);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}) {
  const pill =
    'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <div role="group" aria-label={t('pricing.billingGroupAria')} className="inline-flex rounded-full border border-border bg-muted/60 p-1 shadow-sm">
      {/* Inverted order: monthly first, annual second (matches “billing” then “annual” reading flow). */}
      <button
        type="button"
        onClick={() => onChange('monthly')}
        aria-pressed={value === 'monthly'}
        aria-label={t('pricing.billingMonthlyAria')}
        className={`${pill} ${
          value === 'monthly'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
      >
        {t('pricing.billingMonthly')}
      </button>
      <button
        type="button"
        onClick={() => onChange('annual')}
        aria-pressed={value === 'annual'}
        aria-label={t('pricing.billingAnnualAria')}
        className={`${pill} ${
          value === 'annual'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
      >
        {t('pricing.billingAnnual')} <span className="text-xs opacity-90">{t('pricing.billingSaveNote')}</span>
      </button>
    </div>
  );
}

function CompareCellContent({ cell, lang }: { cell: CompareCell; lang: PricingLocale }) {
  if (cell === 'check') {
    return (
      <span
        className="mx-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20 sm:h-8 sm:w-8 sm:bg-primary/18 sm:ring-primary/25"
        aria-hidden
      >
        <Check className="h-3 w-3 sm:h-4 sm:w-4" strokeWidth={2.75} />
      </span>
    );
  }
  if (cell === 'dash') {
    return (
      <span className="text-sm font-light tabular-nums text-muted-foreground/45 sm:text-lg" aria-hidden>
        —
      </span>
    );
  }
  return (
    <span className="block max-w-[11rem] px-0.5 text-center text-[10px] font-medium tabular-nums leading-snug tracking-tight text-foreground sm:max-w-none sm:text-xs md:text-sm">
      {pick(cell, lang)}
    </span>
  );
}

export function Pricing() {
  const { language } = useLanguage();
  const { openWaitlistModal } = useWaitlistModal();
  const lang = language as PricingLocale;
  const [billing, setBilling] = useState<BillingPeriod>('annual');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToComparisonCb = useCallback(scrollToComparison, []);

  const comparisonSectionsStriped = useMemo(() => {
    let stripe = 0;
    return COMPARISON_SECTIONS.map((sec) => ({
      category: sec.category,
      rows: sec.rows.map((row) => ({ row, stripe: stripe++ })),
    }));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageMeta route={PRICING_ROUTE} />

      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />

      <main className="relative flex-1 px-3 pb-10 pt-24 sm:px-4 sm:pb-12 sm:pt-28">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_40%_at_50%_-18%,rgba(212,255,0,0.11),transparent_52%)]"
          aria-hidden
        />

        <div className="mx-auto w-full max-w-6xl space-y-10 pb-4">
          <MarketingPageHero>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t('pricing.heroEyebrow')}</p>
            <h1 className="mx-auto mb-2 max-w-3xl text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {t('pricing.heroTitle')}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">{t('pricing.heroSubtitle')}</p>
            <p className="mx-auto mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">{t('pricing.heroTrialNote')}</p>
          </MarketingPageHero>

          <div
            className="overflow-hidden rounded-3xl border border-border/80 bg-card text-card-foreground shadow-md"
            role="article"
            aria-label={t('pricing.ariaPricingPlans')}
          >
            <div className="px-4 py-6 sm:px-8 sm:py-9 md:px-10 md:py-10 lg:px-12 lg:py-11">
              <header className="mb-8 text-center md:mb-9">
                <BillingToggle value={billing} onChange={setBilling} />
              </header>

              <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                {PRICING_TIERS_CONFIG.map((tier) => (
                  <PricingCard
                    key={tier.id}
                    tier={tier}
                    lang={lang}
                    onJoinWaitlist={() => openWaitlistModal({ pricingTier: tier.id })}
                  />
                ))}
              </div>

              <section className="mb-16 text-center">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={scrollToComparisonCb}
                  className="inline-flex w-full items-center justify-center rounded-full border border-border bg-muted/40 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
                >
                  {t('pricing.comparePlansButton')}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </section>

              <section className="mb-12" aria-labelledby="addons-heading">
                <h2 id="addons-heading" className="mb-6 text-center text-xl font-semibold">
                  {t('pricing.addonsHeading')}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {PRICING_ADDONS.map((addon) => (
                    <div
                      key={addon.id}
                      className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/30"
                    >
                      <h3 className="mb-1 font-medium text-foreground">{pick(addon.title, lang)}</h3>
                      <p className="mb-1 text-sm font-medium text-primary">{pick(addon.price, lang)}</p>
                      <p className="text-sm text-muted-foreground">{pick(addon.description, lang)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('pricing.addonAvailableFor')} {pick(addon.availableFor, lang)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section id={COMPARISON_TABLE_ID} className="mb-10" aria-labelledby="comparison-heading">
                <h2 id="comparison-heading" className="mb-6 text-center text-xl font-semibold">
                  {t('pricing.comparePlansHeading')}
                </h2>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-border/60">
                  <table
                    className="w-full table-fixed border-collapse text-[11px] leading-snug sm:text-xs md:text-sm"
                    role="grid"
                    aria-label={t('pricing.compareTableAria')}
                  >
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
                        <th
                          scope="col"
                          className="w-[32%] min-w-0 border-r border-border py-2.5 pl-3 pr-1.5 text-left text-[9px] font-bold uppercase tracking-[0.12em] text-primary sm:w-[28%] sm:py-3 sm:pl-4 sm:pr-2 sm:text-[10px] sm:tracking-[0.14em] md:text-xs"
                        >
                          {t('pricing.compareFeatureColumn')}
                        </th>
                        {COMPARISON_PLAN_COLUMNS.map((col, i) => (
                          <th
                            key={col.id}
                            scope="col"
                            className={`min-w-0 px-1 py-2.5 text-center align-bottom sm:px-2 sm:py-3 md:px-3 ${COMPARISON_PLAN_HEADER_BG[i]}`}
                          >
                            <span className="block font-bold leading-tight text-foreground">{pick(col.name, lang)}</span>
                            <span className="mt-0.5 block text-[9px] font-semibold tabular-nums text-muted-foreground sm:mt-1 sm:text-[10px] md:text-xs">
                              {pick(col.priceLine, lang)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonSectionsStriped.map((sec) => (
                        <Fragment key={sec.category.en}>
                          <tr className="border-y border-border bg-muted/45">
                            <td
                              colSpan={4}
                              className="py-2 pl-3 pr-2 text-[9px] font-bold uppercase tracking-[0.14em] text-primary sm:py-2.5 sm:pl-4 sm:text-[10px] sm:tracking-[0.16em]"
                              id={`cat-${sec.category.en.replace(/\s+/g, '-')}`}
                            >
                              {pick(sec.category, lang)}
                            </td>
                          </tr>
                          {sec.rows.map(({ row, stripe }, ri) => (
                            <tr
                              key={`${sec.category.en}-${ri}`}
                              className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${
                                stripe % 2 === 0 ? 'bg-card/70' : 'bg-muted/20'
                              }`}
                            >
                              <td
                                className={`border-r border-border py-2 pl-3 pr-1.5 font-medium text-foreground sm:py-2.5 sm:pl-4 sm:pr-2 ${
                                  stripe % 2 === 0 ? 'bg-muted/15' : 'bg-card/50'
                                }`}
                              >
                                {pick(row.feature, lang)}
                              </td>
                              <td className={`px-0.5 py-2 text-center sm:py-2.5 md:px-1 ${COMPARISON_PLAN_CELL_BG[0]}`}>
                                <CompareCellContent cell={row.growth} lang={lang} />
                              </td>
                              <td className={`px-0.5 py-2 text-center sm:py-2.5 md:px-1 ${COMPARISON_PLAN_CELL_BG[1]}`}>
                                <CompareCellContent cell={row.standard} lang={lang} />
                              </td>
                              <td className={`px-0.5 py-2 text-center sm:py-2.5 md:px-1 ${COMPARISON_PLAN_CELL_BG[2]}`}>
                                <CompareCellContent cell={row.pro} lang={lang} />
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => openWaitlistModal()}
                    className="rounded-full bg-[#D4FF00] px-8 font-semibold text-black shadow hover:bg-[#D4FF00]/90"
                  >
                    {t('pricing.ctaWaitlist')}
                  </Button>
                  <p className="max-w-md px-2 text-center text-xs text-muted-foreground sm:text-sm">{t('pricing.ctaWaitlistHint')}</p>
                </div>
              </section>

              <footer className="mt-6 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:text-sm">
                <p>{t('pricing.footerDisclaimer')}</p>
              </footer>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function PricingCard({
  tier,
  lang,
  onJoinWaitlist,
}: {
  tier: (typeof PRICING_TIERS_CONFIG)[number];
  lang: PricingLocale;
  onJoinWaitlist: () => void;
}) {
  const name = pick(tier.name, lang);

  return (
    <article
      className="relative flex h-full flex-col rounded-xl border border-border bg-background p-4 shadow-sm transition-colors hover:border-primary/30 sm:rounded-2xl sm:p-5"
      aria-labelledby={`tier-${tier.id}-name`}
    >
      <div className="mb-2 sm:mb-3">
        <h3 id={`tier-${tier.id}-name`} className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground sm:text-sm">{pick(tier.tagline, lang)}</p>
      </div>
      <div className="mb-3 sm:mb-4">
        <p className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl" aria-live="polite">
          {pick(PRICE_TBD, lang)}
        </p>
      </div>
      <ul className="mb-4 flex-1 space-y-1.5 text-xs text-foreground sm:mb-5 sm:space-y-2 sm:text-sm" aria-label={t('pricing.tierListAria', { name })}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 sm:gap-2">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary sm:h-4 sm:w-4" aria-hidden />
            <span>{pick(f, lang)}</span>
          </li>
        ))}
      </ul>
      {tier.buttonVariant === 'contact' ? (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Enterprise%20pricing%20inquiry`}
          className="inline-flex items-center justify-center rounded-lg border-2 border-primary/50 bg-muted/30 px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm"
        >
          {pick(tier.buttonLabel, lang)}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </a>
      ) : (
        <Button
          type="button"
          onClick={onJoinWaitlist}
          className="w-full rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:rounded-xl sm:py-3 sm:text-sm"
        >
          {pick(tier.buttonLabel, lang)}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      )}
    </article>
  );
}
