import { useState, useCallback, Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  type BillingPeriod,
  type CompareCell,
} from '@/content/pricing-page-data';

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
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex rounded-full p-1 bg-muted/60 border border-border shadow-sm"
    >
      <button
        type="button"
        onClick={() => onChange('annual')}
        aria-pressed={value === 'annual'}
        aria-label="Annual billing — Save 15%"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          value === 'annual'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
      >
        Annual billing <span className="text-xs opacity-90">(Save 15%)</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        aria-pressed={value === 'monthly'}
        aria-label="Monthly billing"
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          value === 'monthly'
            ? 'bg-[#D4FF00] text-black shadow'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
        }`}
      >
        Monthly billing
      </button>
    </div>
  );
}

function CompareCellContent({ cell }: { cell: CompareCell }) {
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
      <span className="text-muted-foreground/45 text-lg font-light tabular-nums" aria-hidden>
        —
      </span>
    );
  }
  return <span className="text-foreground text-sm font-medium tabular-nums tracking-tight">{cell}</span>;
}

export function Pricing() {
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
    <div className="min-h-screen flex flex-col bg-background">
      <PageMeta route={PRICING_ROUTE} />

      <MarketingSiteHeader
        mode="standard"
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuOpenChange={setMobileMenuOpen}
      />

      <main className="relative flex-1 pt-28 pb-12 px-4">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_75%_40%_at_50%_-18%,rgba(212,255,0,0.11),transparent_52%)]"
          aria-hidden
        />

        <div className="w-full max-w-6xl mx-auto space-y-10 pb-4">
          <MarketingPageHero>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">Pricing</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2 max-w-3xl mx-auto">
              Start free. Scale with confidence.
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Pay only as your pet care business grows.
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 max-w-xl mx-auto">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </MarketingPageHero>

          <div
            className="rounded-3xl border border-border/80 bg-card text-card-foreground shadow-md overflow-hidden"
            role="article"
            aria-label="Pricing plans"
          >
            <div className="px-5 py-8 sm:px-8 sm:py-9 md:px-10 md:py-10 lg:px-12 lg:py-11">
              <header className="text-center mb-8 md:mb-9">
                <BillingToggle value={billing} onChange={setBilling} />
              </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
              {PRICING_TIERS_CONFIG.map((tier) => (
                <PricingCard key={tier.id} tier={tier} billing={billing} />
              ))}
            </div>

            {/* Single comparison link below all tiers */}
            <section className="mb-16 text-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={scrollToComparisonCb}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-border bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted/60 hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Compare Plans in Detail
                <ChevronDown className="ml-2 w-4 h-4" />
              </Button>
            </section>

            {/* Add-ons */}
            <section className="mb-12" aria-labelledby="addons-heading">
              <h2 id="addons-heading" className="text-xl font-semibold text-center mb-6">
                Enhance Your Plan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PRICING_ADDONS.map((addon) => (
                  <div
                    key={addon.id}
                    className="rounded-xl border border-border bg-muted/20 p-4 hover:border-primary/30 transition-colors"
                  >
                    <h3 className="font-medium text-foreground mb-1">{addon.title}</h3>
                    <p className="text-sm font-medium text-primary mb-1">{addon.price}</p>
                    <p className="text-sm text-muted-foreground">{addon.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Available for: {addon.availableFor.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Comparison table */}
            <section
              id={COMPARISON_TABLE_ID}
              className="mb-10"
              aria-labelledby="comparison-heading"
            >
              <h2 id="comparison-heading" className="text-xl font-semibold text-center mb-6">
                Compare Plans in Detail
              </h2>
              <div className="overflow-hidden overflow-x-auto rounded-2xl border border-primary/20 bg-card shadow-md shadow-primary/[0.07] ring-1 ring-border/70">
                <table className="w-full min-w-[800px] border-collapse text-sm" role="grid" aria-label="Comparación de planes Grumi">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-primary/15 bg-gradient-to-b from-primary/18 via-primary/10 to-muted/40 backdrop-blur-sm">
                      <th
                        scope="col"
                        className="w-[min(280px,40vw)] border-r border-primary/15 bg-primary/[0.08] py-4 pl-5 pr-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-primary"
                      >
                        Función
                      </th>
                      {COMPARISON_PLAN_COLUMNS.map((col, i) => (
                        <th
                          key={col.id}
                          scope="col"
                          className={`px-3 py-4 text-center align-bottom sm:px-4 ${COMPARISON_PLAN_HEADER_BG[i]}`}
                        >
                          <span className="block text-[0.95rem] font-bold leading-tight text-foreground">{col.name}</span>
                          <span className="mt-1.5 block text-xs font-semibold text-muted-foreground tabular-nums">
                            {col.priceLine}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonSectionsStriped.map((sec) => (
                      <Fragment key={sec.category}>
                        <tr className="border-y border-primary/10 bg-gradient-to-r from-primary/12 via-primary/6 to-transparent">
                          <td
                            colSpan={4}
                            className="py-2.5 pl-5 pr-4 text-[11px] font-bold uppercase tracking-[0.16em] text-primary"
                            id={`cat-${sec.category.replace(/\s+/g, '-')}`}
                          >
                            {sec.category}
                          </td>
                        </tr>
                        {sec.rows.map(({ row, stripe }, ri) => (
                          <tr
                            key={`${sec.category}-${ri}`}
                            className={`border-b border-border/50 transition-colors hover:bg-primary/[0.06] ${
                              stripe % 2 === 0 ? 'bg-muted/35' : 'bg-background/80'
                            }`}
                          >
                            <td
                              className={`border-r border-primary/10 py-3 pl-5 pr-3 text-[0.8125rem] font-medium leading-snug text-foreground ${
                                stripe % 2 === 0 ? 'bg-primary/[0.04]' : 'bg-primary/[0.02]'
                              }`}
                            >
                              {row.feature}
                            </td>
                            <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[0]}`}>
                              <CompareCellContent cell={row.basico} />
                            </td>
                            <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[1]}`}>
                              <CompareCellContent cell={row.estandar} />
                            </td>
                            <td className={`py-3 text-center ${COMPARISON_PLAN_CELL_BG[2]}`}>
                              <CompareCellContent cell={row.pro} />
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
                  asChild
                  size="lg"
                  className="rounded-full bg-[#D4FF00] px-8 font-semibold text-black shadow hover:bg-[#D4FF00]/90"
                >
                  <Link to="/#waitlist">Solicitar acceso anticipado</Link>
                </Button>
                <p className="text-center text-xs sm:text-sm text-muted-foreground max-w-md px-2">
                  Grumi está en desarrollo — sé de los primeros en probarlo
                </p>
              </div>
            </section>

            <footer className="mt-6 pt-6 border-t border-border text-center text-xs sm:text-sm text-muted-foreground">
              <p>Prices in USD. Cancel anytime.</p>
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
  billing,
}: {
  tier: (typeof PRICING_TIERS_CONFIG)[number];
  billing: BillingPeriod;
}) {
  const isAnnual = billing === 'annual';
  const price =
    tier.price == null
      ? null
      : isAnnual
        ? tier.price.annualPerMonth
        : tier.price.monthly;

  return (
    <article
      className="relative rounded-2xl border border-border bg-background p-6 flex flex-col h-full transition-colors hover:border-primary/30 shadow-sm"
      aria-labelledby={`tier-${tier.id}-name`}
    >
      <div className="mb-4">
        <h3 id={`tier-${tier.id}-name`} className="text-xl font-bold text-foreground">
          {tier.name}
        </h3>
        <p className="text-sm text-muted-foreground">{tier.tagline}</p>
      </div>
      <div className="mb-4">
        {price != null ? (
          <div
            key={billing}
            className="flex items-baseline gap-1 flex-wrap animate-fade-in"
            aria-live="polite"
          >
            <span className="text-3xl font-bold text-foreground tabular-nums">${price}</span>
            <span className="text-muted-foreground">/month</span>
            {isAnnual && tier.price && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Save 15%
              </span>
            )}
          </div>
        ) : (
          <p className="text-lg font-semibold text-muted-foreground">Custom pricing</p>
        )}
      </div>
      <ul className="space-y-2 flex-1 mb-6 text-sm text-foreground" aria-label={`${tier.name} features`}>
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {tier.buttonVariant === 'contact' ? (
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=Enterprise%20pricing%20inquiry`}
          className="inline-flex items-center justify-center rounded-xl border-2 border-primary/50 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground hover:bg-primary/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tier.buttonLabel}
          <ArrowRight className="ml-2 w-4 h-4" />
        </a>
      ) : (
        <Button
          asChild
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Link to={`/?tier=${encodeURIComponent(tier.id)}#waitlist`}>
            {tier.buttonLabel}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      )}
    </article>
  );
}
