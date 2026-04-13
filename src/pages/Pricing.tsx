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

/** Soft column washes for plan headers (brand + teal + violet). */
const COMPARISON_PLAN_HEADER_BG: readonly [string, string, string] = [
  'border-l border-primary/25 bg-primary/[0.14]',
  'border-l border-teal-400/30 bg-teal-500/[0.11] dark:bg-teal-400/[0.14]',
  'border-l border-violet-400/30 bg-violet-500/[0.11] dark:bg-violet-400/[0.14]',
];

/** Body cells: subtle tint so columns read clearly over zebra rows. */
const COMPARISON_PLAN_CELL_BG: readonly [string, string, string] = [
  'border-l border-primary/12 bg-primary/[0.05]',
  'border-l border-teal-400/15 bg-teal-500/[0.04] dark:bg-teal-400/[0.06]',
  'border-l border-violet-400/15 bg-violet-500/[0.04] dark:bg-violet-400/[0.06]',
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
        className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/18 text-primary shadow-sm ring-1 ring-primary/25"
        aria-hidden
      >
        <Check className="h-4 w-4" strokeWidth={2.75} />
      </span>
    );
  }
  if (cell === 'dash') {
    return (
      <span className="text-lg font-light tabular-nums text-muted-foreground/45" aria-hidden>
        —
      </span>
    );
  }
  return <span className="text-sm font-medium tabular-nums tracking-tight text-foreground">{pick(cell, lang)}</span>;
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

      <main className="relative flex-1 px-4 pb-12 pt-28">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_40%_at_50%_-18%,rgba(212,255,0,0.11),transparent_52%)]"
          aria-hidden
        />

        <div className="mx-auto w-full max-w-6xl space-y-10 pb-4">
          <MarketingPageHero>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t('pricing.heroEyebrow')}</p>
            <h1 className="mx-auto mb-2 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
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
            <div className="px-5 py-8 sm:px-8 sm:py-9 md:px-10 md:py-10 lg:px-12 lg:py-11">
              <header className="mb-8 text-center md:mb-9">
                <BillingToggle value={billing} onChange={setBilling} />
              </header>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
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
                <div className="overflow-hidden overflow-x-auto rounded-2xl border border-primary/20 bg-card shadow-md shadow-primary/[0.07] ring-1 ring-border/70">
                  <table className="w-full min-w-[800px] border-collapse text-sm" role="grid" aria-label={t('pricing.compareTableAria')}>
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-primary/15 bg-gradient-to-b from-primary/18 via-primary/10 to-muted/40 backdrop-blur-sm">
                        <th
                          scope="col"
                          className="w-[min(280px,40vw)] border-r border-primary/15 bg-primary/[0.08] py-4 pl-5 pr-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-primary"
                        >
                          {t('pricing.compareFeatureColumn')}
                        </th>
                        {COMPARISON_PLAN_COLUMNS.map((col, i) => (
                          <th
                            key={col.id}
                            scope="col"
                            className={`px-3 py-4 text-center align-bottom sm:px-4 ${COMPARISON_PLAN_HEADER_BG[i]}`}
                          >
                            <span className="block text-[0.95rem] font-bold leading-tight text-foreground">{pick(col.name, lang)}</span>
                            <span className="mt-1.5 block text-xs font-semibold tabular-nums text-muted-foreground">
                              {pick(col.priceLine, lang)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonSectionsStriped.map((sec) => (
                        <Fragment key={sec.category.en}>
                          <tr className="border-y border-primary/10 bg-gradient-to-r from-primary/12 via-primary/6 to-transparent">
                            <td
                              colSpan={4}
                              className="py-2.5 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary"
                              id={`cat-${sec.category.en.replace(/\s+/g, '-')}`}
                            >
                              {pick(sec.category, lang)}
                            </td>
                          </tr>
                          {sec.rows.map(({ row, stripe }, ri) => (
                            <tr
                              key={`${sec.category.en}-${ri}`}
                              className={`border-b border-border/50 transition-colors hover:bg-primary/[0.06] ${
                                stripe % 2 === 0 ? 'bg-muted/35' : 'bg-background/80'
                              }`}
                            >
                              <td
                                className={`border-r border-primary/10 py-3 pl-5 pr-3 text-[0.8125rem] font-medium leading-snug text-foreground ${
                                  stripe % 2 === 0 ? 'bg-primary/[0.04]' : 'bg-primary/[0.02]'
                                }`}
                              >
                                {pick(row.feature, lang)}
                              </td>
                              <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[0]}`}>
                                <CompareCellContent cell={row.basico} lang={lang} />
                              </td>
                              <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[1]}`}>
                                <CompareCellContent cell={row.estandar} lang={lang} />
                              </td>
                              <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[2]}`}>
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
      className="relative flex h-full flex-col rounded-2xl border border-border bg-background p-6 shadow-sm transition-colors hover:border-primary/30"
      aria-labelledby={`tier-${tier.id}-name`}
    >
      <div className="mb-4">
        <h3 id={`tier-${tier.id}-name`} className="text-xl font-bold text-foreground">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground">{pick(tier.tagline, lang)}</p>
      </div>
      <div className="mb-4">
        <p className="text-3xl font-bold tracking-tight text-foreground" aria-live="polite">
          {pick(PRICE_TBD, lang)}
        </p>
      </div>
      <ul className="mb-6 flex-1 space-y-2 text-sm text-foreground" aria-label={t('pricing.tierListAria', { name })}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
            <span>{pick(f, lang)}</span>
          </li>
        ))}
      </ul>
      {tier.buttonVariant === 'contact' ? (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Enterprise%20pricing%20inquiry`}
          className="inline-flex items-center justify-center rounded-xl border-2 border-primary/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {pick(tier.buttonLabel, lang)}
          <ArrowRight className="ml-2 h-4 w-4" />
        </a>
      ) : (
        <Button
          type="button"
          onClick={onJoinWaitlist}
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pick(tier.buttonLabel, lang)}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </article>
  );
}
